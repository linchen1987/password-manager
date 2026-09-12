import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import "./App.css";
// import CryptoDemo from "./components/CryptoDemo"; // Preserved but unused
import PasswordManager from "./components/PasswordManager";
import StartupGate from "./components/StartupGate";
import { Save, X } from "lucide-react";
import { setSessionPassword, hasSessionPassword } from "./lib/sessionPassword";

function App() {
  // --- Settings Logic ---
  const [showSettings, setShowSettings] = useState(false);
  const [storagePath, setStoragePath] = useState("");
  const [savedStoragePath, setSavedStoragePath] = useState(""); // Track persisted path
  const [theme, setTheme] = useState("system"); // system, light, dark
  const [settingsVersion, setSettingsVersion] = useState(0);

  // --- Session Password Logic (memory only, never persisted) ---
  const [showGate, setShowGate] = useState(true); // Ask once on app entry
  const [sessionPasswordActive, setSessionPasswordActive] = useState(false);

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

  // --- Session Password Handlers ---
  const handleGateUnlock = (pw: string) => {
    // Keep the password in memory only (see lib/sessionPassword.ts)
    setSessionPassword(pw);
    setSessionPasswordActive(true);
    setShowGate(false);
  };

  const handleGateSkip = () => {
    setShowGate(false);
  };

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
                <X size={24} />
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
                  <Save size={20} />
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
          sessionPasswordActive={sessionPasswordActive}
          onOpenGate={() => { setShowGate(true); }}
          onSessionPasswordChange={() => { setSessionPasswordActive(hasSessionPassword()); }}
        />
      </div>

      {/* Startup Gate — enter password once for autofill, or skip */}
      {showGate && (
        <StartupGate
          onUnlock={handleGateUnlock}
          onSkip={handleGateSkip}
        />
      )}
    </main>
  );
}

export default App;
