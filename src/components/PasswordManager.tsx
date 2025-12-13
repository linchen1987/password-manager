import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";

interface Account {
    name: string;
    encryptedPassword: string;
}

interface PasswordManagerProps {
    settingsVersion?: number;
    onOpenSettings: () => void;
}

export default function PasswordManager({ settingsVersion = 0, onOpenSettings }: PasswordManagerProps) {
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    // Navigation State
    const [view, setView] = useState<"list" | "detail">("list");
    const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);

    // Create Account State
    const [showCreate, setShowCreate] = useState(false);
    const [newName, setNewName] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [masterPassword, setMasterPassword] = useState("");

    // Unlock Password State
    const [unlockMasterPassword, setUnlockMasterPassword] = useState("");
    const [decryptedPassword, setDecryptedPassword] = useState("");
    const [unlockError, setUnlockError] = useState("");
    const [showPassword, setShowPassword] = useState(false); // Toggle logic

    // Delete Account State
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

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
                            encryptedPassword: parts.slice(1).join(",").trim(),
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

    const saveAccounts = async (updatedAccounts: Account[]) => {
        // Convert to CSV
        const csvContent = updatedAccounts
            .map((acc) => `${acc.name},${acc.encryptedPassword}`)
            .join("\n");

        try {
            await invoke("write_accounts_file", { content: csvContent });
            setAccounts(updatedAccounts);
        } catch (err) {
            alert("Failed to save accounts: " + String(err));
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
        saveAccounts(updatedAccounts);

        setShowCreate(false);
        setNewName("");
        setNewPassword("");
        setMasterPassword("");
    };

    const handleDeleteAccount = async () => {
        if (!selectedAccount) return;

        // Filter out the account to delete (by name matching for now - assuming names are unique or it's acceptable to delete first match)
        // Ideally we should have an ID, but name is what we have.
        const updatedAccounts = accounts.filter(acc => acc.name !== selectedAccount.name);

        await saveAccounts(updatedAccounts);

        setShowDeleteConfirm(false);
        setSelectedAccount(null);
        setView("list");
    };

    const handleUnlock = async () => {
        if (!selectedAccount || !unlockMasterPassword) return;

        setUnlockError("");
        setDecryptedPassword("");

        try {
            const decrypted = await invoke<string>("decrypt_message", {
                encryptedData: selectedAccount.encryptedPassword,
                password: unlockMasterPassword,
            });
            setDecryptedPassword(decrypted);
            setShowPassword(true); // Reveal
        } catch (err) {
            setUnlockError("Failed to decrypt. Wrong password?");
        }
    };

    const handleAccountClick = (acc: Account) => {
        setSelectedAccount(acc);
        setView("detail");
        // Reset unlock state when entering detail view
        setDecryptedPassword("");
        setUnlockMasterPassword("");
        setShowPassword(false);
        setUnlockError("");
    };

    const handleBack = () => {
        setView("list");
        setSelectedAccount(null);
    };

    // --- Render Helpers ---

    const renderList = () => (
        <div className="pm-list-container">
            <div className="pm-header">
                <h2>Passwords</h2>
                <div className="header-actions" style={{ display: 'flex', gap: '0.5rem' }}>
                    <button className="icon-btn" onClick={onOpenSettings} title="Settings">
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
                    </button>
                    <button className="icon-btn primary-icon-btn" onClick={() => setShowCreate(true)} title="Add Password">
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                    </button>
                </div>
            </div>

            {error && <p className="error">{error}</p>}

            {loading ? (
                <p className="loading-text">Loading...</p>
            ) : accounts.length === 0 ? (
                <div className="empty-state">
                    <p>No passwords saved yet.</p>
                    <button onClick={() => setShowCreate(true)}>Add your first password</button>
                </div>
            ) : (
                <div className="account-list">
                    {accounts.map((acc, idx) => (
                        <div key={idx} className="account-item" onClick={() => handleAccountClick(acc)}>
                            <div className="account-icon-placeholder">
                                {/* Simple initial based icon */}
                                {acc.name.charAt(0).toUpperCase()}
                            </div>
                            <span className="account-name">{acc.name}</span>
                            <div className="account-arrow">
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6" /></svg>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );

    const renderDetail = () => {
        if (!selectedAccount) return null;
        return (
            <div className="pm-detail-container">
                <div className="detail-header">
                    <button className="icon-btn back-btn" onClick={handleBack} title="Back">
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5" /><path d="M12 19l-7-7 7-7" /></svg>
                    </button>
                    <h2>{selectedAccount.name}</h2>
                </div>

                <div className="detail-card">
                    {/* Username Field (Read Only) */}
                    <div className="detail-field">
                        <label>Name</label>
                        <div className="input-display">{selectedAccount.name}</div>
                    </div>

                    {/* Password Field */}
                    <div className="detail-field">
                        <label>Password</label>
                        <div className="password-display-group">
                            {selectedAccount.encryptedPassword ? (
                                <>
                                    <div className="input-display password-text">
                                        {showPassword ? decryptedPassword : "••••••••••••"}
                                    </div>

                                    {!showPassword ? (
                                        <button className="icon-btn reveal-btn" onClick={() => setShowPassword(true)} title="Show Password">
                                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" /></svg>
                                        </button>
                                    ) : (
                                        <button className="icon-btn reveal-btn" onClick={() => setShowPassword(false)} title="Hide Password">
                                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" /><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" /><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" /><line x1="2" x2="22" y1="2" y2="22" /></svg>
                                        </button>
                                    )}
                                </>
                            ) : (
                                <div className="input-display" style={{ color: '#9ca3af', fontStyle: 'italic', flex: 1 }}>No password set</div>
                            )}
                        </div>
                    </div>

                    {/* Master Password Prompt for Decryption */}
                    {showPassword && !decryptedPassword && (
                        <div className="unlock-prompt">
                            <input
                                type="password"
                                placeholder="Enter Master Password to confirm"
                                value={unlockMasterPassword}
                                onChange={(e) => setUnlockMasterPassword(e.target.value)}
                                autoFocus
                            />
                            <div className="unlock-actions">
                                <button className="small-btn" onClick={handleUnlock}>Confirm</button>
                                <button className="small-btn secondary" onClick={() => setShowPassword(false)}>Cancel</button>
                            </div>
                            {unlockError && <p className="error small-error">{unlockError}</p>}
                        </div>
                    )}
                </div>

                <div className="detail-actions">
                    <button className="action-btn edit-btn">Edit</button>
                    <button className="action-btn delete-btn" onClick={() => setShowDeleteConfirm(true)}>Delete</button>
                </div>
            </div>
        );
    };

    return (
        <div className="pm-wrapper">
            {view === "list" ? renderList() : renderDetail()}

            {/* Create Account Modal - Global */}
            {showCreate && (
                <div className="modal-overlay">
                    <div className="modal-content">
                        <h3>Add New Password</h3>
                        <div className="form-group">
                            <input
                                placeholder="Site Name"
                                value={newName}
                                onChange={(e) => setNewName(e.target.value)}
                            />
                            <input
                                type="password"
                                placeholder="Password"
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                            />
                            <div className="divider"></div>
                            <input
                                type="password"
                                placeholder="Master Encryption Password"
                                value={masterPassword}
                                onChange={(e) => setMasterPassword(e.target.value)}
                            />
                        </div>
                        <div className="modal-actions">
                            <button className="secondary" onClick={() => setShowCreate(false)}>Cancel</button>
                            <button onClick={handleCreateAccount}>Save</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Confirmation Modal */}
            {showDeleteConfirm && selectedAccount && (
                <div className="modal-overlay">
                    <div className="modal-content" style={{ maxWidth: '400px' }}>
                        <h3>Delete Account?</h3>
                        <p>Are you sure you want to delete <strong>{selectedAccount.name}</strong>? This action cannot be undone.</p>
                        <div className="modal-actions">
                            <button className="secondary" onClick={() => setShowDeleteConfirm(false)}>Cancel</button>
                            <button className="delete-btn" style={{ backgroundColor: '#d93025', color: 'white', border: 'none' }} onClick={handleDeleteAccount}>Delete</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
