mod auth;
mod db;
mod error;
mod handlers;
mod health;
mod models;

use axum::{
    Json, Router,
    extract::State,
    http::{HeaderMap, HeaderValue, Method, Request, StatusCode},
    middleware::{self, Next},
    response::{IntoResponse, Response},
    routing::{delete, get, post, put},
};
use db::Database;
use std::collections::HashMap;
use std::env;
use std::net::IpAddr;
use std::net::SocketAddr;
use std::sync::Arc;
use std::sync::Mutex;
use std::time::{Duration, Instant};
use tower_http::cors::CorsLayer;
use tower_http::services::ServeDir;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

use auth::require_admin_auth;
use error::json_error;
use handlers::admin::{
    admin_bulk_delete, admin_delete_paste, admin_list_pastes, admin_login, admin_logout,
    admin_stats,
};
use handlers::paste::{create_paste, delete_paste, get_paste, update_paste};
use handlers::workspace::{create_workspace, delete_workspace, get_workspace, update_workspace};
use health::HealthChecker;

// Define a simple rate limiter for our application
struct AppRateLimiter {
    // Rate limiter for GET requests (most permissive)
    read_limiter: Arc<Mutex<HashMap<IpAddr, u32>>>,
    // Rate limiter for POST requests (more restrictive)
    create_limiter: Arc<Mutex<HashMap<IpAddr, u32>>>,
    // Rate limiter for DELETE requests (most restrictive)
    delete_limiter: Arc<Mutex<HashMap<IpAddr, u32>>>,
    // Rate limiter for PUT requests (same as create)
    update_limiter: Arc<Mutex<HashMap<IpAddr, u32>>>,
    // Limits
    read_limit: u32,
    create_limit: u32,
    delete_limit: u32,
    update_limit: u32,
    // Last reset time
    last_reset: Arc<Mutex<Instant>>,
    // Reset interval (1 minute)
    reset_interval: Duration,
}

impl AppRateLimiter {
    fn new(read_limit: u32, create_limit: u32, delete_limit: u32, update_limit: u32) -> Self {
        Self {
            read_limiter: Arc::new(Mutex::new(HashMap::new())),
            create_limiter: Arc::new(Mutex::new(HashMap::new())),
            delete_limiter: Arc::new(Mutex::new(HashMap::new())),
            update_limiter: Arc::new(Mutex::new(HashMap::new())),
            read_limit,
            create_limit,
            delete_limit,
            update_limit,
            last_reset: Arc::new(Mutex::new(Instant::now())),
            reset_interval: Duration::from_secs(60),
        }
    }

    fn check_and_update(&self, ip: &IpAddr, method: &Method) -> Result<u32, u32> {
        // Check if we need to reset counters
        let now = Instant::now();
        let mut last_reset = self.last_reset.lock().unwrap();
        if now.duration_since(*last_reset) >= self.reset_interval {
            // Reset all counters
            self.read_limiter.lock().unwrap().clear();
            self.create_limiter.lock().unwrap().clear();
            self.delete_limiter.lock().unwrap().clear();
            self.update_limiter.lock().unwrap().clear();
            *last_reset = now;
        }

        // Choose the appropriate limiter based on the HTTP method
        let (limiter, limit) = match method {
            &Method::GET => (&self.read_limiter, self.read_limit),
            &Method::POST => (&self.create_limiter, self.create_limit),
            &Method::DELETE => (&self.delete_limiter, self.delete_limit),
            &Method::PUT => (&self.update_limiter, self.update_limit),
            _ => (&self.read_limiter, self.read_limit), // Default to read limiter for other methods
        };

        // Get the current count for this IP
        let mut map = limiter.lock().unwrap();
        let count = map.entry(*ip).or_insert(0);

        // Check if we're over the limit
        if *count >= limit {
            // Calculate remaining time until reset
            let elapsed = now.duration_since(*last_reset);
            let remaining = self.reset_interval.saturating_sub(elapsed).as_secs();

            // Return error with remaining time
            Err(remaining as u32)
        } else {
            // Increment the counter
            *count += 1;

            // Return remaining requests
            Ok(limit - *count)
        }
    }

