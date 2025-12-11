import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import "./App.css";

function App() {
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

  // --- Settings Logic ---
  const [showSettings, setShowSettings] = useState(false);
  const [storagePath, setStoragePath] = useState("");

  const loadSettings = async () => {
    try {
      const settings = await invoke<{ storage_path: string }>("get_settings");
      setStoragePath(settings.storage_path);
    } catch (err) {
      console.error("Failed to load settings:", err);
    }
  };

  const saveSettings = async () => {
    try {
      await invoke("save_settings", { settings: { storage_path: storagePath } });
      setShowSettings(false);
    } catch (err) {
      console.error("Failed to save settings:", err);
      alert("Failed to save settings: " + err);
    }
  };

  // Load settings on mount
  useState(() => {
    loadSettings();
  });

  return (
    <main className="container">
      {/* Settings Icon */}
      <div
        className="settings-icon"
        onClick={() => { setShowSettings(true); loadSettings(); }}
        title="Settings"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="3"></circle>
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
        </svg>
      </div>

      {/* Settings Dialog */}
      {showSettings && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h2>Settings</h2>
            <div className="form-group">
              <label htmlFor="storage-path" style={{ alignSelf: 'flex-start', fontWeight: 'bold' }}>Storage Path:</label>
              <input
                id="storage-path"
                value={storagePath}
                onChange={(e) => setStoragePath(e.target.value)}
                placeholder="Enter storage path..."
              />
            </div>
            <div className="modal-actions">
              <button onClick={() => setShowSettings(false)} className="secondary">Cancel</button>
              <button onClick={saveSettings}>Save</button>
            </div>
          </div>
        </div>
      )}

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
    </main>
  );
}

export default App;
