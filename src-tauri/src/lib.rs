mod crypto;

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use tauri::Manager;

#[derive(Serialize, Deserialize, Debug)]
struct AppSettings {
    storage_path: String,
    theme: String,
}

impl Default for AppSettings {
    fn default() -> Self {
        #[cfg(target_family = "unix")]
        let home = std::env::var("HOME").unwrap_or_else(|_| "/".to_string());
        #[cfg(target_family = "windows")]
        let home = std::env::var("USERPROFILE").unwrap_or_else(|_| "C:\\".to_string());

        Self {
            storage_path: format!("{}/.link1987/password", home),
            theme: "system".to_string(),
        }
    }
}

fn get_config_path(app_handle: &tauri::AppHandle) -> Result<PathBuf, String> {
    let config_dir = app_handle
        .path()
        .app_config_dir()
        .map_err(|e| format!("Failed to get app config dir: {}", e))?;

    if !config_dir.exists() {
        fs::create_dir_all(&config_dir)
            .map_err(|e| format!("Failed to create config dir: {}", e))?;
    }

    Ok(config_dir.join("settings.json"))
}

#[tauri::command]
fn get_settings(app_handle: tauri::AppHandle) -> Result<AppSettings, String> {
    let config_path = get_config_path(&app_handle)?;

    if config_path.exists() {
        let content = fs::read_to_string(&config_path).map_err(|e| e.to_string())?;
        let settings: AppSettings = serde_json::from_str(&content).unwrap_or_default();
        Ok(settings)
    } else {
        Ok(AppSettings::default())
    }
}

#[tauri::command]
fn save_settings(app_handle: tauri::AppHandle, settings: AppSettings) -> Result<(), String> {
    let config_path = get_config_path(&app_handle)?;
    let content = serde_json::to_string_pretty(&settings).map_err(|e| e.to_string())?;
    fs::write(config_path, content).map_err(|e| e.to_string())?;
    Ok(())
}

fn get_storage_path_internal(app_handle: &tauri::AppHandle) -> Result<PathBuf, String> {
    // Reuse logic: read settings, if fail use default
    let settings = get_settings(app_handle.clone())?;
    Ok(PathBuf::from(settings.storage_path))
}

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Account {
    name: String,
    encrypted_password: String,
}

#[derive(Serialize, Deserialize, Debug)]
#[serde(rename_all = "camelCase")]
struct AccountStore {
    version: u32,
    accounts: Vec<Account>,
}

impl AccountStore {
    fn new(accounts: Vec<Account>) -> Self {
        Self { version: 1, accounts }
    }
}

fn accounts_json_path(storage_path: &PathBuf) -> PathBuf {
    storage_path.join("accounts.json")
}

/// Load the account store from accounts.json (absent file = empty store).
/// Historical accounts.csv data is migrated by scripts/migrate-csv-to-json.mjs.
fn load_account_store(app_handle: &tauri::AppHandle) -> Result<AccountStore, String> {
    let storage_path = get_storage_path_internal(app_handle)?;
    let json_path = accounts_json_path(&storage_path);

    if !json_path.exists() {
        return Ok(AccountStore::new(Vec::new()));
    }

    let content = fs::read_to_string(&json_path).map_err(|e| e.to_string())?;
    let store: AccountStore = serde_json::from_str(&content)
        .map_err(|e| format!("Failed to parse {}: {}", json_path.display(), e))?;
    Ok(store)
}

/// Persist the store atomically: write to a temp file, then rename.
fn write_account_store(storage_path: &PathBuf, store: &AccountStore) -> Result<(), String> {
    if !storage_path.exists() {
        fs::create_dir_all(storage_path)
            .map_err(|e| format!("Failed to create storage dir: {}", e))?;
    }
    let json_path = accounts_json_path(storage_path);
    let tmp_path = storage_path.join("accounts.json.tmp");
    let content =
        serde_json::to_string_pretty(store).map_err(|e| format!("Failed to serialize: {}", e))?;
    fs::write(&tmp_path, content).map_err(|e| e.to_string())?;
    fs::rename(&tmp_path, &json_path).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn read_accounts(app_handle: tauri::AppHandle) -> Result<Vec<Account>, String> {
    Ok(load_account_store(&app_handle)?.accounts)
}

#[tauri::command]
fn write_accounts(app_handle: tauri::AppHandle, accounts: Vec<Account>) -> Result<(), String> {
    let storage_path = get_storage_path_internal(&app_handle)?;
    write_account_store(&storage_path, &AccountStore::new(accounts))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn store_serializes_with_version() {
        let store = AccountStore::new(vec![Account {
            name: "test".into(),
            encrypted_password: "a_b_c".into(),
        }]);
        let json = serde_json::to_string(&store).unwrap();
        assert!(json.contains(r#""version":1"#));
        assert!(json.contains(r#""encryptedPassword":"a_b_c""#));
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            greet,
            crypto::encrypt_message,
            crypto::decrypt_message,
            get_settings,
            save_settings,
            read_accounts,
            write_accounts
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
