use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use rand::{distributions::Alphanumeric, Rng};
use sqlite::{Connection, State};
use std::fs;
use thiserror::Error;
use sha2::{Sha256, Digest};

// Define the Paste struct
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Paste {
    pub id: String,
    pub data: String,
    pub language: String,
    pub created_at: DateTime<Utc>,
    pub encryption_version: u8,
    pub burn_after_read: bool,
    pub expires_at: Option<DateTime<Utc>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub edit_key: Option<String>, // Only returned on creation, never stored in plain text
    #[serde(skip_serializing_if = "Option::is_none")]
    pub edit_key_hash: Option<String>, // Only returned for admin listing
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub paste_type: Option<String>, // "paste" or "workspace", populated in admin queries
}

// Data structure for creating a new paste
#[derive(Debug, Deserialize)]
pub struct CreatePasteData {
    pub data: String,
    pub language: String,
    #[serde(default)]
    pub burn_after_read: bool,
    #[serde(default)]
    pub expires_in_minutes: Option<u32>,
}

// Data structure for updating a paste
#[derive(Debug, Deserialize)]
pub struct UpdatePasteData {
    pub data: String,
    pub language: String,
    pub edit_key: String,
}

// Data structure for deleting a paste
#[derive(Debug, Deserialize)]
pub struct DeletePasteData {
    pub edit_key: String,
}

