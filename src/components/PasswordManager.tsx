import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragEndEvent
} from '@dnd-kit/core';
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    useSortable,
    verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface Account {
    name: string;
    encryptedPassword: string;
}

interface PasswordManagerProps {
    settingsVersion?: number;
    onOpenSettings: () => void;
}

// Sortable Item Component
function SortableItem({ id, children, className, onClick, style }: { id: string, children: React.ReactNode, className?: string, onClick?: () => void, style?: React.CSSProperties }) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id });

    const combinedStyle = {
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 1 : 'auto',
        opacity: isDragging ? 0.5 : 1,
        ...style,
    };

    return (
        <div ref={setNodeRef} style={combinedStyle} {...attributes} {...listeners} className={className} onClick={onClick}>
            {children}
        </div>
    );
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
    const [showNewPassword, setShowNewPassword] = useState(true); // Default to visible
    const [masterPassword, setMasterPassword] = useState("");
    const [confirmMasterPassword, setConfirmMasterPassword] = useState("");

    // Unlock Password State
    const [unlockMasterPassword, setUnlockMasterPassword] = useState("");
    const [decryptedPassword, setDecryptedPassword] = useState("");
    const [unlockError, setUnlockError] = useState("");
    const [showPassword, setShowPassword] = useState(false); // Toggle logic
    const [showUnlock, setShowUnlock] = useState(false); // Modal visibility

    // Delete Account State
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

    // Search State
    const [searchTerm, setSearchTerm] = useState("");

    // Drag and Drop (dnd-kit) logic setup later

    // Notification State
    const [notification, setNotification] = useState<{ msg: string; type: "success" | "error" } | null>(null);

    // Edit State
    const [editingAccount, setEditingAccount] = useState<Account | null>(null);

    useEffect(() => {
        loadAccounts();
    }, [settingsVersion]);

    useEffect(() => {
        if (notification) {
            const timer = setTimeout(() => {
                setNotification(null);
            }, 3000);
            return () => clearTimeout(timer);
        }
    }, [notification]);

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
            return true;
        } catch (err) {
            setNotification({ msg: "Failed to save accounts: " + String(err), type: "error" });
            return false;
        }
    };

    const handleDeleteAccount = async () => {
        if (!selectedAccount) return;

        const updatedAccounts = accounts.filter(acc => acc.name !== selectedAccount.name);

        if (await saveAccounts(updatedAccounts)) {
            setNotification({ msg: "Account deleted successfully", type: "success" });
            setShowDeleteConfirm(false);
            setSelectedAccount(null);
            setView("list");
        }
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
            setShowUnlock(false); // Close modal
        } catch (err) {
            setUnlockError("Failed to decrypt. Wrong password?");
        }
    };

    const handleTogglePassword = () => {
        if (showPassword) {
            setShowPassword(false);
        } else {
            if (decryptedPassword) {
                setShowPassword(true);
            } else {
                // Open modal to unlock
                setUnlockMasterPassword("");
                setUnlockError("");
                setShowUnlock(true);
            }
        }
    };

    const handleCopyPassword = async () => {
        if (decryptedPassword) {
            try {
                await navigator.clipboard.writeText(decryptedPassword);
                setNotification({ msg: "Password copied to clipboard", type: "success" });
            } catch (err) {
                setNotification({ msg: "Failed to copy password", type: "error" });
            }
        }
    };

    const handleAccountClick = (acc: Account) => {
        setSelectedAccount(acc);
        setView("detail");
        // Reset unlock state when entering detail view
        setDecryptedPassword("");
        setUnlockMasterPassword("");
        setShowPassword(false);
        setShowUnlock(false);
        setUnlockError("");
    };

    const handleBack = () => {
        setView("list");
        setSelectedAccount(null);
    };

    const handleEditClick = () => {
        if (!selectedAccount) return;
        setEditingAccount(selectedAccount);
        setNewName(selectedAccount.name);
        setNewPassword(""); // Reset password field, if they want to change it they can
        setShowNewPassword(true); // Default to visible
        setMasterPassword("");
        setConfirmMasterPassword("");
        setShowCreate(true);
    };

    const handleAddClick = () => {
        setEditingAccount(null);
        setNewName("");
        setNewPassword("");
        setShowNewPassword(true); // Default to visible
        setMasterPassword("");
        setConfirmMasterPassword("");
        setShowCreate(true);
    };

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 8,
            },
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;

        if (active.id !== over?.id) {
            setAccounts((items) => {
                const oldIndex = items.findIndex(item => item.name === active.id);
                const newIndex = items.findIndex(item => item.name === over?.id);

                const newAccounts = arrayMove(items, oldIndex, newIndex);
                saveAccounts(newAccounts);
                return newAccounts;
            });
        }
    };

    const handleSaveAccount = async () => {
        if (!newName) {
            setNotification({ msg: "Please enter an account name", type: "error" });
            return;
        }

        // Check for duplicate names (exclude self if editing)
        const isDuplicate = accounts.some(acc =>
            acc.name === newName && (!editingAccount || acc.name !== editingAccount.name)
        );

        if (isDuplicate) {
            setNotification({ msg: "Account name already exists", type: "error" });
            return;
        }

        let encrypted = editingAccount ? editingAccount.encryptedPassword : "";

        // If password is provided, encrypt it
        if (newPassword) {
            if (!masterPassword) {
                setNotification({ msg: "Master password is required to encrypt the new password", type: "error" });
                return;
            }
            if (masterPassword !== confirmMasterPassword) {
                setNotification({ msg: "Master passwords do not match", type: "error" });
                return;
            }
            try {
                encrypted = await invoke<string>("encrypt_message", {
                    message: newPassword,
                    password: masterPassword,
                });
            } catch (err) {
                setNotification({ msg: "Failed to encrypt: " + String(err), type: "error" });
                return;
            }
        } else if (!editingAccount) {
            // Creating new account but no password provided? valid? probably okay to allow empty password but encrypted string might just be empty? 
            // Current logic allows it.
            encrypted = "";
        }

        const newAccount = { name: newName, encryptedPassword: encrypted };

        let updatedAccounts;
        if (editingAccount) {
            updatedAccounts = accounts.map(acc => acc.name === editingAccount.name ? newAccount : acc);
            // Also update selectedAccount if we are actively viewing it
            if (selectedAccount && selectedAccount.name === editingAccount.name) {
                setSelectedAccount(newAccount);
                // Reset unlock state to force re-entry of password
                setDecryptedPassword("");
                setShowPassword(false);
                setUnlockMasterPassword("");
                setUnlockError("");
            }
        } else {
            updatedAccounts = [...accounts, newAccount];
        }

        if (await saveAccounts(updatedAccounts)) {
            setNotification({ msg: editingAccount ? "Account updated successfully" : "Account created successfully", type: "success" });
            setShowCreate(false);
            setNewName("");
            setNewPassword("");
            setMasterPassword("");
            setConfirmMasterPassword("");
            setEditingAccount(null);
        }
    };

    // Filter Logic
    const filteredAccounts = accounts.filter(acc =>
        acc.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Disable DnD when filtering
    const isDragEnabled = !searchTerm;

    // --- Render Helpers ---



    const renderList = () => (
        <div className="pm-list-container">
            <div className="pm-header">
                <h2>Passwords</h2>
                <div className="header-actions" style={{ display: 'flex', gap: '0.5rem' }}>
                    <button className="icon-btn text-primary" onClick={handleAddClick} title="Add Password">
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="11"></circle><line x1="12" y1="8" x2="12" y2="16"></line><line x1="8" y1="12" x2="16" y2="12"></line></svg>
                    </button>
                    <button className="icon-btn" onClick={onOpenSettings} title="Settings">
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
                    </button>
                </div>
            </div>

            <div className="pm-search">
                <div className="search-input-wrapper">
                    <svg className="search-icon" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                    <input
                        type="text"
                        placeholder="Search passwords"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        autoComplete="off"
                        autoCorrect="off"
                        autoCapitalize="off"
                        spellCheck="false"
                        name="search_passwords_field_no_autofill"
                    />
                    {searchTerm && (
                        <button className="icon-btn clear-btn" onClick={() => setSearchTerm("")} style={{ minWidth: 'auto', padding: '2px' }}>
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                        </button>
                    )}
                </div>
            </div>

            {error && <p className="error">{error}</p>}

            {loading ? (
                <p className="loading-text">Loading...</p>
            ) : filteredAccounts.length === 0 ? (
                <div className="empty-state">
                    {searchTerm ? <p>No results found.</p> : (
                        <>
                            <p>No passwords saved yet.</p>
                            <button className="primary-btn" onClick={handleAddClick}>Add your first password</button>
                        </>
                    )}
                </div>
            ) : (
                <div className="account-list">
                    {isDragEnabled ? (
                        <DndContext
                            sensors={sensors}
                            collisionDetection={closestCenter}
                            onDragEnd={handleDragEnd}
                        >
                            <SortableContext
                                items={filteredAccounts.map(a => a.name)}
                                strategy={verticalListSortingStrategy}
                            >
                                {filteredAccounts.map((acc) => (
                                    <SortableItem
                                        key={acc.name}
                                        id={acc.name}
                                        className="account-item"
                                        onClick={() => handleAccountClick(acc)}
                                        style={{ cursor: 'grab' }}
                                    >
                                        <div className="account-icon-placeholder">
                                            {acc.name.charAt(0).toUpperCase()}
                                        </div>
                                        <span className="account-name">{acc.name}</span>
                                        <div className="account-arrow">
                                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6" /></svg>
                                        </div>
                                    </SortableItem>
                                ))}
                            </SortableContext>
                        </DndContext>
                    ) : (
                        // Non-sortable list (when searching)
                        filteredAccounts.map((acc) => (
                            <div
                                key={acc.name}
                                className="account-item"
                                onClick={() => handleAccountClick(acc)}
                                style={{ cursor: 'pointer' }}
                            >
                                <div className="account-icon-placeholder">
                                    {acc.name.charAt(0).toUpperCase()}
                                </div>
                                <span className="account-name">{acc.name}</span>
                                <div className="account-arrow">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6" /></svg>
                                </div>
                            </div>
                        ))
                    )}
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

                                    {showPassword ? (
                                        <>
                                            <button className="icon-btn" onClick={handleCopyPassword} title="Copy Password">
                                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2" /><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" /></svg>
                                            </button>
                                            <button className="icon-btn reveal-btn" onClick={handleTogglePassword} title="Hide Password">
                                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" /><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" /><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" /><line x1="2" x2="22" y1="2" y2="22" /></svg>
                                            </button>
                                        </>
                                    ) : (
                                        <button className="icon-btn reveal-btn" onClick={handleTogglePassword} title="Show Password">
                                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" /></svg>
                                        </button>
                                    )}
                                </>
                            ) : (
                                <div className="input-display" style={{ color: '#9ca3af', fontStyle: 'italic', flex: 1 }}>No password set</div>
                            )}
                        </div>
                    </div>
                </div>

                <div className="detail-actions">
                    <button className="action-btn edit-btn" onClick={handleEditClick}>Edit</button>
                    <button className="action-btn delete-btn" onClick={() => setShowDeleteConfirm(true)}>Delete</button>
                </div>
            </div>
        );
    };

    return (
        <div className="pm-wrapper">
            {notification && (
                <div className={`notification-banner ${notification.type}`}>
                    {notification.msg}
                </div>
            )}
            {view === "list" ? renderList() : renderDetail()}

            {/* Create/Edit Account Modal - Global */}
            {showCreate && (
                <div className="modal-overlay">
                    <div className="modal-content">
                        <h3>{editingAccount ? "Edit Password" : "Add New Account"}</h3>
                        <div className="form-group">
                            <input
                                placeholder="Account"
                                value={newName}
                                onChange={(e) => setNewName(e.target.value)}
                                autoComplete="off" // "off" or "new-password" often helps
                                autoCorrect="off"
                                autoCapitalize="off"
                                spellCheck="false"
                                name="account_name_field_no_autofill" // Random name to avoid history
                                onKeyDown={(e) => e.key === "Enter" && handleSaveAccount()}
                            />
                            <div className="password-input-group" style={{ position: 'relative' }}>
                                <input
                                    type={showNewPassword ? "text" : "password"}
                                    placeholder={editingAccount ? "New Password (leave empty to keep current)" : "Password (optional)"}
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    autoComplete="new-password"
                                    autoCorrect="off"
                                    autoCapitalize="off"
                                    spellCheck="false"
                                    name="new_password_field_no_autofill"
                                    style={{ paddingRight: '2.5rem' }}
                                    onKeyDown={(e) => e.key === "Enter" && handleSaveAccount()}
                                />
                                <button
                                    className="icon-btn"
                                    onClick={() => setShowNewPassword(!showNewPassword)}
                                    style={{ position: 'absolute', right: '0.25rem', top: '50%', transform: 'translateY(-50%)', padding: '0.25rem' }}
                                    title={showNewPassword ? "Hide Password" : "Show Password"}
                                >
                                    {showNewPassword ? (
                                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24M1 1l22 22" /></svg>
                                    ) : (
                                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
                                    )}
                                </button>
                            </div>
                            <div className="divider"></div>
                            {(newPassword || !editingAccount) && (
                                <>
                                    <input
                                        type="password"
                                        placeholder="Unlock Password (optional)"
                                        value={masterPassword}
                                        onChange={(e) => setMasterPassword(e.target.value)}
                                        autoComplete="off"
                                        autoCorrect="off"
                                        autoCapitalize="off"
                                        spellCheck="false"
                                        name="master_password_field_no_autofill"
                                        onKeyDown={(e) => e.key === "Enter" && handleSaveAccount()}
                                    />
                                    {masterPassword && (
                                        <input
                                            type="password"
                                            placeholder="Confirm Unlock Password"
                                            value={confirmMasterPassword}
                                            onChange={(e) => setConfirmMasterPassword(e.target.value)}
                                            autoComplete="off"
                                            autoCorrect="off"
                                            autoCapitalize="off"
                                            spellCheck="false"
                                            name="confirm_master_password_field"
                                            onKeyDown={(e) => e.key === "Enter" && handleSaveAccount()}
                                        />
                                    )}
                                </>
                            )}
                        </div>
                        <div className="modal-actions">
                            <button className="secondary" onClick={() => setShowCreate(false)}>Cancel</button>
                            <button
                                className="primary-btn"
                                onClick={handleSaveAccount}
                                disabled={!newName.trim() || (!!newPassword && (!masterPassword || masterPassword !== confirmMasterPassword))}
                            >
                                Save
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Unlock Modal */}
            {showUnlock && (
                <div className="modal-overlay">
                    <div className="modal-content">
                        <h3>Unlock Password</h3>
                        <div className="form-group">
                            <input
                                type="password"
                                placeholder="Enter Unlock Password"
                                value={unlockMasterPassword}
                                onChange={(e) => setUnlockMasterPassword(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                        handleUnlock();
                                    }
                                }}
                                autoFocus
                            />
                            {unlockError && <p className="error small-error">{unlockError}</p>}
                        </div>
                        <div className="modal-actions">
                            <button className="secondary" onClick={() => setShowUnlock(false)}>Cancel</button>
                            <button className="primary-btn" onClick={handleUnlock}>Unlock</button>
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
