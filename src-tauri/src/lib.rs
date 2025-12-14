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
}

impl Default for AppSettings {
    fn default() -> Self {
        #[cfg(target_family = "unix")]
        let home = std::env::var("HOME").unwrap_or_else(|_| "/".to_string());
        #[cfg(target_family = "windows")]
        let home = std::env::var("USERPROFILE").unwrap_or_else(|_| "C:\\".to_string());

        Self {
            storage_path: format!("{}/.link1987/password", home),
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

#[tauri::command]
fn read_accounts_file(app_handle: tauri::AppHandle) -> Result<String, String> {
    let storage_path = get_storage_path_internal(&app_handle)?;
    let file_path = storage_path.join("accounts.csv");

    if !file_path.exists() {
        return Ok(String::new()); // Return empty string if file doesn't exist
    }

    fs::read_to_string(file_path).map_err(|e| e.to_string())
}

#[tauri::command]
fn write_accounts_file(app_handle: tauri::AppHandle, content: String) -> Result<(), String> {
    let storage_path = get_storage_path_internal(&app_handle)?;

    // Ensure directory exists
    if !storage_path.exists() {
        fs::create_dir_all(&storage_path)
            .map_err(|e| format!("Failed to create storage dir: {}", e))?;
    }

    let file_path = storage_path.join("accounts.csv");
    fs::write(file_path, content).map_err(|e| e.to_string())
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
            read_accounts_file,
            write_accounts_file
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
