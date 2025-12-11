import { encryptMessage, decryptMessage } from './index.js';
import assert from 'node:assert';
import { test } from 'node:test';

test('test_encryption_decryption', () => {
    const message = "Hello World! This is a secret message.";
    const password = "super_secure_password";

    const encrypted = encryptMessage(message, password);
    // console.log("Encrypted:", encrypted);

    // Verify format
    const parts = encrypted.split(':');
    assert.strictEqual(parts.length, 3, "Output format should be salt:iv:ciphertext");

    // Decrypt
    const decrypted = decryptMessage(encrypted, password);
    assert.strictEqual(decrypted, message, "Decrypted message matches original");
});

test('test_wrong_password', () => {
    const message = "Secret";
    const password = "password123";
    const wrong_password = "password456";

    const encrypted = encryptMessage(message, password);

    assert.throws(() => {
        decryptMessage(encrypted, wrong_password);
    }, /bad decrypt|wrong final block length/i, "Should throw error on wrong password"); // specific error detail varies by openssl version sometimes, but usually 'bad decrypt'
});

test('test_specific_vector', () => {
    const encrypted = "82818c21062c68b2c97d56de73d9661c:94dbb90b35f6a2f2866f3a41e72080e2:d67c1498bd07be24b68eaf15589d9525";
    const password = "123456";
    const expected = "abcdefg";

    const decrypted = decryptMessage(encrypted, password);
    assert.strictEqual(decrypted, expected, "Should decrypt known vector correctly");
});