    fn get_reset_time(&self) -> u32 {
        let now = Instant::now();
        let last_reset = *self.last_reset.lock().unwrap();
        let elapsed = now.duration_since(last_reset);
        self.reset_interval.saturating_sub(elapsed).as_secs() as u32
    }
}

fn add_rate_limit_headers(headers: &mut HeaderMap, remaining: u32, reset_after_secs: u32) {
    headers.insert(
        "x-ratelimit-remaining",
        HeaderValue::from_str(&remaining.to_string()).unwrap(),
    );
    headers.insert(
        "x-ratelimit-reset",
        HeaderValue::from_str(&reset_after_secs.to_string()).unwrap(),
    );
}

/// True for addresses that can only be a hop inside our own deployment
/// (Docker bridge network, loopback, private LAN). Only such peers are
/// trusted to tell us the real client address.
fn is_internal_peer(ip: &IpAddr) -> bool {
    match ip.to_canonical() {
        IpAddr::V4(v4) => v4.is_private() || v4.is_loopback(),
        // ::1, and unique-local fc00::/7
        IpAddr::V6(v6) => v6.is_loopback() || (v6.segments()[0] & 0xfe00) == 0xfc00,
    }
}

/// Resolve the client IP used for rate limiting.
///
/// In production bin is only reachable through nginx (no published host
/// port), so the TCP peer is always nginx's Docker IP. When the peer is an
/// internal address, use the `X-Real-IP` header nginx sets (Cloudflare's
/// CF-Connecting-IP, already validated by nginx's real_ip module). A peer on a
/// public address is talking to us directly, so its header is ignored.
fn client_ip(req: &Request<axum::body::Body>) -> IpAddr {
    let peer = req
        .extensions()
        .get::<axum::extract::ConnectInfo<SocketAddr>>()
        .map(|connect_info| connect_info.0.ip())
        .unwrap_or(IpAddr::from([0, 0, 0, 0]));

    if is_internal_peer(&peer) {
        if let Some(real) = req
            .headers()
            .get("x-real-ip")
            .and_then(|v| v.to_str().ok())
            .and_then(|v| v.trim().parse::<IpAddr>().ok())
        {
            return real.to_canonical();
        }
    }

    peer.to_canonical()
}

/// Apply `limiter` to the request, counting it against the bucket for
/// `bucket` (GET = read, POST = create, DELETE = delete, PUT = update).
async fn apply_rate_limit(
    limiter: Arc<AppRateLimiter>,
    health_checker: Option<Arc<HealthChecker>>,
    bucket: Method,
    limited_message: &str,
    req: Request<axum::body::Body>,
    next: Next,
) -> Result<Response, StatusCode> {
    let ip = client_ip(&req);

    match limiter.check_and_update(&ip, &bucket) {
        Ok(remaining) => {
            // Request is allowed, proceed to the next middleware or handler
            let mut response = next.run(req).await;

            // Record DB/server errors for health monitoring
            if response.status().is_server_error() {
                if let Some(hc) = health_checker {
                    hc.record_db_error();
                }
            }

            let reset_after = limiter.get_reset_time();
            add_rate_limit_headers(response.headers_mut(), remaining, reset_after);
            Ok(response)
        }
        Err(reset_after) => {
            let error_message = format!("{}. Try again in {} seconds", limited_message, reset_after);
            let mut response = (
                StatusCode::TOO_MANY_REQUESTS,
                Json(json_error(&error_message)),
            )
                .into_response();
            add_rate_limit_headers(response.headers_mut(), 0, reset_after);
            Ok(response)
        }
    }
}