// Database error type
#[derive(Error, Debug)]
pub enum DbError {
    #[error("SQLite error: {0}")]
    Sqlite(#[from] sqlite::Error),
    
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
    
    #[error("Serialization error: {0}")]
    Serialization(#[from] serde_json::Error),
    
    #[error("Client-side encryption required")]
    ClientEncryptionRequired,
    
    #[error("Character limit exceeded: {0} characters (maximum: {1})")]
    CharacterLimitExceeded(usize, usize),
    
    #[error("Paste with ID already exists")]
    PasteAlreadyExists,
    
    #[error("Invalid edit key")]
    InvalidEditKey,
    
    #[error("Paste not found")]
    PasteNotFound,
    
    #[error("Failed to generate unique ID after maximum retries")]
    IdGenerationFailed,
}

// Database struct
#[derive(Clone)]
pub struct Database {
    connection: Arc<Mutex<Connection>>,
}

impl std::fmt::Debug for Database {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("Database")
            .field("connection", &"<SQLite Connection>")
            .finish()
    }
}

// Internal struct for encrypted paste data
#[derive(Debug, Serialize, Deserialize)]
struct PasteData {
    title: String,
    data: String,
    language: String,
    description: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DailyPasteStats {
    pub date: String,
    pub count: i64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DashboardStats {
    pub total_pastes: i64,
    pub pending_expiration: i64,
    pub unread_pastes: i64,
    pub total_size: i64,
    pub language_stats: std::collections::HashMap<String, i64>,
    pub pastes_over_time: Vec<DailyPasteStats>,
}

// Encryption version constants
const ENCRYPTION_VERSION_CLIENT: u8 = 1;

// Maximum character limit for pastes
const MAX_PASTE_CHARACTERS: usize = 200000;

// Maximum retries for ID generation
const MAX_ID_GENERATION_RETRIES: u32 = 10;

// Base ID length
const BASE_ID_LENGTH: usize = 6;

// Maximum expiration time in minutes (1 week)
const MAX_EXPIRES_IN_MINUTES: u32 = 10080;

impl Database {
    // Helper function to get precise UTF-8 byte count
    fn get_utf8_byte_count(text: &str) -> usize {
        text.as_bytes().len()
    }
    
    // Generate a random alphanumeric ID
    fn generate_id(length: usize) -> String {
        rand::thread_rng()
            .sample_iter(&Alphanumeric)
            .take(length)
            .map(char::from)
            .collect()
    }
    
    // Hash an edit key for storage
    fn hash_edit_key(edit_key: &str) -> String {
        let mut hasher = Sha256::new();
        hasher.update(edit_key.as_bytes());
        let result = hasher.finalize();
        base64::encode(result)
    }
    
    // Verify an edit key matches the stored hash
    fn verify_edit_key(edit_key: &str, stored_hash: &str) -> bool {
        let computed_hash = Self::hash_edit_key(edit_key);
        computed_hash == stored_hash
    }
    
    // Check if a paste ID already exists
    fn paste_exists(&self, id: &str) -> Result<bool, DbError> {
        let conn = self.connection.lock().unwrap();
        let mut stmt = conn.prepare("SELECT 1 FROM pastes WHERE id = ? LIMIT 1")?;
        stmt.bind((1, id))?;
        Ok(matches!(stmt.next()?, State::Row))
    }
    
    // Generate a unique paste ID with collision detection
    fn generate_unique_id(&self) -> Result<String, DbError> {
        for retry in 0..MAX_ID_GENERATION_RETRIES {
            // Increase ID length with retries to reduce collision probability
            let length = BASE_ID_LENGTH + (retry as usize);
            let id = Self::generate_id(length);
            
            if !self.paste_exists(&id)? {
                return Ok(id);
            }
            
            tracing::warn!("ID collision detected for '{}', retry {} with length {}", id, retry + 1, length + 1);
        }
        
        Err(DbError::IdGenerationFailed)
    }

    pub fn new() -> Self {
        // Ensure data directory exists
        let data_dir = PathBuf::from("data");
        fs::create_dir_all(&data_dir).expect("Failed to create data directory");
        
        // Initialize database connection
        let db_path = data_dir.join("pastes.db");
        let connection = Connection::open(db_path).expect("Failed to open database");
        
        // Enable foreign keys and WAL mode
        connection.execute("PRAGMA foreign_keys = ON;").expect("Failed to set foreign_keys pragma");
        connection.execute("PRAGMA journal_mode = WAL;").expect("Failed to set journal_mode pragma");
        // Wait (instead of failing with SQLITE_BUSY) if the DB is briefly locked,
        // and use the WAL-appropriate sync level (durable across app crashes,
        // fsync only at checkpoints).
        connection.execute("PRAGMA busy_timeout = 5000;").expect("Failed to set busy_timeout pragma");
        connection.execute("PRAGMA synchronous = NORMAL;").expect("Failed to set synchronous pragma");
        
        // Create tables if they don't exist (includes all columns)
        connection.execute("
            CREATE TABLE IF NOT EXISTS pastes (
                id TEXT PRIMARY KEY,
                data TEXT NOT NULL,
                language TEXT NOT NULL,
                created_at INTEGER NOT NULL,
                encryption_version INTEGER NOT NULL DEFAULT 0,
                edit_key_hash TEXT,
                burn_after_read INTEGER NOT NULL DEFAULT 0,
                expires_at INTEGER
            );
        ").expect("Failed to create pastes table");
        
        // Migration: Add columns if they don't exist
        let _ = connection.execute("ALTER TABLE pastes ADD COLUMN edit_key_hash TEXT;");
        let _ = connection.execute("ALTER TABLE pastes ADD COLUMN burn_after_read INTEGER NOT NULL DEFAULT 0;");
        let _ = connection.execute("ALTER TABLE pastes ADD COLUMN expires_at INTEGER;");
        
        connection.execute("
            CREATE INDEX IF NOT EXISTS idx_pastes_created_at ON pastes(created_at DESC);
        ").expect("Failed to create index");

        // Migration: Add type column for workspace support
        let _ = connection.execute("ALTER TABLE pastes ADD COLUMN type TEXT NOT NULL DEFAULT 'paste';");
        connection.execute("CREATE INDEX IF NOT EXISTS idx_type ON pastes(type);").expect("Failed to create type index");

        // Index for the periodic expired-row purge (see purge_expired)
        connection.execute("CREATE INDEX IF NOT EXISTS idx_pastes_expires_at ON pastes(expires_at);").expect("Failed to create expires_at index");

        Self {
            connection: Arc::new(Mutex::new(connection)),
        }
    }
    
    // Store client-encrypted paste with edit key
    fn store_client_encrypted_paste(
        &self,
        id: String,
        data: String,
        language: String,
        created_at: DateTime<Utc>,
        edit_key_hash: String,
        burn_after_read: bool,
        expires_at: Option<i64>,
        record_type: &str,
    ) -> Result<Paste, DbError> {
        let timestamp = created_at.timestamp() as i64;
        let burn_flag = if burn_after_read { 1 } else { 0 };

        // Insert into database
        let conn = self.connection.lock().unwrap();
        let mut stmt = conn.prepare(
            "INSERT INTO pastes (id, data, language, created_at, encryption_version, edit_key_hash, burn_after_read, expires_at, type) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
        )?;

        // Bind parameters
        stmt.bind((1, id.as_str()))?;
        stmt.bind((2, data.as_str()))?;
        stmt.bind((3, language.as_str()))?;
        stmt.bind((4, timestamp.to_string().as_str()))?;
        stmt.bind((5, ENCRYPTION_VERSION_CLIENT.to_string().as_str()))?;
        stmt.bind((6, edit_key_hash.as_str()))?;
        stmt.bind((7, burn_flag.to_string().as_str()))?;

        // Handle optional expires_at
        if let Some(exp) = expires_at {
            stmt.bind((8, exp.to_string().as_str()))?;
        } else {
            stmt.bind((8, sqlite::Value::Null))?;
        }

        stmt.bind((9, record_type))?;

        stmt.next()?;

        Ok(Paste {
            id,
            data: String::new(), // Don't return the encrypted data on creation
            language,
            created_at,
            encryption_version: ENCRYPTION_VERSION_CLIENT,
            burn_after_read,
            expires_at: expires_at.map(|ts| DateTime::from_timestamp(ts, 0).unwrap_or_else(|| Utc::now())),
            edit_key: None, // Will be set by caller
            edit_key_hash: None,
            paste_type: None,
        })
    }

    pub fn create_paste(&self, paste_data: CreatePasteData) -> Result<Paste, DbError> {
        // Check character limit before processing - using explicit UTF-8 byte count
        let byte_count = Self::get_utf8_byte_count(&paste_data.data);
        
        tracing::debug!("Paste data length (bytes): {}", byte_count);
        
        if byte_count > MAX_PASTE_CHARACTERS {
            return Err(DbError::CharacterLimitExceeded(byte_count, MAX_PASTE_CHARACTERS));
        }
        
        if paste_data.data.is_empty() {
            return Err(DbError::ClientEncryptionRequired);
        }
        
        // Validate expiration time (max 1 week = 10080 minutes)
        let expires_at = if let Some(minutes) = paste_data.expires_in_minutes {
            if minutes == 0 || minutes > MAX_EXPIRES_IN_MINUTES {
                return Err(DbError::CharacterLimitExceeded(minutes as usize, MAX_EXPIRES_IN_MINUTES as usize));
            }
            let expires_timestamp = Utc::now().timestamp() + (minutes as i64 * 60);
            Some(expires_timestamp)
        } else {
            None
        };
        
        // Generate unique ID with collision detection
        let id = self.generate_unique_id()?;
        
        // Generate edit key (32 bytes, base64 encoded)
        let edit_key = Self::generate_id(32);
        let edit_key_hash = Self::hash_edit_key(&edit_key);

        let now = Utc::now();
        
        // Store the client-encrypted paste with edit key hash and advanced options
        let mut paste = self.store_client_encrypted_paste(
            id,
            paste_data.data,
            paste_data.language,
            now,
            edit_key_hash,
            paste_data.burn_after_read,
            expires_at,
            "paste",
        )?;
        
        // Set the edit key on the returned paste (only on creation)
        paste.edit_key = Some(edit_key);

        Ok(paste)
    }

    pub fn get_encrypted_paste(&self, id: &str) -> Option<(String, String, DateTime<Utc>)> {
        let conn = self.connection.lock().unwrap();
        
        let mut stmt = conn.prepare("SELECT data, language, created_at, encryption_version FROM pastes WHERE id = ?")
            .ok()?;
            
        stmt.bind((1, id)).ok()?;
        
        if let State::Row = stmt.next().ok()? {
            let data = stmt.read::<String, _>(0).ok()?;
            let language = stmt.read::<String, _>(1).ok()?;
            let created_at = stmt.read::<i64, _>(2).ok()?;
            let encryption_version = stmt.read::<i64, _>(3).ok().unwrap_or(0) as u8;
            
            // Only return the encrypted data for client-side decryption
            if encryption_version == ENCRYPTION_VERSION_CLIENT {
                let timestamp = DateTime::from_timestamp(created_at, 0).unwrap_or_else(|| Utc::now());
                return Some((data, language, timestamp));
            }
        }
        
        None
    }

    /// Delete a row by id using an already-locked connection.
    /// Returns whether a row was actually removed.
    fn delete_row_locked(conn: &Connection, id: &str) -> Result<bool, DbError> {
        {
            let mut stmt = conn.prepare("DELETE FROM pastes WHERE id = ?")?;
            stmt.bind((1, id))?;
            stmt.next()?;
        }
        Ok(conn.change_count() > 0)
    }

    /// Read a paste/workspace row and apply expiry + burn-after-read atomically.
    ///
    /// The SELECT and any resulting DELETE run under a single lock acquisition
    /// inside one IMMEDIATE transaction, so two concurrent reads of a
    /// burn-after-read row can never both receive its data.
    ///
    /// Returns (data, language, created_at, burn_after_read, expires_at).
    fn take_row(
        &self,
        id: &str,
        record_type: &str,
    ) -> Option<(String, String, DateTime<Utc>, bool, Option<i64>)> {
        let conn = self.connection.lock().unwrap();

        if let Err(e) = conn.execute("BEGIN IMMEDIATE;") {
            tracing::error!("Failed to begin read transaction for {}: {}", id, e);
            return None;
        }

        let result = Self::take_row_in_tx(&conn, id, record_type);

        let finish = if result.is_ok() { "COMMIT;" } else { "ROLLBACK;" };
        if let Err(e) = conn.execute(finish) {
            tracing::error!("Failed to finish read transaction for {}: {}", id, e);
            let _ = conn.execute("ROLLBACK;");
            return None;
        }

        match result {
            Ok(row) => row,
            Err(e) => {
                tracing::error!("Database error reading {}: {}", id, e);
                None
            }
        }
    }

    fn take_row_in_tx(
        conn: &Connection,
        id: &str,
        record_type: &str,
    ) -> Result<Option<(String, String, DateTime<Utc>, bool, Option<i64>)>, DbError> {
        let (data, language, created_at_ts, encryption_version, burn_after_read, expires_at) = {
            let mut stmt = conn.prepare(
                "SELECT data, language, created_at, encryption_version, burn_after_read, expires_at \
                 FROM pastes WHERE id = ? AND type = ?",
            )?;
            stmt.bind((1, id))?;
            stmt.bind((2, record_type))?;

            if let State::Row = stmt.next()? {
                (
                    stmt.read::<String, _>(0)?,
                    stmt.read::<String, _>(1)?,
                    stmt.read::<i64, _>(2)?,
                    stmt.read::<i64, _>(3).ok().unwrap_or(0) as u8,
                    stmt.read::<i64, _>(4).ok().unwrap_or(0) != 0,
                    stmt.read::<Option<i64>, _>(5).ok().flatten(),
                )
            } else {
                return Ok(None);
            }
        };

        if encryption_version != ENCRYPTION_VERSION_CLIENT {
            return Ok(None);
        }

        // Expired: delete and report as not found
        if let Some(exp_ts) = expires_at {
            if Utc::now().timestamp() > exp_ts {
                Self::delete_row_locked(conn, id)?;
                return Ok(None);
            }
        }

        // Burn after read: only the reader whose DELETE removed the row gets the data
        if burn_after_read && !Self::delete_row_locked(conn, id)? {
            return Ok(None);
        }

        let created_at = DateTime::from_timestamp(created_at_ts, 0).unwrap_or_else(|| Utc::now());
        Ok(Some((data, language, created_at, burn_after_read, expires_at)))
    }

    /// Delete all rows whose expiration time has passed. Returns rows removed.
    pub fn purge_expired(&self) -> Result<usize, DbError> {
        let conn = self.connection.lock().unwrap();
        {
            let mut stmt = conn.prepare(
                "DELETE FROM pastes WHERE expires_at IS NOT NULL AND expires_at < ?",
            )?;
            stmt.bind((1, Utc::now().timestamp()))?;
            stmt.next()?;
        }
        Ok(conn.change_count())
    }

    pub fn get_paste(&self, id: &str) -> Option<Paste> {
        let (encrypted_data, language, created_at, burn_after_read, expires_at) =
            self.take_row(id, "paste")?;

        Some(Paste {
            id: id.to_string(),
            data: encrypted_data,
            language,
            created_at,
            encryption_version: ENCRYPTION_VERSION_CLIENT,
            burn_after_read,
            expires_at: expires_at.map(|ts| DateTime::from_timestamp(ts, 0).unwrap_or_else(|| Utc::now())),
            edit_key: None, // Never return edit key on get
            edit_key_hash: None,
            paste_type: None,
        })
    }
    
    pub fn update_paste(&self, id: &str, update_data: UpdatePasteData) -> Result<Paste, DbError> {
        // Check character limit
        let byte_count = Self::get_utf8_byte_count(&update_data.data);
        if byte_count > MAX_PASTE_CHARACTERS {
            return Err(DbError::CharacterLimitExceeded(byte_count, MAX_PASTE_CHARACTERS));
        }
        
        if update_data.data.is_empty() {
            return Err(DbError::ClientEncryptionRequired);
        }
        
        let conn = self.connection.lock().unwrap();
        
        // First, get the stored edit_key_hash and other metadata
        let mut stmt = conn.prepare("SELECT edit_key_hash, created_at, burn_after_read, expires_at FROM pastes WHERE id = ? AND type = 'paste'")?;
        stmt.bind((1, id))?;
        
        let (stored_hash, created_at, burn_after_read, expires_at) = if let State::Row = stmt.next()? {
            let hash: Option<String> = stmt.read::<Option<String>, _>(0).ok().flatten();
            let created_at = stmt.read::<i64, _>(1).unwrap_or(0);
            let burn_after_read = stmt.read::<i64, _>(2).unwrap_or(0) != 0;
            let expires_at_ts = stmt.read::<Option<i64>, _>(3).unwrap_or(None);
            
            let timestamp = DateTime::from_timestamp(created_at, 0).unwrap_or_else(|| Utc::now());
            let expires_at = expires_at_ts.map(|ts| DateTime::from_timestamp(ts, 0).unwrap_or_else(|| Utc::now()));
            
            match hash {
                Some(h) if !h.is_empty() => (h, timestamp, burn_after_read, expires_at),
                _ => return Err(DbError::InvalidEditKey), // No edit key set for this paste
            }
        } else {
            return Err(DbError::PasteNotFound);
        };
        
        // Verify the edit key
        if !Self::verify_edit_key(&update_data.edit_key, &stored_hash) {
            return Err(DbError::InvalidEditKey);
        }
        
        // Update the paste
        let mut update_stmt = conn.prepare("UPDATE pastes SET data = ?, language = ? WHERE id = ? AND type = 'paste'")?;
        update_stmt.bind((1, update_data.data.as_str()))?;
        update_stmt.bind((2, update_data.language.as_str()))?;
        update_stmt.bind((3, id))?;
        update_stmt.next()?;
        
        Ok(Paste {
            id: id.to_string(),
            data: String::new(),
            language: update_data.language,
            created_at,
            encryption_version: ENCRYPTION_VERSION_CLIENT,
            burn_after_read,
            expires_at,
            edit_key: None,
            edit_key_hash: None,
            paste_type: None,
        })
    }

    pub fn delete_paste(&self, id: &str) -> bool {
        let conn = self.connection.lock().unwrap();
        match Self::delete_row_locked(&conn, id) {
            Ok(deleted) => deleted,
            Err(e) => {
                tracing::error!("Failed to delete {}: {}", id, e);
                false
            }
        }
    }
    
    pub fn delete_paste_with_key(&self, id: &str, delete_data: DeletePasteData) -> Result<(), DbError> {
        let conn = self.connection.lock().unwrap();
        
        // First get the stored edit_key_hash
        let mut stmt = conn.prepare("SELECT edit_key_hash FROM pastes WHERE id = ? AND type = 'paste'")?;
        stmt.bind((1, id))?;
        
        if stmt.next()? != State::Row {
            return Err(DbError::PasteNotFound);
        }
        
        let stored_hash: String = stmt.read::<String, _>("edit_key_hash")?;
        
        // Verify the edit key
        if !Self::verify_edit_key(&delete_data.edit_key, &stored_hash) {
            return Err(DbError::InvalidEditKey);
        }
        
        // Delete the paste
        let mut delete_stmt = conn.prepare("DELETE FROM pastes WHERE id = ? AND type = 'paste'")?;
        delete_stmt.bind((1, id))?;
        delete_stmt.next()?;
        
        Ok(())
    }

    /// Retrieve dashboard statistics, optionally filtered by time range.
    ///
    /// Supports preset ranges (24h, 7d, 30d, 1y, all) and custom ranges
    /// with explicit start/end timestamps. All summary cards filter to
    /// the selected range.
    pub fn get_dashboard_stats(
        &self,
        range: &str,
        custom_start: Option<i64>,
        custom_end: Option<i64>,
    ) -> Result<DashboardStats, DbError> {
        let conn = self.connection.lock().unwrap();

        // Build the time filter WHERE clause for summary cards
        let time_filter = match range {
            "24h" => "WHERE created_at >= CAST(strftime('%s', 'now', '-24 hours') AS INTEGER)".to_string(),
            "7d" => "WHERE created_at >= CAST(strftime('%s', 'now', '-7 days') AS INTEGER)".to_string(),
            "30d" => "WHERE created_at >= CAST(strftime('%s', 'now', '-30 days') AS INTEGER)".to_string(),
            "1y" => "WHERE created_at >= CAST(strftime('%s', 'now', '-1 year') AS INTEGER)".to_string(),
            "custom" => {
                let s = custom_start.unwrap_or(0);
                let e = custom_end.unwrap_or(i64::MAX);
                format!("WHERE created_at >= {} AND created_at <= {}", s, e)
            }
            "all" => String::new(),
            _ => "WHERE created_at >= CAST(strftime('%s', 'now', '-7 days') AS INTEGER)".to_string(),
        };

        let total_pastes: i64 = conn
            .prepare(&format!("SELECT COUNT(*) FROM pastes {}", time_filter))?
            .into_iter()
            .map(|row| row.unwrap().read::<i64, _>(0))
            .next()
            .unwrap();

        let pending_expiration: i64 = conn
            .prepare(&format!(
                "SELECT COUNT(*) FROM pastes {} {} expires_at IS NOT NULL",
                time_filter,
                if time_filter.is_empty() { "WHERE" } else { "AND" }
            ))?
            .into_iter()
            .map(|row| row.unwrap().read::<i64, _>(0))
            .next()
            .unwrap();

        let unread_pastes: i64 = conn
            .prepare(&format!(
                "SELECT COUNT(*) FROM pastes {} {} burn_after_read = 1",
                time_filter,
                if time_filter.is_empty() { "WHERE" } else { "AND" }
            ))?
            .into_iter()
            .map(|row| row.unwrap().read::<i64, _>(0))
            .next()
            .unwrap();

        let total_size: i64 = conn
            .prepare(&format!(
                "SELECT COALESCE(SUM(LENGTH(data)), 0) FROM pastes {}",
                time_filter
            ))?
            .into_iter()
            .map(|row| row.unwrap().read::<i64, _>(0))
            .next()
            .unwrap_or(0);

        let mut language_stats = std::collections::HashMap::new();
        let lang_stmt = conn.prepare(&format!(
            "SELECT language, COUNT(*) FROM pastes {} GROUP BY language",
            time_filter
        ))?;
        for row in lang_stmt.into_iter() {
            let row = row?;
            let language = row.read::<&str, _>(0).to_string();
            let count = row.read::<i64, _>(1);
            language_stats.insert(language, count);
        }

        // Time-series query
        let mut pastes_over_time = Vec::new();

        let time_query = match range {
            "24h" => format!(
                "SELECT strftime('%Y-%m-%d %H:00', datetime(created_at, 'unixepoch')) as date, COUNT(*) as count \
                 FROM pastes {} GROUP BY date ORDER BY date ASC",
                time_filter
            ),
            "7d" | "30d" => format!(
                "SELECT date(datetime(created_at, 'unixepoch')) as date, COUNT(*) as count \
                 FROM pastes {} GROUP BY date ORDER BY date ASC",
                time_filter
            ),
            "custom" => {
                let span = custom_end.unwrap_or(0) - custom_start.unwrap_or(0);
                if span <= 172800 {
                    // <= 48 hours: hourly
                    format!(
                        "SELECT strftime('%Y-%m-%d %H:00', datetime(created_at, 'unixepoch')) as date, COUNT(*) as count \
                         FROM pastes {} GROUP BY date ORDER BY date ASC",
                        time_filter
                    )
                } else if span <= 7776000 {
                    // <= 90 days: daily
                    format!(
                        "SELECT date(datetime(created_at, 'unixepoch')) as date, COUNT(*) as count \
                         FROM pastes {} GROUP BY date ORDER BY date ASC",
                        time_filter
                    )
                } else {
                    // > 90 days: monthly
                    format!(
                        "SELECT strftime('%Y-%m', datetime(created_at, 'unixepoch')) as date, COUNT(*) as count \
                         FROM pastes {} GROUP BY date ORDER BY date ASC",
                        time_filter
                    )
                }
            }
            _ => format!(
                "SELECT strftime('%Y-%m', datetime(created_at, 'unixepoch')) as date, COUNT(*) as count \
                 FROM pastes {} GROUP BY date ORDER BY date ASC",
                time_filter
            ),
        };

        let time_stmt = conn.prepare(&time_query)?;
        for row in time_stmt.into_iter() {
            let row = row?;
            let date = row.read::<&str, _>(0).to_string();
            let count = row.read::<i64, _>(1);
            pastes_over_time.push(DailyPasteStats { date, count });
        }

        Ok(DashboardStats {
            total_pastes,
            pending_expiration,
            unread_pastes,
            total_size,
            language_stats,
            pastes_over_time,
        })
    }
    
    pub fn list_pastes(&self, limit: i64, offset: i64) -> Result<Vec<Paste>, DbError> {
        let conn = self.connection.lock().unwrap();
        
        let mut stmt = conn.prepare("
            SELECT id, data, language, created_at, encryption_version, burn_after_read, expires_at, edit_key_hash 
            FROM pastes 
            ORDER BY created_at DESC 
            LIMIT ? OFFSET ?
        ")?;
        
        stmt.bind((1, limit))?;
        stmt.bind((2, offset))?;
        
        let mut pastes = Vec::new();
        
        for row in stmt.into_iter() {
            let row = row?;
            let id = row.read::<&str, _>("id").to_string();
            let data = row.read::<&str, _>("data").to_string();
            let language = row.read::<&str, _>("language").to_string();
            let created_at_ts = row.read::<i64, _>("created_at");
            let encryption_version = row.read::<i64, _>("encryption_version") as u8;
            let burn_after_read = row.read::<i64, _>("burn_after_read") != 0;
            let expires_at_ts = row.read::<Option<i64>, _>("expires_at");
            let edit_key_hash: Option<String> = row.read::<Option<&str>, _>("edit_key_hash").map(|s| s.to_string());
            
            let created_at = DateTime::from_timestamp(created_at_ts, 0).unwrap_or_else(|| Utc::now());
            let expires_at = expires_at_ts.map(|ts| DateTime::from_timestamp(ts, 0).unwrap_or_else(|| Utc::now()));
            
            pastes.push(Paste {
                id,
                data, // Encrypted data
                language,
                created_at,
                encryption_version,
                burn_after_read,
                expires_at,
                edit_key: None,
                edit_key_hash,
                paste_type: None,
            });
        }
        
        Ok(pastes)
    }

    pub fn delete_paste_admin(&self, id: &str) -> Result<(), DbError> {
        if self.delete_paste(id) {
            Ok(())
        } else {
            Err(DbError::PasteNotFound)
        }
    }

    /// List pastes with dynamic filters, sorting, and pagination.
    ///
    /// Returns ((paste, size_bytes) pairs, total_count). The paste `data`
    /// field is left empty; only its length is fetched.
    pub fn list_pastes_filtered(
        &self,
        params: &crate::models::admin::PasteFilterParams,
        limit: i64,
        offset: i64,
    ) -> Result<(Vec<(Paste, i64)>, i64), DbError> {
        let conn = self.connection.lock().unwrap();

        // Build dynamic WHERE clause
        let mut conditions: Vec<String> = Vec::new();
        let mut bind_values: Vec<sqlite::Value> = Vec::new();

        if let Some(ref lang) = params.language {
            conditions.push("language = ?".to_string());
            bind_values.push(sqlite::Value::String(lang.clone()));
        }
        if let Some(ref pt) = params.paste_type {
            conditions.push("type = ?".to_string());
            bind_values.push(sqlite::Value::String(pt.clone()));
        }
        if let Some(burn) = params.burn {
            conditions.push("burn_after_read = ?".to_string());
            bind_values.push(sqlite::Value::Integer(if burn { 1 } else { 0 }));
        }
        if let Some(has_exp) = params.expiration {
            if has_exp {
                conditions.push("expires_at IS NOT NULL".to_string());
            } else {
                conditions.push("expires_at IS NULL".to_string());
            }
        }
        if let Some(start) = params.start_date {
            conditions.push("created_at >= ?".to_string());
            bind_values.push(sqlite::Value::Integer(start));
        }
        if let Some(end) = params.end_date {
            conditions.push("created_at <= ?".to_string());
            bind_values.push(sqlite::Value::Integer(end));
        }
        if let Some(ref search) = params.search {
            if search.contains('%') || search.contains('_') {
                conditions.push("id LIKE ?".to_string());
                bind_values.push(sqlite::Value::String(search.clone()));
            } else {
                // Try exact match first, fallback to contains
                conditions.push("id LIKE ?".to_string());
                bind_values.push(sqlite::Value::String(
                    format!("%{}%", search),
                ));
            }
        }

        let where_clause = if conditions.is_empty() {
            String::new()
        } else {
            format!("WHERE {}", conditions.join(" AND "))
        };

        // Whitelist sort columns
        let valid_sorts = [
            "id", "language", "created_at", "type",
            "burn_after_read", "expires_at",
        ];
        let sort_col = if valid_sorts.contains(&params.sort.as_str()) {
            // "size" sorts by data length
            params.sort.as_str()
        } else if params.sort == "size" {
            "LENGTH(data)"
        } else {
            "created_at"
        };
        let sort_dir = if params.order.to_uppercase() == "ASC" {
            "ASC"
        } else {
            "DESC"
        };

        // Count query
        let count_sql = format!("SELECT COUNT(*) FROM pastes {}", where_clause);
        let mut count_stmt = conn.prepare(&count_sql)?;
        for (i, val) in bind_values.iter().enumerate() {
            count_stmt.bind((i + 1, val))?;
        }
        let total: i64 = count_stmt
            .into_iter()
            .map(|row| row.unwrap().read::<i64, _>(0))
            .next()
            .unwrap_or(0);

        // Data query
        let data_sql = format!(
            "SELECT id, LENGTH(data) AS size, language, created_at, encryption_version, \
             burn_after_read, expires_at, edit_key_hash, type \
             FROM pastes {} ORDER BY {} {} LIMIT ? OFFSET ?",
            where_clause, sort_col, sort_dir
        );
        let mut data_stmt = conn.prepare(&data_sql)?;

        let bind_count = bind_values.len();
        for (i, val) in bind_values.iter().enumerate() {
            data_stmt.bind((i + 1, val))?;
        }
        data_stmt.bind((bind_count + 1, limit))?;
        data_stmt.bind((bind_count + 2, offset))?;

        let mut pastes = Vec::new();
        for row in data_stmt.into_iter() {
            let row = row?;
            let id = row.read::<&str, _>("id").to_string();
            let size = row.read::<i64, _>("size");
            let language = row.read::<&str, _>("language").to_string();
            let created_at_ts = row.read::<i64, _>("created_at");
            let enc_ver = row.read::<i64, _>("encryption_version") as u8;
            let burn = row.read::<i64, _>("burn_after_read") != 0;
            let expires_ts = row.read::<Option<i64>, _>("expires_at");
            let edit_hash: Option<String> = row
                .read::<Option<&str>, _>("edit_key_hash")
                .map(|s| s.to_string());
            let ptype = row.read::<&str, _>("type").to_string();

            let created_at = DateTime::from_timestamp(created_at_ts, 0)
                .unwrap_or_else(|| Utc::now());
            let expires_at = expires_ts
                .map(|ts| DateTime::from_timestamp(ts, 0).unwrap_or_else(|| Utc::now()));

            pastes.push((Paste {
                id,
                data: String::new(),
                language,
                created_at,
                encryption_version: enc_ver,
                burn_after_read: burn,
                expires_at,
                edit_key: None,
                edit_key_hash: edit_hash,
                paste_type: Some(ptype),
            }, size));
        }

        Ok((pastes, total))
    }

    /// Bulk delete pastes by IDs.
    ///
    /// Returns (deleted_count, not_found_ids).
    pub fn bulk_delete_pastes(
        &self,
        ids: &[String],
    ) -> Result<(usize, Vec<String>), DbError> {
        let mut deleted = 0usize;
        let mut not_found = Vec::new();

        for id in ids {
            if self.delete_paste(id) {
                deleted += 1;
            } else {
                not_found.push(id.clone());
            }
        }

        Ok((deleted, not_found))
    }

    // ---- Workspace functions ----

    pub fn create_workspace(
        &self,
        data: String,
        burn_after_read: bool,
        expires_in_minutes: Option<u32>,
    ) -> Result<Paste, DbError> {
        // Check character limit
        let byte_count = Self::get_utf8_byte_count(&data);
        if byte_count > MAX_PASTE_CHARACTERS {
            return Err(DbError::CharacterLimitExceeded(byte_count, MAX_PASTE_CHARACTERS));
        }

        if data.is_empty() {
            return Err(DbError::ClientEncryptionRequired);
        }

        // Validate expiration time
        let expires_at = if let Some(minutes) = expires_in_minutes {
            if minutes == 0 || minutes > MAX_EXPIRES_IN_MINUTES {
                return Err(DbError::CharacterLimitExceeded(minutes as usize, MAX_EXPIRES_IN_MINUTES as usize));
            }
            let expires_timestamp = Utc::now().timestamp() + (minutes as i64 * 60);
            Some(expires_timestamp)
        } else {
            None
        };

        let id = self.generate_unique_id()?;
        let edit_key = Self::generate_id(32);
        let edit_key_hash = Self::hash_edit_key(&edit_key);
        let now = Utc::now();

        let mut paste = self.store_client_encrypted_paste(
            id,
            data,
            "workspace".to_string(),
            now,
            edit_key_hash,
            burn_after_read,
            expires_at,
            "workspace",
        )?;

        paste.edit_key = Some(edit_key);
        Ok(paste)
    }

    pub fn get_workspace(&self, id: &str) -> Option<Paste> {
        let (encrypted_data, _language, created_at, burn_after_read, expires_at) =
            self.take_row(id, "workspace")?;

        Some(Paste {
            id: id.to_string(),
            data: encrypted_data,
            language: "workspace".to_string(),
            created_at,
            encryption_version: ENCRYPTION_VERSION_CLIENT,
            burn_after_read,
            expires_at: expires_at.map(|ts| DateTime::from_timestamp(ts, 0).unwrap_or_else(|| Utc::now())),
            edit_key: None,
            edit_key_hash: None,
            paste_type: None,
        })
    }

    pub fn update_workspace(&self, id: &str, data: String, edit_key: String) -> Result<Paste, DbError> {
        let byte_count = Self::get_utf8_byte_count(&data);
        if byte_count > MAX_PASTE_CHARACTERS {
            return Err(DbError::CharacterLimitExceeded(byte_count, MAX_PASTE_CHARACTERS));
        }

        if data.is_empty() {
            return Err(DbError::ClientEncryptionRequired);
        }

        let conn = self.connection.lock().unwrap();

        let mut stmt = conn.prepare("SELECT edit_key_hash, created_at, burn_after_read, expires_at FROM pastes WHERE id = ? AND type = 'workspace'")?;
        stmt.bind((1, id))?;

        let (stored_hash, created_at, burn_after_read, expires_at) = if let State::Row = stmt.next()? {
            let hash: Option<String> = stmt.read::<Option<String>, _>(0).ok().flatten();
            let created_at = stmt.read::<i64, _>(1).unwrap_or(0);
            let burn_after_read = stmt.read::<i64, _>(2).unwrap_or(0) != 0;
            let expires_at_ts = stmt.read::<Option<i64>, _>(3).unwrap_or(None);

            let timestamp = DateTime::from_timestamp(created_at, 0).unwrap_or_else(|| Utc::now());
            let expires_at = expires_at_ts.map(|ts| DateTime::from_timestamp(ts, 0).unwrap_or_else(|| Utc::now()));

            match hash {
                Some(h) if !h.is_empty() => (h, timestamp, burn_after_read, expires_at),
                _ => return Err(DbError::InvalidEditKey),
            }
        } else {
            return Err(DbError::PasteNotFound);
        };

        if !Self::verify_edit_key(&edit_key, &stored_hash) {
            return Err(DbError::InvalidEditKey);
        }

        let mut update_stmt = conn.prepare("UPDATE pastes SET data = ? WHERE id = ? AND type = 'workspace'")?;
        update_stmt.bind((1, data.as_str()))?;
        update_stmt.bind((2, id))?;
        update_stmt.next()?;

        Ok(Paste {
            id: id.to_string(),
            data: String::new(),
            language: "workspace".to_string(),
            created_at,
            encryption_version: ENCRYPTION_VERSION_CLIENT,
            burn_after_read,
            expires_at,
            edit_key: None,
            edit_key_hash: None,
            paste_type: None,
        })
    }

    pub fn delete_workspace_with_key(&self, id: &str, edit_key: &str) -> Result<(), DbError> {
        let conn = self.connection.lock().unwrap();

        let mut stmt = conn.prepare("SELECT edit_key_hash FROM pastes WHERE id = ? AND type = 'workspace'")?;
        stmt.bind((1, id))?;

        if stmt.next()? != State::Row {
            return Err(DbError::PasteNotFound);
        }

        let stored_hash: String = stmt.read::<String, _>("edit_key_hash")?;

        if !Self::verify_edit_key(edit_key, &stored_hash) {
            return Err(DbError::InvalidEditKey);
        }

        let mut delete_stmt = conn.prepare("DELETE FROM pastes WHERE id = ? AND type = 'workspace'")?;
        delete_stmt.bind((1, id))?;
        delete_stmt.next()?;

        Ok(())
    }
}