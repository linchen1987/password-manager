import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import "./App.css";
// import CryptoDemo from "./components/CryptoDemo"; // Preserved but unused
import PasswordManager from "./components/PasswordManager";

function App() {
  // --- Settings Logic ---
  const [showSettings, setShowSettings] = useState(false);
  const [storagePath, setStoragePath] = useState("");
  const [settingsVersion, setSettingsVersion] = useState(0);

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
      setSettingsVersion(v => v + 1);
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
              <button onClick={saveSettings} className="primary-btn">Save</button>
            </div>
          </div>
        </div>
      )}

      <div className="content-area">
        <PasswordManager
          settingsVersion={settingsVersion}
          onOpenSettings={() => { setShowSettings(true); loadSettings(); }}
        />
      </div>
    </main>
  );
}

export default App;
