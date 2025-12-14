import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import "./App.css";
// import CryptoDemo from "./components/CryptoDemo"; // Preserved but unused
import PasswordManager from "./components/PasswordManager";

function App() {
  // --- Settings Logic ---
  const [showSettings, setShowSettings] = useState(false);
  const [storagePath, setStoragePath] = useState("");
  const [savedStoragePath, setSavedStoragePath] = useState(""); // Track persisted path
  const [theme, setTheme] = useState("system"); // system, light, dark
  const [settingsVersion, setSettingsVersion] = useState(0);

  const loadSettings = async () => {
    try {
      const settings = await invoke<{ storage_path: string; theme: string }>("get_settings");
      setStoragePath(settings.storage_path);
      setSavedStoragePath(settings.storage_path);
      setTheme(settings.theme || "system");
    } catch (err) {
      console.error("Failed to load settings:", err);
    }
  };

  const handleThemeChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newTheme = e.target.value;
    setTheme(newTheme);
    // Auto-save theme using the *saved* storage path to avoid saving partial edits
    try {
      await invoke("save_settings", { settings: { storage_path: savedStoragePath, theme: newTheme } });
    } catch (err) {
      console.error("Failed to auto-save theme:", err);
    }
  };

  const saveStoragePath = async () => {
    try {
      await invoke("save_settings", { settings: { storage_path: storagePath, theme } });
      setSavedStoragePath(storagePath);
      setSettingsVersion(v => v + 1);
      alert("Storage Path saved!");
    } catch (err) {
      console.error("Failed to save settings:", err);
      alert("Failed to save settings: " + err);
    }
  };

  // Load settings on mount
  useState(() => {
    loadSettings();
  });

  // Apply theme
  useEffect(() => {
    if (typeof document !== 'undefined') {
      const root = document.documentElement;
      if (theme === 'dark') {
        root.setAttribute('data-theme', 'dark');
      } else if (theme === 'light') {
        root.setAttribute('data-theme', 'light');
      } else {
        root.removeAttribute('data-theme');
      }
    }
  }, [theme]);

  return (
    <main className="container">
      {/* Settings Dialog */}
      {showSettings && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h2 style={{ margin: 0 }}>Settings</h2>
              <button className="icon-btn" onClick={() => setShowSettings(false)} title="Close">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
              </button>
            </div>

            <div className="form-group">
              <label htmlFor="storage-path">Storage Path</label>
              <div className="input-group" style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <input
                  id="storage-path"
                  value={storagePath}
                  onChange={(e) => setStoragePath(e.target.value)}
                  placeholder="Enter storage path..."
                  spellCheck={false}
                  style={{ flex: 1 }}
                />
                <button
                  className="icon-btn primary-icon-btn"
                  onClick={saveStoragePath}
                  title="Save Path"
                  disabled={storagePath === savedStoragePath}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>
                </button>
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="theme_selector">Theme</label>
              <select
                id="theme_selector"
                value={theme}
                onChange={handleThemeChange}
              >
                <option value="system">System</option>
                <option value="light">Light</option>
                <option value="dark">Dark</option>
              </select>
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
