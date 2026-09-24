use serde::{Deserialize, Serialize};

/// Request body for admin login.
#[derive(Debug, Deserialize)]
pub struct LoginRequest {
    pub secret: String,
}

/// JWT claims for admin session tokens.
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Claims {
    pub sub: String,
    pub exp: usize,
    pub iat: usize,
}

/// Query parameters for the stats endpoint.
#[derive(Debug, Deserialize)]
pub struct StatsQuery {
    #[serde(default = "default_range")]
    pub range: String,
    pub start: Option<i64>,
    pub end: Option<i64>,
}

fn default_range() -> String {
    "7d".to_string()
}

/// Response body for dashboard statistics.
#[derive(Debug, Serialize)]
pub struct StatsResponse {
    pub total_pastes: i64,
    pub pending_expiration: i64,
    pub burn_after_read_count: i64,
    pub total_size: i64,
    pub language_stats: std::collections::HashMap<String, i64>,
    pub pastes_over_time: Vec<TimeSeriesPoint>,
}

/// A single point in the time-series chart data.
#[derive(Debug, Serialize)]
pub struct TimeSeriesPoint {
    pub date: String,
    pub count: i64,
}

/// Query parameters for the filtered paste list endpoint.
#[derive(Debug, Deserialize)]
pub struct PasteFilterParams {
    #[serde(default = "default_page")]
    pub page: i64,
    #[serde(default = "default_limit")]
    pub limit: i64,
    #[serde(default = "default_sort")]
    pub sort: String,
    #[serde(default = "default_order")]
    pub order: String,
    pub language: Option<String>,
    #[serde(rename = "type")]
    pub paste_type: Option<String>,
    pub burn: Option<bool>,
    pub expiration: Option<bool>,
    pub search: Option<String>,
    pub start_date: Option<i64>,
    pub end_date: Option<i64>,
}

fn default_page() -> i64 {
    1
}

fn default_limit() -> i64 {
    50
}

fn default_sort() -> String {
    "created_at".to_string()
}

fn default_order() -> String {
    "DESC".to_string()
}

/// A single paste item in the admin list (no data field).
#[derive(Debug, Serialize)]
pub struct PasteListItem {
    pub id: String,
    pub language: String,
    pub created_at: String,
    pub size: i64,
    #[serde(rename = "type")]
    pub paste_type: String,
    pub burn_after_read: bool,
    pub has_expiration: bool,
    pub expires_at: Option<String>,
    pub encryption_version: u8,
}

/// Paginated response for the paste list endpoint.
#[derive(Debug, Serialize)]
pub struct PasteListResponse {
    pub pastes: Vec<PasteListItem>,
    pub total: i64,
    pub page: i64,
    pub limit: i64,
    pub total_pages: i64,
}

/// Request body for bulk paste deletion.
#[derive(Debug, Deserialize)]
pub struct BulkDeleteRequest {
    pub ids: Vec<String>,
}

/// Response body for single paste deletion.
#[derive(Debug, Serialize)]
pub struct DeleteResponse {
    pub success: bool,
    pub deleted_id: String,
}

/// Response body for bulk paste deletion.
#[derive(Debug, Serialize)]
pub struct BulkDeleteResponse {
    pub success: bool,
    pub deleted_count: usize,
    pub not_found: Vec<String>,
}
