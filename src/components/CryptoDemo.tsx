import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";

export default function CryptoDemo() {
    const [encryptMessage, setEncryptMessage] = useState("");
    const [encryptPassword, setEncryptPassword] = useState("");
    const [encryptedResult, setEncryptedResult] = useState("");
    const [encryptionError, setEncryptionError] = useState("");

    const [decryptData, setDecryptData] = useState("");
    const [decryptPassword, setDecryptPassword] = useState("");
    const [decryptedResult, setDecryptedResult] = useState("");
    const [decryptionError, setDecryptionError] = useState("");

    async function handleEncrypt(e: React.FormEvent) {
        e.preventDefault();
        setEncryptionError("");
        setEncryptedResult("");
        try {
            const result = await invoke<string>("encrypt_message", {
                message: encryptMessage,
                password: encryptPassword,
            });
            setEncryptedResult(result);
        } catch (err) {
            setEncryptionError(String(err));
        }
    }

    async function handleDecrypt(e: React.FormEvent) {
        e.preventDefault();
        setDecryptionError("");
        setDecryptedResult("");
        try {
            const result = await invoke<string>("decrypt_message", {
                encryptedData: decryptData,
                password: decryptPassword,
            });
            setDecryptedResult(result);
        } catch (err) {
            setDecryptionError(String(err));
        }
    }

    return (
        <>
            <h1>Crypto Demo</h1>

            <div className="section">
                <h2>Encrypt</h2>
                <form onSubmit={handleEncrypt} className="form-group">
                    <input
                        onChange={(e) => setEncryptMessage(e.currentTarget.value)}
                        placeholder="Message to encrypt..."
                        value={encryptMessage}
                    />
                    <input
                        type="password"
                        onChange={(e) => setEncryptPassword(e.currentTarget.value)}
                        placeholder="Password..."
                        value={encryptPassword}
                    />
                    <button type="submit">Encrypt</button>
                </form>
                {encryptedResult && (
                    <div className="result-box">
                        <p>Encrypted Result (Copy this):</p>
                        <textarea readOnly value={encryptedResult} rows={3} />
                    </div>
                )}
                {encryptionError && <p className="error">{encryptionError}</p>}
            </div>

            <div className="divider"></div>

            <div className="section">
                <h2>Decrypt</h2>
                <form onSubmit={handleDecrypt} className="form-group">
                    <textarea
                        onChange={(e) => setDecryptData(e.currentTarget.value)}
                        placeholder="Paste encrypted string (salt:iv:ciphertext)..."
                        value={decryptData}
                        rows={3}
                    />
                    <input
                        type="password"
                        onChange={(e) => setDecryptPassword(e.currentTarget.value)}
                        placeholder="Password..."
                        value={decryptPassword}
                    />
                    <button type="submit">Decrypt</button>
                </form>
                {decryptedResult && (
                    <div className="result-box success">
                        <p>Decrypted Message:</p>
                        <textarea readOnly value={decryptedResult} rows={2} />
                    </div>
                )}
                {decryptionError && <p className="error">{decryptionError}</p>}
            </div>
        </>
    );
}