// Public API rate limiting middleware (bucket chosen by HTTP method)
async fn rate_limit(req: Request<axum::body::Body>, next: Next) -> Result<Response, StatusCode> {
    let rate_limiter = req
        .extensions()
        .get::<Arc<AppRateLimiter>>()
        .expect("Rate limiter not added to request extensions")
        .clone();
    let health_checker = req.extensions().get::<Arc<HealthChecker>>().cloned();
    let method = req.method().clone();

    apply_rate_limit(rate_limiter, health_checker, method, "Rate limit exceeded", req, next).await
}

/// How often expired pastes/workspaces are purged from the database.
const EXPIRED_PURGE_INTERVAL: Duration = Duration::from_secs(300);

#[tokio::main]
async fn main() {
    // Initialize tracing
    tracing_subscriber::registry()
        .with(tracing_subscriber::EnvFilter::new(
            std::env::var("RUST_LOG").unwrap_or_else(|_| "info".into()),
        ))
        .with(tracing_subscriber::fmt::layer())
        .init();

    // Load environment variables
    dotenv::dotenv().ok();

    // Create database instance
    let db = Arc::new(Database::new());

    // Periodically purge expired rows. Reads already hide/delete expired
    // entries lazily, but rows that are never read again would otherwise
    // stay on disk forever. The SQLite work runs on the blocking pool.
    {
        let db = db.clone();
        tokio::spawn(async move {
            let mut interval = tokio::time::interval(EXPIRED_PURGE_INTERVAL);
            interval.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Delay);
            loop {
                interval.tick().await; // first tick fires immediately (startup sweep)
                let db = db.clone();
                match tokio::task::spawn_blocking(move || db.purge_expired()).await {
                    Ok(Ok(0)) => {}
                    Ok(Ok(n)) => tracing::info!("Purged {} expired paste(s)", n),
                    Ok(Err(e)) => tracing::warn!("Expired paste purge failed: {}", e),
                    Err(e) => tracing::error!("Expired paste purge task panicked: {}", e),
                }
            }
        });
    }

    // Create health checker
    let health_checker = Arc::new(HealthChecker::new("data/pastes.db".to_string()));

    // Get port from environment or use default
    let port = env::var("PORT")
        .unwrap_or_else(|_| "3000".to_string())
        .parse::<u16>()
        .expect("PORT must be a number");

    // Get allowed origins from environment variable or use defaults
    let allowed_origins_str = env::var("CORS_ALLOWED_ORIGINS")
        .unwrap_or_else(|_| "https://rustybin.net,https://rustyb.in,http://localhost:8080,http://localhost:5173,https://api.rustybin.net,https://api.rustyb.in".to_string());

    let allowed_origins: Vec<axum::http::HeaderValue> = allowed_origins_str
        .split(',')
        .map(|origin| {
            origin
                .trim()
                .parse()
                .expect(&format!("Invalid origin URL: {}", origin))
        })
        .collect();

    // Configure CORS
    let cors = CorsLayer::new()
        .allow_origin(allowed_origins)
        .allow_methods([
            axum::http::Method::GET,
            axum::http::Method::POST,
            axum::http::Method::PUT,
            axum::http::Method::DELETE,
            axum::http::Method::OPTIONS,
        ])
        .allow_headers([
            axum::http::header::CONTENT_TYPE,
            axum::http::header::AUTHORIZATION,
            axum::http::header::ACCEPT,
            axum::http::header::ORIGIN,
        ])
        .allow_credentials(true)
        .max_age(std::time::Duration::from_secs(3600));

    // Get rate limit configuration from environment variables or use defaults
    let read_limit = env::var("READ_RATE_LIMIT")
        .unwrap_or_else(|_| "45".to_string())
        .parse::<u32>()
        .unwrap_or(45);

    let create_limit = env::var("CREATE_RATE_LIMIT")
        .unwrap_or_else(|_| "15".to_string())
        .parse::<u32>()
        .unwrap_or(15);

    let delete_limit = env::var("DELETE_RATE_LIMIT")
        .unwrap_or_else(|_| "15".to_string())
        .parse::<u32>()
        .unwrap_or(15);

    let update_limit = env::var("UPDATE_RATE_LIMIT")
        .unwrap_or_else(|_| "15".to_string())
        .parse::<u32>()
        .unwrap_or(15);

    // Create rate limiter
    let rate_limiter = Arc::new(AppRateLimiter::new(
        read_limit,
        create_limit,
        delete_limit,
        update_limit,
    ));

    // Build our application with routes
    let config_state = Arc::new(ConfigInfo {
        read_limit,
        create_limit,
        update_limit,
        delete_limit,
        reset_interval_secs: 60,
    });

    let app = Router::new()
        .route(
            "/v1/health",
            get({
                let hc = health_checker.clone();
                move || health_check(hc)
            }),
        )
        .route(
            "/v1/config",
            get({
                let config = config_state.clone();
                move || get_config(config)
            }),
        )
        .route("/v1/pastes", post(create_paste))
        .route("/v1/pastes/{id}", get(get_paste))
        .route("/v1/pastes/{id}", put(update_paste))
        .route("/v1/pastes/{id}", delete(delete_paste))
        .route("/v1/workspaces", post(create_workspace))
        .route("/v1/workspaces/{id}", get(get_workspace))
        .route("/v1/workspaces/{id}", put(update_workspace))
        .route("/v1/workspaces/{id}", delete(delete_workspace))
        .with_state(db.clone())
        .layer(middleware::from_fn_with_state(
            (rate_limiter.clone(), health_checker.clone()),
            |State((limiter, hc)): State<(Arc<AppRateLimiter>, Arc<HealthChecker>)>,
             mut req: Request<axum::body::Body>,
             next: Next| async move {
                req.extensions_mut().insert(limiter);
                req.extensions_mut().insert(hc);
                rate_limit(req, next).await
            },
        ));

    // Admin rate limiter (separate from public API per FR-015)
    let admin_login_limit = env::var("ADMIN_LOGIN_RATE_LIMIT")
        .ok()
        .and_then(|v| v.parse().ok())
        .unwrap_or(5u32);
    let admin_read_limit = env::var("ADMIN_READ_RATE_LIMIT")
        .ok()
        .and_then(|v| v.parse().ok())
        .unwrap_or(60u32);
    let admin_delete_limit = env::var("ADMIN_DELETE_RATE_LIMIT")
        .ok()
        .and_then(|v| v.parse().ok())
        .unwrap_or(20u32);
    let admin_rate_limiter = Arc::new(AppRateLimiter::new(
        admin_read_limit,
        admin_login_limit,
        admin_delete_limit,
        admin_read_limit,
    ));

    // Conditionally register admin routes when ADMIN_SECRET is set
    let app = if env::var("ADMIN_SECRET").is_ok() {
        tracing::info!("Admin dashboard enabled at /v1/admin");
        tracing::info!("Admin rate limits: login={}/min, read={}/min, delete={}/min",
            admin_login_limit, admin_read_limit, admin_delete_limit);

        let admin_rl = admin_rate_limiter.clone();

        // Protected admin routes (require auth)
        let admin_protected = Router::new()
            .route("/v1/admin/stats", get(admin_stats))
            .route(
                "/v1/admin/pastes",
                get(admin_list_pastes).delete(admin_bulk_delete),
            )
            .route("/v1/admin/pastes/{id}", delete(admin_delete_paste))
            .route("/v1/admin/logout", post(admin_logout))
            .layer(middleware::from_fn(require_admin_auth))
            .with_state(db.clone())
            // Rate limit before auth so unauthenticated probing is limited too.
            // GET/logout count against the admin read limit, DELETE against
            // the admin delete limit.
            .layer(middleware::from_fn({
                let limiter = admin_rl.clone();
                let hc = health_checker.clone();
                move |req: Request<axum::body::Body>, next: Next| {
                    let limiter = limiter.clone();
                    let hc = hc.clone();
                    let bucket = if req.method() == Method::DELETE {
                        Method::DELETE
                    } else {
                        Method::GET
                    };
                    async move {
                        apply_rate_limit(limiter, Some(hc), bucket, "Too many admin requests", req, next)
                            .await
                    }
                }
            }));

        // Public admin routes (login - rate limited separately)
        let admin_rl_login = admin_rl.clone();
        let admin_public = Router::new()
            .route("/v1/admin/login", post(admin_login))
            .layer(middleware::from_fn(move |req: Request<axum::body::Body>, next: Next| {
                let limiter = admin_rl_login.clone();
                async move {
                    apply_rate_limit(limiter, None, Method::POST, "Too many login attempts", req, next)
                        .await
                }
            }));

        app.merge(admin_protected).merge(admin_public)
    } else {
        tracing::warn!("ADMIN_SECRET not set, admin dashboard is disabled");
        app
    };

    // Apply CORS after merging all routes so it covers admin endpoints too
    let app = app.layer(cors);

    // Add static file serving for production
    let app = if env::var("RUST_ENV").unwrap_or_default() == "production" {
        app.fallback_service(ServeDir::new("dist").fallback(axum::routing::get(serve_spa)))
    } else {
        app
    };

    // Define the address to listen on
    let addr = SocketAddr::from(([0, 0, 0, 0], port));
    tracing::info!("Listening on {}", addr);
    tracing::info!("CORS allowed origins: {}", allowed_origins_str);
    tracing::info!("Rate limiting enabled per IP:");
    tracing::info!("  - Read operations: {} per minute", read_limit);
    tracing::info!("  - Create operations: {} per minute", create_limit);
    tracing::info!("  - Update operations: {} per minute", update_limit);
    tracing::info!("  - Delete operations: {} per minute", delete_limit);

    // Start the server
    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    tracing::info!("Server started successfully");
    axum::serve(
        listener,
        app.into_make_service_with_connect_info::<SocketAddr>(),
    )
    .await
    .unwrap();
}

