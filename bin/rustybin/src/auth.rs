use axum::{
    extract::Request,
    http::StatusCode,
    middleware::Next,
    response::{IntoResponse, Response},
    Json,
};
use jsonwebtoken::{decode, encode, DecodingKey, EncodingKey, Header, Validation};
use std::env;

use crate::error::json_error;
use crate::models::admin::Claims;

/// Generate a JWT token for an authenticated admin session.
///
/// Uses HMAC-SHA256 with the `ADMIN_SECRET` env var as the signing key.
/// Session duration is controlled by `ADMIN_SESSION_HOURS` (default: 24).
pub fn generate_token(secret: &str) -> Result<(String, usize), jsonwebtoken::errors::Error> {
    let session_hours: u64 = env::var("ADMIN_SESSION_HOURS")
        .ok()
        .and_then(|v| v.parse().ok())
        .unwrap_or(24);

    let now = jsonwebtoken::get_current_timestamp() as usize;
    let exp = now + (session_hours as usize * 3600);

    let claims = Claims {
        sub: "admin".to_string(),
        exp,
        iat: now,
    };

    let token = encode(
        &Header::default(),
        &claims,
        &EncodingKey::from_secret(secret.as_bytes()),
    )?;

    Ok((token, exp))
}

/// Validate a JWT token and return the claims if valid.
///
/// Checks signature and expiration automatically.
pub fn validate_token(token: &str, secret: &str) -> Result<Claims, jsonwebtoken::errors::Error> {
    let mut validation = Validation::default();
    validation.set_required_spec_claims(&["exp", "iat", "sub"]);

    let token_data = decode::<Claims>(
        token,
        &DecodingKey::from_secret(secret.as_bytes()),
        &validation,
    )?;

    Ok(token_data.claims)
}

/// Extract the `admin_token` cookie value from a Cookie header string.
fn extract_cookie(cookie_header: &str, name: &str) -> Option<String> {
    cookie_header
        .split(';')
        .find_map(|pair| {
            let pair = pair.trim();
            if let Some(value) = pair.strip_prefix(name) {
                let value = value.trim_start();
                value.strip_prefix('=').map(|v| v.to_string())
            } else {
                None
            }
        })
}

/// Axum middleware that requires a valid admin JWT in the `admin_token` cookie.
///
/// Returns 401 Unauthorized if the token is missing, invalid, or expired.
pub async fn require_admin_auth(req: Request, next: Next) -> Result<Response, Response> {
    let admin_secret = env::var("ADMIN_SECRET").unwrap_or_default();

    let cookie_header = req
        .headers()
        .get("cookie")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("");

    let token = extract_cookie(cookie_header, "admin_token");

    match token {
        Some(token) => match validate_token(&token, &admin_secret) {
            Ok(_claims) => Ok(next.run(req).await),
            Err(_) => Err((
                StatusCode::UNAUTHORIZED,
                Json(json_error("Session expired")),
            )
                .into_response()),
        },
        None => Err((
            StatusCode::UNAUTHORIZED,
            Json(json_error("Authentication required")),
        )
            .into_response()),
    }
}
