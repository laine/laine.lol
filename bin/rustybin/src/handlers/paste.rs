use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use std::sync::Arc;

use crate::db::{Database, DbError, CreatePasteData, UpdatePasteData, DeletePasteData};
use crate::error::json_error;

// Handler for creating a new paste
pub async fn create_paste(
    State(db): State<Arc<Database>>,
    Json(payload): Json<CreatePasteData>,
) -> impl IntoResponse {
    // Validate request
    if payload.data.is_empty() {
        return (StatusCode::BAD_REQUEST, Json(json_error("Data is required"))).into_response();
    }

    // Create the paste
    match db.create_paste(payload) {
        Ok(paste) => (StatusCode::CREATED, Json(paste)).into_response(),
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
                    (StatusCode::INTERNAL_SERVER_ERROR, "Failed to create paste".to_string())
                }
            };
            (status, Json(json_error(&message))).into_response()
        }
    }
}

// Handler for getting a paste by ID
pub async fn get_paste(State(db): State<Arc<Database>>, Path(id): Path<String>) -> impl IntoResponse {
    // Validate ID format (alphanumeric, 6-16 chars)
    if id.len() < 6 || id.len() > 16 || !id.chars().all(|c| c.is_alphanumeric()) {
        return (
            StatusCode::BAD_REQUEST,
            Json(json_error("Invalid paste ID format")),
        ).into_response();
    }

    match db.get_paste(&id) {
        Some(paste) => (StatusCode::OK, Json(paste)).into_response(),
        None => (
            StatusCode::NOT_FOUND,
            Json(json_error("Paste not found")),
        ).into_response(),
    }
}

// Handler for updating a paste
pub async fn update_paste(
    State(db): State<Arc<Database>>,
    Path(id): Path<String>,
    Json(payload): Json<UpdatePasteData>,
) -> impl IntoResponse {
    // Validate ID format
    if id.len() < 6 || id.len() > 16 || !id.chars().all(|c| c.is_alphanumeric()) {
        return (
            StatusCode::BAD_REQUEST,
            Json(json_error("Invalid paste ID format")),
        ).into_response();
    }

    // Validate request
    if payload.data.is_empty() {
        return (StatusCode::BAD_REQUEST, Json(json_error("Data is required"))).into_response();
    }

    if payload.edit_key.is_empty() {
        return (StatusCode::BAD_REQUEST, Json(json_error("Edit key is required"))).into_response();
    }

    match db.update_paste(&id, payload) {
        Ok(paste) => (StatusCode::OK, Json(paste)).into_response(),
        Err(err) => {
            let (status, message) = match &err {
                DbError::PasteNotFound => {
                    (StatusCode::NOT_FOUND, "Paste not found".to_string())
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
                    (StatusCode::INTERNAL_SERVER_ERROR, "Failed to update paste".to_string())
                }
            };
            (status, Json(json_error(&message))).into_response()
        }
    }
}

// Handler for deleting a paste
pub async fn delete_paste(
    State(db): State<Arc<Database>>,
    Path(id): Path<String>,
    Json(payload): Json<DeletePasteData>,
) -> impl IntoResponse {
    // Validate ID format
    if id.len() < 6 || id.len() > 16 || !id.chars().all(|c| c.is_alphanumeric()) {
        return (
            StatusCode::BAD_REQUEST,
            Json(json_error("Invalid paste ID format")),
        ).into_response();
    }

    // Validate edit key is present
    if payload.edit_key.is_empty() {
        return (
            StatusCode::BAD_REQUEST,
            Json(json_error("Edit key is required")),
        ).into_response();
    }

    match db.delete_paste_with_key(&id, payload) {
        Ok(()) => StatusCode::NO_CONTENT.into_response(),
        Err(err) => {
            let (status, message) = match &err {
                DbError::PasteNotFound => {
                    (StatusCode::NOT_FOUND, "Paste not found".to_string())
                }
                DbError::InvalidEditKey => {
                    (StatusCode::FORBIDDEN, "Invalid edit key".to_string())
                }
                _ => {
                    tracing::error!("Database error during delete: {}", err);
                    (StatusCode::INTERNAL_SERVER_ERROR, "Failed to delete paste".to_string())
                }
            };
            (status, Json(json_error(&message))).into_response()
        }
    }
}
