/**
 * @module extension-host/api/notification-service
 *
 * Bridges extension host `vscode.window.show*Message` calls to the
 * EditorNotifications system (VS Code-style toast overlays).
 *
 * Flow:
 *   Extension (Worker) → RPC "window/showMessage" → Main Thread →
 *   NotificationService → showEditorNotification() → EditorNotifications UI
 *
 * For input dialogs (showInputBox, showQuickPick), use dialog-service.ts instead.
 */

import type { Disposable } from "../types";

// ─── Types ───────────────────────────────────────────────────

export type NotificationSeverity = "info" | "warning" | "error" | "success";

export interface NotificationOptions {
    source?: string;
    detail?: string;
    timeout?: number;
    actions?: Array<{ label: string; onClick: () => void; primary?: boolean }>;
}

/**
 * Signature matching showEditorNotification from notification-plugin.ts.
 * Accepts a function reference so the extension-host module stays
 * decoupled from the plugin module.
 */
export type ShowNotificationFn = (
    message: string,
    severity: NotificationSeverity,
    options?: NotificationOptions,
) => string | null;

// ─── Notification service (singleton) ────────────────────────

class NotificationServiceImpl {
    private showFn: ShowNotificationFn | null = null;

    /**
     * Register the notification display function.
     * Called once when the editor mounts — typically with showEditorNotification.
     */
    setHandler(fn: ShowNotificationFn): Disposable {
        this.showFn = fn;
        return {
            dispose: () => {
                if (this.showFn === fn) {
                    this.showFn = null;
                }
            },
        };
    }

    /**
     * Show a notification. Returns the notification ID on success,
     * or null if no handler is registered.
     *
     * Maps message severity:
     *   - "info"    → info toast (blue)
     *   - "warning" → warning toast (yellow)
     *   - "error"   → error toast (red)
     */
    show(
        severity: NotificationSeverity,
        message: string,
        items: string[],
    ): Promise<string | undefined> {
        return new Promise<string | undefined>((resolve) => {
            if (!this.showFn) {
                // Fallback to console if no UI handler
                this.consoleFallback(severity, message);
                resolve(undefined);
                return;
            }

            if (items.length === 0) {
                // No action buttons — just show a toast, resolve immediately
                this.showFn(message, severity);
                resolve(undefined);
                return;
            }

            // With action buttons — resolve with the label the user clicks
            const actions = items.map((label) => ({
                label,
                primary: false,
                onClick: () => resolve(label),
            }));
            // Mark the first item as primary (VS Code convention)
            if (actions.length > 0) {
                actions[0].primary = true;
            }

            this.showFn(message, severity, {
                actions,
                // Don't auto-dismiss if there are actions to click
                timeout: 0,
            });
        });
    }

    /** Quick convenience methods matching VS Code API names. */
    showInformation(message: string, ...items: string[]) {
        return this.show("info", message, items);
    }

    showWarning(message: string, ...items: string[]) {
        return this.show("warning", message, items);
    }

    showError(message: string, ...items: string[]) {
        return this.show("error", message, items);
    }

    private consoleFallback(severity: string, message: string): void {
        switch (severity) {
            case "error":
                console.error(`[Extension] ${message}`);
                break;
            case "warning":
                console.warn(`[Extension] ${message}`);
                break;
            default:
                console.info(`[Extension] ${message}`);
        }
    }
}

/** Singleton notification service. */
export const notificationService = new NotificationServiceImpl();
