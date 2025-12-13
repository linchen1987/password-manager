import { scryptSync, randomBytes, createCipheriv, createDecipheriv } from 'node:crypto';

/**
 * Encrypts a message using AES-256-CBC and Scrypt for key derivation.
 * Format: Salt(16):IV(16):Ciphertext
 * 
 * @param {string} message 
 * @param {string} password 
 * @returns {string} Hex encoded string "salt:iv:ciphertext"
 */
export function encryptMessage(message, password) {
    // 1. Generate random Salt (16 bytes)
    const salt = randomBytes(16);

    // 2. Derive Key using Scrypt (N=16384, r=8, p=1, keyLen=32)
    const key = scryptSync(password, salt, 32, { N: 16384, r: 8, p: 1 });

    // 3. Generate random IV (16 bytes)
    const iv = randomBytes(16);

    // 4. Encrypt using AES-256-CBC
    const cipher = createCipheriv('aes-256-cbc', key, iv);
    let encrypted = cipher.update(message, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    // 5. Output format
    return `${salt.toString('hex')}_${iv.toString('hex')}_${encrypted}`;
}

/**
 * Decrypts a message using AES-256-CBC and Scrypt for key derivation.
 * 
 * @param {string} encryptedData "salt:iv:ciphertext" or "salt_iv_ciphertext"
 * @param {string} password 
 * @returns {string} Decrypted message
 */
export function decryptMessage(encryptedData, password) {
    const parts = encryptedData.split(/[:_]/);
    if (parts.length !== 3) {
        throw new Error("Invalid encrypted string format. Expected salt:iv:ciphertext or salt_iv_ciphertext");
    }

    const salt = Buffer.from(parts[0], 'hex');
    const iv = Buffer.from(parts[1], 'hex');
    const encryptedText = parts[2];

    if (salt.length !== 16) throw new Error("Invalid salt length");
    if (iv.length !== 16) throw new Error("Invalid iv length");

    // 2. Derive Key using Scrypt
    const key = scryptSync(password, salt, 32, { N: 16384, r: 8, p: 1 });

    // 3. Decrypt using AES-256-CBC
    const decipher = createDecipheriv('aes-256-cbc', key, iv);
    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
}
