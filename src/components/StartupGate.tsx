import { useState } from "react";
import { Eye, EyeOff, Lock } from "lucide-react";
import { getSessionPassword } from "../lib/sessionPassword";

interface StartupGateProps {
    onUnlock: (password: string) => void;
    onSkip: () => void;
}

/**
 * Startup gate (Apple Passwords style).
 * Enter the master password once — it stays in memory for this session and
 * is auto-filled when adding / editing / viewing passwords.
 * Can also be skipped.
 */
export default function StartupGate({ onUnlock, onSkip }: StartupGateProps) {
    // Prefill with the existing session password when re-opened later
    const [password, setPassword] = useState(() => getSessionPassword() ?? "");
    const [showPassword, setShowPassword] = useState(false);

    const handleSubmit = () => {
        if (password) {
            onUnlock(password);
        }
    };

    return (
        <div className="gate-overlay">
            <div className="gate-card">
                <div className="gate-icon">
                    <Lock size={40} strokeWidth={2} />
                </div>
                <h2 className="gate-title">Enter Password</h2>
                <p className="gate-subtitle">
                    Remember your master password for this session.
                    It will be auto-filled when adding, editing or viewing passwords.
                </p>
                <div className="gate-input-wrapper">
                    <input
                        type={showPassword ? "text" : "password"}
                        placeholder="Master Password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                        autoComplete="off"
                        autoCorrect="off"
                        autoCapitalize="off"
                        spellCheck={false}
                        name="session_password_gate_no_autofill"
                        autoFocus
                    />
                    <button
                        type="button"
                        className="icon-btn eye-toggle-btn"
                        onClick={() => setShowPassword((v) => !v)}
                        title={showPassword ? "Hide Password" : "Show Password"}
                    >
                        {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                    </button>
                </div>
                <button className="primary-btn gate-unlock-btn" onClick={handleSubmit} disabled={!password}>
                    Remember Password
                </button>
                <button className="gate-skip-btn" onClick={onSkip}>Not Now</button>
                <p className="gate-hint">Kept in memory only · never saved to disk · cleared when the app closes</p>
            </div>
        </div>
    );
}
