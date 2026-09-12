/**
 * Session master password — kept in MEMORY ONLY.
 *
 * Security notes:
 * - Stored in a module-level closure variable, never in React state
 *   (so it does not show up in React DevTools).
 * - NEVER written to localStorage / sessionStorage / disk / logs.
 * - NEVER rendered as plain text (consumers only use it to prefill
 *   `type="password"` inputs).
 * - Cleared (best-effort overwrite) via clearSessionPassword(), and it is
 *   gone naturally when the app process exits.
 */

let sessionPassword: string | null = null;

/** Save (or overwrite) the session password in memory. */
export function setSessionPassword(pw: string): void {
    sessionPassword = pw;
}

/** Get the session password, or null if not set. */
export function getSessionPassword(): string | null {
    return sessionPassword;
}

/** True if a session password is currently held in memory. */
export function hasSessionPassword(): boolean {
    return typeof sessionPassword === "string" && sessionPassword.length > 0;
}

/** Manually drop the password from memory (best-effort overwrite first). */
export function clearSessionPassword(): void {
    if (sessionPassword !== null) {
        // Best-effort scrub: JS strings are immutable, so true zeroing is not
        // possible, but we overwrite the reference content before dropping it.
        sessionPassword = "0".repeat(sessionPassword.length);
    }
    sessionPassword = null;
}
