use aes::cipher::{block_padding::Pkcs7, BlockDecryptMut, BlockEncryptMut, KeyIvInit};
use rand::RngCore;
use scrypt::{scrypt, Params};
use tauri::ipc::Response;

// Type alias for AES-256-CBC with PKCS7 padding
type Aes256CbcEnc = cbc::Encryptor<aes::Aes256>;
type Aes256CbcDec = cbc::Decryptor<aes::Aes256>;

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tauri::command]
fn encrypt_message(message: String, password: String) -> Result<String, String> {
    // 1. Generate random Salt (16 bytes)
    let mut salt = [0u8; 16];
    rand::rng().fill_bytes(&mut salt);

    // 2. Derive Key using Scrypt (N=16384, r=8, p=1)
    let params = Params::new(14, 8, 1, 32).map_err(|e| e.to_string())?;
    let mut key = [0u8; 32];
    scrypt(password.as_bytes(), &salt, &params, &mut key).map_err(|e| e.to_string())?;

    // 3. Generate random IV (16 bytes)
    let mut iv = [0u8; 16];
    rand::rng().fill_bytes(&mut iv);

    // 4. Encrypt using AES-256-CBC
    let cipher = Aes256CbcEnc::new_from_slices(&key, &iv).map_err(|e| e.to_string())?;

    // Prepare buffer: must be long enough for message + padding (up to 1 block)
    let msg_bytes = message.as_bytes();
    let mut buffer = vec![0u8; msg_bytes.len() + 16];
    buffer[..msg_bytes.len()].copy_from_slice(msg_bytes);

    let encrypted_len = cipher
        .encrypt_padded_mut::<Pkcs7>(&mut buffer, msg_bytes.len())
        .map_err(|e| e.to_string())?
        .len();

    // Truncate to actual encrypted length
    buffer.truncate(encrypted_len);

    // 5. Output format: Salt:IV:Ciphertext (Hex encoded)
    let salt_hex = hex::encode(salt);
    let iv_hex = hex::encode(iv);
    let encrypted_hex = hex::encode(buffer);

    Ok(format!("{}:{}:{}", salt_hex, iv_hex, encrypted_hex))
}

#[tauri::command]
fn decrypt_message(encrypted_data: String, password: String) -> Result<String, String> {
    // 1. Parse Salt:IV:Ciphertext
    let parts: Vec<&str> = encrypted_data.split(':').collect();
    if parts.len() != 3 {
        return Err("Invalid encrypted string format. Expected salt:iv:ciphertext".to_string());
    }

    let salt = hex::decode(parts[0]).map_err(|e| format!("Invalid salt hex: {}", e))?;
    let iv = hex::decode(parts[1]).map_err(|e| format!("Invalid iv hex: {}", e))?;
    let mut encrypted_bytes =
        hex::decode(parts[2]).map_err(|e| format!("Invalid ciphertext hex: {}", e))?;

    if salt.len() != 16 {
        return Err("Invalid salt length".to_string());
    }
    if iv.len() != 16 {
        return Err("Invalid iv length".to_string());
    }

    // 2. Derive Key using Scrypt
    let params = Params::new(14, 8, 1, 32).map_err(|e| e.to_string())?;
    let mut key = [0u8; 32];
    scrypt(password.as_bytes(), &salt, &params, &mut key).map_err(|e| e.to_string())?;

    // 3. Decrypt using AES-256-CBC
    let cipher = Aes256CbcDec::new_from_slices(&key, &iv).map_err(|e| e.to_string())?;

    // Decrypt in-place
    let decrypted_len = cipher
        .decrypt_padded_mut::<Pkcs7>(&mut encrypted_bytes)
        .map_err(|e| format!("Decryption failed: {}", e))?
        .len();

    encrypted_bytes.truncate(decrypted_len);

    let decrypted_string = String::from_utf8(encrypted_bytes)
        .map_err(|e| format!("Invalid UTF-8 in decrypted text: {}", e))?;

    Ok(decrypted_string)
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
            encrypt_message,
            decrypt_message,
            get_settings,
            save_settings,
            read_accounts_file,
            write_accounts_file
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_encryption_decryption() {
        let message = "Hello World! This is a secret message.";
        let password = "super_secure_password";

        let encrypted = encrypt_message(message.to_string(), password.to_string()).unwrap();
        println!("Encrypted: {}", encrypted);

        // Verify format
        let parts: Vec<&str> = encrypted.split(':').collect();
        assert_eq!(parts.len(), 3);

        // Decrypt
        let decrypted = decrypt_message(encrypted, password.to_string()).unwrap();
        assert_eq!(decrypted, message);
    }

    #[test]
    fn test_wrong_password() {
        let message = "Secret";
        let password = "password123";
        let wrong_password = "password456";

        let encrypted = encrypt_message(message.to_string(), password.to_string()).unwrap();
        let result = decrypt_message(encrypted, wrong_password.to_string());

        assert!(result.is_err());
    }

    #[test]
    fn test_specific_vector() {
        let encrypted = "82818c21062c68b2c97d56de73d9661c:94dbb90b35f6a2f2866f3a41e72080e2:d67c1498bd07be24b68eaf15589d9525";
        let password = "123456";
        let expected = "abcdefg";

        let decrypted = decrypt_message(encrypted.to_string(), password.to_string()).unwrap();
        assert_eq!(decrypted, expected);
    }
}
