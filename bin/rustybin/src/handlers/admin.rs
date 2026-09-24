use axum::{
    Json,
    extract::{Path, Query, State},
    http::{HeaderMap, HeaderValue, StatusCode},
    response::IntoResponse,
};
use std::env;
use std::sync::Arc;

use crate::auth::generate_token;
use crate::db::Database;
use crate::error::json_error;
use crate::models::admin::{
    BulkDeleteRequest, BulkDeleteResponse, DeleteResponse, LoginRequest, PasteFilterParams,
    PasteListItem, PasteListResponse, StatsQuery, StatsResponse, TimeSeriesPoint,
};

/// POST /v1/admin/login - authenticate with admin secret.
pub async fn admin_login(Json(body): Json<LoginRequest>) -> impl IntoResponse {
    let admin_secret = env::var("ADMIN_SECRET").unwrap_or_default();

    // Constant-time comparison to prevent timing attacks
    if !constant_time_eq(body.secret.as_bytes(), admin_secret.as_bytes()) {
        tracing::warn!("Admin login failed: invalid secret");
        return (
            StatusCode::UNAUTHORIZED,
            HeaderMap::new(),
            Json(json_error("Invalid admin secret")),
        );
    }

    match generate_token(&admin_secret) {
        Ok((token, exp)) => {
            let expires_at = chrono::DateTime::from_timestamp(exp as i64, 0)
                .map(|dt| dt.to_rfc3339())
                .unwrap_or_default();

            let session_hours: u64 = env::var("ADMIN_SESSION_HOURS")
                .ok()
                .and_then(|v| v.parse().ok())
                .unwrap_or(24);
            let max_age = session_hours * 3600;

            let is_secure = env::var("RUST_ENV").unwrap_or_default() == "production";
            let cookie = if is_secure {
                format!(
                    "admin_token={}; HttpOnly; Secure; SameSite=Strict; Path=/v1/admin; Max-Age={}",
                    token, max_age
                )
            } else {
                format!(
                    "admin_token={}; HttpOnly; SameSite=Lax; Path=/v1/admin; Max-Age={}",
                    token, max_age
                )
            };

            let mut headers = HeaderMap::new();
            headers.insert("set-cookie", HeaderValue::from_str(&cookie).unwrap());

            tracing::info!("Admin login successful");

            (
                StatusCode::OK,
                headers,
                Json(serde_json::json!({
                    "success": true,
                    "expires_at": expires_at
                })),
            )
        }
        Err(_) => {
            tracing::error!("Failed to generate admin token");
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                HeaderMap::new(),
                Json(json_error("Failed to generate session token")),
            )
        }
    }
}

/// POST /v1/admin/logout - clear the admin session cookie.
pub async fn admin_logout() -> impl IntoResponse {
    let is_secure = env::var("RUST_ENV").unwrap_or_default() == "production";
    let cookie = if is_secure {
        "admin_token=; HttpOnly; Secure; SameSite=Strict; Path=/v1/admin; Max-Age=0"
    } else {
        "admin_token=; HttpOnly; SameSite=Lax; Path=/v1/admin; Max-Age=0"
    };

    let mut headers = HeaderMap::new();
    headers.insert("set-cookie", HeaderValue::from_str(cookie).unwrap());

    tracing::info!("Admin logout");

    (
        StatusCode::OK,
        headers,
        Json(serde_json::json!({ "success": true })),
    )
}

/// GET /v1/admin/stats - retrieve dashboard statistics.
pub async fn admin_stats(
    State(db): State<Arc<Database>>,
    Query(query): Query<StatsQuery>,
) -> impl IntoResponse {
    let (start, end) = if query.range == "custom" {
        match (query.start, query.end) {
            (Some(s), Some(e)) => (Some(s), Some(e)),
            _ => {
                return (
                    StatusCode::BAD_REQUEST,
                    Json(json_error(
                        "Custom range requires 'start' and 'end' parameters",
                    )),
                )
                    .into_response();
            }
        }
    } else {
        (None, None)
    };

    match db.get_dashboard_stats(&query.range, start, end) {
        Ok(stats) => {
            let response = StatsResponse {
                total_pastes: stats.total_pastes,
                pending_expiration: stats.pending_expiration,
                burn_after_read_count: stats.unread_pastes,
                total_size: stats.total_size,
                language_stats: stats.language_stats,
                pastes_over_time: stats
                    .pastes_over_time
                    .into_iter()
                    .map(|p| TimeSeriesPoint {
                        date: p.date,
                        count: p.count,
                    })
                    .collect(),
            };
            (
                StatusCode::OK,
                Json(serde_json::to_value(response).unwrap()),
            )
                .into_response()
        }
        Err(e) => {
            tracing::error!("Failed to fetch dashboard stats: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json_error("Failed to fetch statistics")),
            )
                .into_response()
        }
    }
}

