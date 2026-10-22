import { useEffect, useRef } from "react";

/**
 * Idle auto-lock (Apple Passwords / MetaMask style).
 *
 * After AUTO_LOCK_MS without user interaction:
 * - the session master password is dropped from memory,
 * - the UI returns to the list ("home") view with any revealed
 *   plaintext passwords hidden and modals closed,
 * - if a session password was active, the startup gate re-appears.
 *
 * Idle detection counts real user interaction only:
 * mouse move / press, wheel, key presses, touch, and window focus.
 * Long-running background work (e.g. file IO) does NOT keep it alive.
 *
 * Default: 5 minutes, matching mainstream crypto wallets (MetaMask
 * default) and stricter than 1Password's 10-minute desktop default.
 */
export const AUTO_LOCK_MS = 5 * 60 * 1000;

const ACTIVITY_EVENTS: (keyof WindowEventMap)[] = [
    "mousemove",
    "mousedown",
    "mouseup",
    "wheel",
    "keydown",
    "keypress",
    "touchstart",
    "touchmove",
    "focus",
];

export function useIdleAutoLock(onIdle: () => void, timeoutMs: number = AUTO_LOCK_MS) {
    const onIdleRef = useRef(onIdle);
    onIdleRef.current = onIdle;

    useEffect(() => {
        let lastActive = Date.now();
        let timer: number | undefined;

        const bump = () => {
            lastActive = Date.now();
        };

        const check = () => {
            if (Date.now() - lastActive >= timeoutMs) {
                // Re-arm first so a subsequent interaction starts a fresh window
                lastActive = Date.now();
                onIdleRef.current();
            }
        };

        // Use a short polling interval instead of one long setTimeout so a
        // sleep/wake cycle cannot leave a stale timer armed forever.
        timer = window.setInterval(check, 5_000);

        for (const evt of ACTIVITY_EVENTS) {
            window.addEventListener(evt, bump, { passive: true });
        }

        return () => {
            window.clearInterval(timer);
            for (const evt of ACTIVITY_EVENTS) {
                window.removeEventListener(evt, bump);
            }
        };
    }, [timeoutMs]);
}
