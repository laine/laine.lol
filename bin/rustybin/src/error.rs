use serde_json;

pub fn json_error(message: &str) -> serde_json::Value {
    serde_json::json!({ "error": message })
}
