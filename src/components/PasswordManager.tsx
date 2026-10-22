import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { getSessionPassword, clearSessionPassword, hasSessionPassword } from "../lib/sessionPassword";
import {
    ArrowLeft,
    ChevronRight,
    CirclePlus,
    Copy,
    Eye,
    EyeOff,
    Lock,
    LockOpen,
    Search,
    Settings,
    X,
} from "lucide-react";
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
    sessionPasswordActive?: boolean;
    /** Increments on idle auto-lock; reset sensitive UI when it changes. */
    lockSignal?: number;
    onOpenGate?: () => void;
    onSessionPasswordChange?: () => void;
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

export default function PasswordManager({ settingsVersion = 0, onOpenSettings, sessionPasswordActive = false, onOpenGate, onSessionPasswordChange, lockSignal = 0 }: PasswordManagerProps) {
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

    // Master Password State (decrypt-on-view)
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

    // Idle auto-lock: wipe any plaintext / sensitive state and go back to
    // the list view so nothing stays visible on an unattended screen.
    useEffect(() => {
        if (lockSignal === 0) return; // skip initial mount
        setDecryptedPassword("");
        setShowPassword(false);
        setUnlockMasterPassword("");
        setUnlockError("");
        setShowUnlock(false);
        setShowCreate(false);
        setShowDeleteConfirm(false);
        setEditingAccount(null);
        setNewPassword("");
        setMasterPassword("");
        setConfirmMasterPassword("");
        setSelectedAccount(null);
        setView("list");
        setSearchTerm("");
    }, [lockSignal]);

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
            // Rust returns a typed account list (accounts.json)
            const loadedAccounts = await invoke<Account[]>("read_accounts");
            setAccounts(loadedAccounts);
        } catch (err) {
            setError("Failed to load accounts: " + String(err));
        } finally {
            setLoading(false);
        }
    };

    const saveAccounts = async (updatedAccounts: Account[]) => {
        try {
            await invoke("write_accounts", { accounts: updatedAccounts });
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
                // Open modal to unlock — prefill with session password if available
                setUnlockMasterPassword(getSessionPassword() ?? "");
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
        // Auto-fill master password from session memory (if set)
        const sessionPw = getSessionPassword();
        setMasterPassword(sessionPw ?? "");
        setConfirmMasterPassword(sessionPw ?? "");
        setShowCreate(true);
    };

    const handleAddClick = () => {
        setEditingAccount(null);
        setNewName("");
        setNewPassword("");
        setShowNewPassword(true); // Default to visible
        // Auto-fill master password from session memory (if set)
        const sessionPw = getSessionPassword();
        setMasterPassword(sessionPw ?? "");
        setConfirmMasterPassword(sessionPw ?? "");
        setShowCreate(true);
    };

    const handleSessionLockClick = () => {
        if (hasSessionPassword()) {
            // Manual lock: drop the session password from memory
            clearSessionPassword();
            onSessionPasswordChange?.();
            setNotification({ msg: "Session password cleared from memory", type: "success" });
        } else {
            // No session password yet — open the gate to set one
            onOpenGate?.();
        }
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
                    <button
                        className={`icon-btn ${sessionPasswordActive ? 'text-primary' : ''}`}
                        onClick={handleSessionLockClick}
                        title={sessionPasswordActive ? "Session password active — click to clear from memory" : "Set session password for autofill"}
                    >
                        {sessionPasswordActive ? (
                            <Lock size={24} />
                        ) : (
                            <LockOpen size={24} />
                        )}
                    </button>
                    <button className="icon-btn text-primary" onClick={handleAddClick} title="Add Password">
                        <CirclePlus size={24} />
                    </button>
                    <button className="icon-btn" onClick={onOpenSettings} title="Settings">
                        <Settings size={24} />
                    </button>
                </div>
            </div>

            <div className="pm-search">
                <div className="search-input-wrapper">
                    <Search size={20} className="search-icon" />
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
                            <X size={16} />
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
                                            <ChevronRight size={20} />
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
                                    <ChevronRight size={20} />
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
                        <ArrowLeft size={24} />
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
                                                <Copy size={24} />
                                            </button>
                                            <button className="icon-btn reveal-btn" onClick={handleTogglePassword} title="Hide Password">
                                                <EyeOff size={24} />
                                            </button>
                                        </>
                                    ) : (
                                        <button className="icon-btn reveal-btn" onClick={handleTogglePassword} title="Show Password">
                                            <Eye size={24} />
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
                                    className="icon-btn eye-toggle-btn"
                                    onClick={() => setShowNewPassword(!showNewPassword)}
                                    title={showNewPassword ? "Hide Password" : "Show Password"}
                                >
                                    {showNewPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                                </button>
                            </div>
                            <div className="divider"></div>
                            {newPassword && (
                                <>
                                    <input
                                        type="password"
                                        placeholder="Master Password (optional)"
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
                                            placeholder="Confirm Master Password"
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
                        <h3>Master Password</h3>
                        <div className="form-group">
                            <input
                                type="password"
                                placeholder="Enter Master Password"
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
