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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            greet,
            encrypt_message,
            decrypt_message
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
}