/// GET /v1/admin/pastes - retrieve filtered, paginated paste list.
pub async fn admin_list_pastes(
    State(db): State<Arc<Database>>,
    Query(params): Query<PasteFilterParams>,
) -> impl IntoResponse {
    let page = params.page.max(1);
    let limit = params.limit.clamp(1, 100);
    let offset = (page - 1) * limit;

    match db.list_pastes_filtered(&params, limit, offset) {
        Ok((pastes, total)) => {
            let total_pages = if total == 0 {
                0
            } else {
                (total + limit - 1) / limit
            };

            let items: Vec<PasteListItem> = pastes
                .into_iter()
                .map(|(p, size)| PasteListItem {
                    id: p.id,
                    language: p.language,
                    created_at: p.created_at.to_rfc3339(),
                    size,
                    paste_type: p.paste_type.unwrap_or_else(|| "paste".to_string()),
                    burn_after_read: p.burn_after_read,
                    has_expiration: p.expires_at.is_some(),
                    expires_at: p.expires_at.map(|dt| dt.to_rfc3339()),
                    encryption_version: p.encryption_version,
                })
                .collect();

            let response = PasteListResponse {
                pastes: items,
                total,
                page,
                limit,
                total_pages,
            };

            (
                StatusCode::OK,
                Json(serde_json::to_value(response).unwrap()),
            )
                .into_response()
        }
        Err(e) => {
            tracing::error!("Failed to list pastes: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json_error("Failed to fetch paste list")),
            )
                .into_response()
        }
    }
}

/// DELETE /v1/admin/pastes/:id - delete a single paste.
pub async fn admin_delete_paste(
    State(db): State<Arc<Database>>,
    Path(id): Path<String>,
) -> impl IntoResponse {
    match db.delete_paste_admin(&id) {
        Ok(()) => {
            tracing::info!("Admin deleted paste: {}", id);
            (
                StatusCode::OK,
                Json(
                    serde_json::to_value(DeleteResponse {
                        success: true,
                        deleted_id: id,
                    })
                    .unwrap(),
                ),
            )
                .into_response()
        }
        Err(crate::db::DbError::PasteNotFound) => {
            (StatusCode::NOT_FOUND, Json(json_error("Paste not found"))).into_response()
        }
        Err(e) => {
            tracing::error!("Failed to delete paste {}: {}", id, e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json_error("Failed to delete paste")),
            )
                .into_response()
        }
    }
}

/// DELETE /v1/admin/pastes - bulk delete multiple pastes.
pub async fn admin_bulk_delete(
    State(db): State<Arc<Database>>,
    Json(body): Json<BulkDeleteRequest>,
) -> impl IntoResponse {
    if body.ids.is_empty() || body.ids.len() > 100 {
        return (
            StatusCode::BAD_REQUEST,
            Json(json_error(
                "Request must include between 1 and 100 paste IDs",
            )),
        )
            .into_response();
    }

    let id_list = body
        .ids
        .iter()
        .map(|s| s.as_str())
        .collect::<Vec<_>>()
        .join(", ");

    match db.bulk_delete_pastes(&body.ids) {
        Ok((deleted_count, not_found)) => {
            tracing::info!(
                "Admin bulk deleted {} pastes (IDs: {})",
                deleted_count,
                id_list
            );

            let response = BulkDeleteResponse {
                success: true,
                deleted_count,
                not_found,
            };
            (
                StatusCode::OK,
                Json(serde_json::to_value(response).unwrap()),
            )
                .into_response()
        }
        Err(e) => {
            tracing::error!("Bulk delete failed: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json_error("Failed to delete pastes")),
            )
                .into_response()
        }
    }
}

/// Constant-time byte comparison to prevent timing attacks.
fn constant_time_eq(a: &[u8], b: &[u8]) -> bool {
    if a.len() != b.len() {
        return false;
    }
    a.iter()
        .zip(b.iter())
        .fold(0u8, |acc, (x, y)| acc | (x ^ y))
        == 0
}
