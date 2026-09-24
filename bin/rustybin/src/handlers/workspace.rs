use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use std::sync::Arc;

use crate::db::{Database, DbError};
use crate::error::json_error;
use crate::models::workspace::{
    CreateWorkspaceRequest, CreateWorkspaceResponse,
    UpdateWorkspaceRequest, WorkspaceResponse,
    DeleteWorkspaceRequest,
};

// Handler for creating a new workspace
pub async fn create_workspace(
    State(db): State<Arc<Database>>,
    Json(payload): Json<CreateWorkspaceRequest>,
) -> impl IntoResponse {
    // Validate request
    if payload.data.is_empty() {
        return (StatusCode::BAD_REQUEST, Json(json_error("Data is required"))).into_response();
    }

    match db.create_workspace(payload.data, payload.burn_after_read, payload.expires_in_minutes) {
        Ok(paste) => {
            let response = CreateWorkspaceResponse {
                id: paste.id,
                edit_key: paste.edit_key.unwrap_or_default(),
                created_at: paste.created_at,
                burn_after_read: paste.burn_after_read,
                expires_at: paste.expires_at,
            };
            (StatusCode::CREATED, Json(response)).into_response()
        }
        Err(err) => {
            let (status, message) = match &err {
                DbError::CharacterLimitExceeded(actual, max) => {
                    (StatusCode::BAD_REQUEST, format!("Content too large: {} bytes (maximum: {} bytes)", actual, max))
                }
                DbError::ClientEncryptionRequired => {
                    (StatusCode::BAD_REQUEST, "Data is required".to_string())
                }
                DbError::IdGenerationFailed => {
                    tracing::error!("Failed to generate unique ID after maximum retries");
                    (StatusCode::INTERNAL_SERVER_ERROR, "Server error: please try again".to_string())
                }
                _ => {
                    tracing::error!("Database error: {}", err);
                    (StatusCode::INTERNAL_SERVER_ERROR, "Failed to create workspace".to_string())
                }
            };
            (status, Json(json_error(&message))).into_response()
        }
    }
}

// Handler for getting a workspace by ID
pub async fn get_workspace(
    State(db): State<Arc<Database>>,
    Path(id): Path<String>,
) -> impl IntoResponse {
    // Validate ID format (alphanumeric, 6-16 chars)
    if id.len() < 6 || id.len() > 16 || !id.chars().all(|c| c.is_alphanumeric()) {
        return (
            StatusCode::BAD_REQUEST,
            Json(json_error("Invalid workspace ID format")),
        ).into_response();
    }

    match db.get_workspace(&id) {
        Some(paste) => {
            let response = WorkspaceResponse {
                id: paste.id,
                data: paste.data,
                created_at: paste.created_at,
                encryption_version: paste.encryption_version,
                burn_after_read: paste.burn_after_read,
                expires_at: paste.expires_at,
            };
            (StatusCode::OK, Json(response)).into_response()
        }
        None => (
            StatusCode::NOT_FOUND,
            Json(json_error("Workspace not found")),
        ).into_response(),
    }
}

// Handler for updating a workspace
pub async fn update_workspace(
    State(db): State<Arc<Database>>,
    Path(id): Path<String>,
    Json(payload): Json<UpdateWorkspaceRequest>,
) -> impl IntoResponse {
    // Validate ID format
    if id.len() < 6 || id.len() > 16 || !id.chars().all(|c| c.is_alphanumeric()) {
        return (
            StatusCode::BAD_REQUEST,
            Json(json_error("Invalid workspace ID format")),
        ).into_response();
    }

    // Validate request
    if payload.data.is_empty() {
        return (StatusCode::BAD_REQUEST, Json(json_error("Data is required"))).into_response();
    }

    if payload.edit_key.is_empty() {
        return (StatusCode::BAD_REQUEST, Json(json_error("Edit key is required"))).into_response();
    }

    match db.update_workspace(&id, payload.data, payload.edit_key) {
        Ok(paste) => {
            let response = WorkspaceResponse {
                id: paste.id,
                data: String::new(),
                created_at: paste.created_at,
                encryption_version: paste.encryption_version,
                burn_after_read: paste.burn_after_read,
                expires_at: paste.expires_at,
            };
            (StatusCode::OK, Json(response)).into_response()
        }
        Err(err) => {
            let (status, message) = match &err {
                DbError::PasteNotFound => {
                    (StatusCode::NOT_FOUND, "Workspace not found".to_string())
                }
                DbError::InvalidEditKey => {
                    (StatusCode::FORBIDDEN, "Invalid edit key".to_string())
                }
                DbError::CharacterLimitExceeded(actual, max) => {
                    (StatusCode::BAD_REQUEST, format!("Content too large: {} bytes (maximum: {} bytes)", actual, max))
                }
                DbError::ClientEncryptionRequired => {
                    (StatusCode::BAD_REQUEST, "Data is required".to_string())
                }
                _ => {
                    tracing::error!("Database error during update: {}", err);
                    (StatusCode::INTERNAL_SERVER_ERROR, "Failed to update workspace".to_string())
                }
            };
            (status, Json(json_error(&message))).into_response()
        }
    }
}

// Handler for deleting a workspace
pub async fn delete_workspace(
    State(db): State<Arc<Database>>,
    Path(id): Path<String>,
    Json(payload): Json<DeleteWorkspaceRequest>,
) -> impl IntoResponse {
    // Validate ID format
    if id.len() < 6 || id.len() > 16 || !id.chars().all(|c| c.is_alphanumeric()) {
        return (
            StatusCode::BAD_REQUEST,
            Json(json_error("Invalid workspace ID format")),
        ).into_response();
    }

    // Validate edit key is present
    if payload.edit_key.is_empty() {
        return (
            StatusCode::BAD_REQUEST,
            Json(json_error("Edit key is required")),
        ).into_response();
    }

    match db.delete_workspace_with_key(&id, &payload.edit_key) {
        Ok(()) => StatusCode::NO_CONTENT.into_response(),
        Err(err) => {
            let (status, message) = match &err {
                DbError::PasteNotFound => {
                    (StatusCode::NOT_FOUND, "Workspace not found".to_string())
                }
                DbError::InvalidEditKey => {
                    (StatusCode::FORBIDDEN, "Invalid edit key".to_string())
                }
                _ => {
                    tracing::error!("Database error during delete: {}", err);
                    (StatusCode::INTERNAL_SERVER_ERROR, "Failed to delete workspace".to_string())
                }
            };
            (status, Json(json_error(&message))).into_response()
        }
    }
}