// Config info shared with frontend
struct ConfigInfo {
    read_limit: u32,
    create_limit: u32,
    update_limit: u32,
    delete_limit: u32,
    reset_interval_secs: u32,
}

// Health check endpoint
// only expose status, log details server-side
async fn health_check(health_checker: Arc<HealthChecker>) -> impl IntoResponse {
    // Disk stats are a blocking syscall; keep them off the async workers.
    let health = match tokio::task::spawn_blocking(move || health_checker.check()).await {
        Ok(h) => h,
        Err(e) => {
            tracing::error!("Health check task failed: {}", e);
            return (
                StatusCode::SERVICE_UNAVAILABLE,
                Json(serde_json::json!({ "status": "unhealthy" })),
            );
        }
    };
    let status_code = match health.status {
        "ok" => StatusCode::OK,
        "degraded" => StatusCode::OK,
        _ => StatusCode::SERVICE_UNAVAILABLE,
    };
    if health.status != "ok" {
        tracing::warn!(
            "Health check: {} (disk: {} {}, db: {} {})",
            health.status,
            health.checks.disk.status,
            health.checks.disk.message.as_deref().unwrap_or(""),
            health.checks.database.status,
            health.checks.database.message.as_deref().unwrap_or(""),
        );
    }
    (
        status_code,
        Json(serde_json::json!({ "status": health.status })),
    )
}

// Config endpoint - exposes rate limits
async fn get_config(config: Arc<ConfigInfo>) -> impl IntoResponse {
    Json(serde_json::json!({
        "rate_limits": {
            "reset_interval_secs": config.reset_interval_secs,
            "read": config.read_limit,
            "create": config.create_limit,
            "update": config.update_limit,
            "delete": config.delete_limit,
        }
    }))
}

// Fallback handler for SPA in production
async fn serve_spa() -> impl IntoResponse {
    (
        StatusCode::OK,
        axum::response::Html(
            std::fs::read_to_string("dist/index.html").unwrap_or_else(|_| {
                "<html><body><h1>Error loading SPA</h1></body></html>".to_string()
            }),
        ),
    )
}
