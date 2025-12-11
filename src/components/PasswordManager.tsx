import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";

interface Account {
    name: string;
    encryptedPassword: string;
}

interface PasswordManagerProps {
    settingsVersion?: number;
}

export default function PasswordManager({ settingsVersion = 0 }: PasswordManagerProps) {
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    // Create Account State
    const [showCreate, setShowCreate] = useState(false);
    const [newName, setNewName] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [masterPassword, setMasterPassword] = useState("");

    // Unlock Password State
    const [unlockingAccount, setUnlockingAccount] = useState<Account | null>(null);
    const [unlockMasterPassword, setUnlockMasterPassword] = useState("");
    const [decryptedPassword, setDecryptedPassword] = useState("");
    const [unlockError, setUnlockError] = useState("");

    useEffect(() => {
        loadAccounts();
    }, [settingsVersion]);

    const loadAccounts = async () => {
        setLoading(true);
        try {
            const content = await invoke<string>("read_accounts_file");
            const loadedAccounts: Account[] = [];
            if (content.trim()) {
                const lines = content.split("\n");
                for (const line of lines) {
                    const parts = line.split(",");
                    if (parts.length >= 2) {
                        loadedAccounts.push({
                            name: parts[0].trim(),
                            encryptedPassword: parts.slice(1).join(",").trim(), // Handle potential commas in cipher if any (though unlikely with hex)
                        });
                    }
                }
            }
            setAccounts(loadedAccounts);
        } catch (err) {
            setError("Failed to load accounts: " + String(err));
        } finally {
            setLoading(false);
        }
    };

    const handleCreateAccount = async () => {
        if (!newName) {
            alert("Please enter an account name");
            return;
        }

        let encrypted = "";

        if (newPassword) {
            if (!masterPassword) {
                alert("Master password is required to encrypt the password");
                return;
            }
            try {
                encrypted = await invoke<string>("encrypt_message", {
                    message: newPassword,
                    password: masterPassword,
                });
            } catch (err) {
                alert("Failed to encrypt: " + String(err));
                return;
            }
        }

        const newAccount = { name: newName, encryptedPassword: encrypted };
        const updatedAccounts = [...accounts, newAccount];

        // Convert to CSV
        const csvContent = updatedAccounts
            .map((acc) => `${acc.name},${acc.encryptedPassword}`)
            .join("\n");

        try {
            await invoke("write_accounts_file", { content: csvContent });

            setAccounts(updatedAccounts);
            setShowCreate(false);
            setNewName("");
            setNewPassword("");
            setMasterPassword("");
        } catch (err) {
            alert("Failed to save account: " + String(err));
        }
    };

    const handleUnlock = async () => {
        if (!unlockingAccount || !unlockMasterPassword) return;

        setUnlockError("");
        setDecryptedPassword("");

        try {
            const decrypted = await invoke<string>("decrypt_message", {
                encryptedData: unlockingAccount.encryptedPassword,
                password: unlockMasterPassword,
            });
            setDecryptedPassword(decrypted);
        } catch (err) {
            setUnlockError("Failed to decrypt. Wrong password?");
        }
    };

    return (
        <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
                <h2>Password Manager</h2>
                <button onClick={() => setShowCreate(true)}>Create Account</button>
            </div>

            {error && <p className="error">{error}</p>}

            {loading ? (
                <p>Loading accounts...</p>
            ) : accounts.length === 0 ? (
                <p>No accounts found. Create one to get started.</p>
            ) : (
                <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
                    <thead>
                        <tr>
                            <th style={{ borderBottom: "1px solid #ccc", padding: "0.5rem" }}>Name</th>
                            <th style={{ borderBottom: "1px solid #ccc", padding: "0.5rem", textAlign: "right" }}>Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        {accounts.map((acc, idx) => (
                            <tr key={idx}>
                                <td style={{ padding: "0.5rem", borderBottom: "1px solid #eee" }}>{acc.name}</td>
                                <td style={{ padding: "0.5rem", borderBottom: "1px solid #eee", textAlign: "right" }}>
                                    {acc.encryptedPassword ? (
                                        <button
                                            className="secondary"
                                            style={{ padding: "0.3rem 0.8rem", fontSize: "0.9rem" }}
                                            onClick={() => {
                                                setUnlockingAccount(acc);
                                                setDecryptedPassword("");
                                                setUnlockMasterPassword("");
                                                setUnlockError("");
                                            }}
                                        >
                                            View
                                        </button>
                                    ) : (
                                        <span style={{ color: "#94a3b8", fontStyle: "italic", fontSize: "0.9rem", paddingRight: "0.5rem" }}>
                                            No Password
                                        </span>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}

            {/* Create Account Dialog */}
            {showCreate && (
                <div className="modal-overlay">
                    <div className="modal-content">
                        <h3>Add New Account</h3>
                        <div className="form-group" style={{ alignItems: "stretch" }}>
                            <input
                                placeholder="Account Name (e.g. Google)"
                                value={newName}
                                onChange={(e) => setNewName(e.target.value)}
                                autoComplete="off"
                                autoCorrect="off"
                                autoCapitalize="off"
                                spellCheck="false"
                            />
                            <input
                                type="password"
                                placeholder="Password to save"
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                autoComplete="off"
                            />
                            <div className="divider" style={{ margin: "1rem 0" }}></div>
                            <input
                                type="password"
                                placeholder="Master Unlock Password"
                                value={masterPassword}
                                onChange={(e) => setMasterPassword(e.target.value)}
                                autoComplete="off"
                            />
                        </div>
                        <div className="modal-actions">
                            <button
                                className="secondary"
                                onClick={() => setShowCreate(false)}
                            >
                                Cancel
                            </button>
                            <button onClick={handleCreateAccount}>Save</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Unlock Dialog */}
            {unlockingAccount && (
                <div className="modal-overlay">
                    <div className="modal-content">
                        <h3>View Password: {unlockingAccount.name}</h3>
                        {decryptedPassword ? (
                            <div className="result-box success" style={{ marginBottom: "1rem" }}>
                                <p>Password:</p>
                                <code style={{ fontSize: "1.2rem", fontWeight: "bold" }}>{decryptedPassword}</code>
                            </div>
                        ) : (
                            <div className="form-group">
                                <input
                                    type="password"
                                    placeholder="Enter Master Password"
                                    value={unlockMasterPassword}
                                    onChange={(e) => setUnlockMasterPassword(e.target.value)}
                                    autoFocus
                                    autoComplete="off"
                                />
                                {unlockError && <p className="error">{unlockError}</p>}
                                <button onClick={handleUnlock}>Unlock</button>
                            </div>
                        )}

                        <div className="modal-actions">
                            <button
                                className="secondary"
                                onClick={() => setUnlockingAccount(null)}
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
