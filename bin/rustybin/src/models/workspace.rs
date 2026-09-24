use serde::{Deserialize, Serialize};
use chrono::{DateTime, Utc};

#[derive(Debug, Deserialize)]
pub struct CreateWorkspaceRequest {
    pub data: String,
    #[serde(default)]
    pub burn_after_read: bool,
    #[serde(default)]
    pub expires_in_minutes: Option<u32>,
}

#[derive(Debug, Serialize)]
pub struct CreateWorkspaceResponse {
    pub id: String,
    pub edit_key: String,
    pub created_at: DateTime<Utc>,
    pub burn_after_read: bool,
    pub expires_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateWorkspaceRequest {
    pub data: String,
    pub edit_key: String,
}

#[derive(Debug, Serialize)]
pub struct WorkspaceResponse {
    pub id: String,
    pub data: String,
    pub created_at: DateTime<Utc>,
    pub encryption_version: u8,
    pub burn_after_read: bool,
    pub expires_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Deserialize)]
pub struct DeleteWorkspaceRequest {
    pub edit_key: String,
}
