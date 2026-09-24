// Models are defined in db.rs since they're tightly coupled to the database layer.
// This module provides re-exports for cleaner imports.
pub use crate::db::{CreatePasteData, DeletePasteData, Paste, UpdatePasteData};

pub mod workspace;
pub use workspace::*;

pub mod admin;
