/**
 * @module extension-host/api/dialog-service
 *
 * Global dialog system — usable from ANYWHERE in the app.
 *
 * Two categories:
 *   1. Modal dialogs (showMessage, showInputBox, showQuickPick)
 *   2. Convenience helpers (confirm, prompt, pick)
 *
 * Works from:
 *   - Extension host (via RPC)
 *   - Monaco editor sidebar, status bar, header
 *   - Any React component (via useDialog hook)
 *   - Any imperative code (via dialogService singleton)
 *
 * The React UI is rendered by <ExtensionDialogHost> mounted at the app root.
 */

import type { Disposable } from "../types";

// ─── Dialog request types ────────────────────────────────────

export type MessageSeverity = "info" | "warning" | "error";

export interface ShowMessageRequest {
    kind: "message";
    id: string;
    severity: MessageSeverity;
    message: string;
    detail?: string;
    items: string[];
}

export interface ShowInputBoxRequest {
    kind: "inputBox";
    id: string;
    prompt?: string;
    value?: string;
    placeHolder?: string;
    password?: boolean;
    validateInput?: (value: string) => string | null;
}

export interface ShowQuickPickRequest {
    kind: "quickPick";
    id: string;
    items: string[];
    placeHolder?: string;
    canPickMany?: boolean;
}

export type DialogRequest =
    | ShowMessageRequest
    | ShowInputBoxRequest
    | ShowQuickPickRequest;

// ─── Dialog service (singleton event bus) ────────────────────

type DialogHandler = (request: DialogRequest) => void;

class DialogServiceImpl {
    private handler: DialogHandler | null = null;
    private pending = new Map<
        string,
        { resolve: (value: unknown) => void }
    >();
    private nextId = 0;

    /**
     * Register the UI handler. Called once by <ExtensionDialogHost>.
     * Only one handler at a time.
     */
    onRequest(handler: DialogHandler): Disposable {
        this.handler = handler;
        return {
            dispose: () => {
                if (this.handler === handler) {
                    this.handler = null;
                }
            },
        };
    }

    // ═══════════════════════════════════════════════════════════
    //  Core dialog methods (used by RPC + anywhere)
    // ═══════════════════════════════════════════════════════════

    /** Show a modal message dialog with optional action buttons. */
    showMessage(
        severity: MessageSeverity,
        message: string,
        items: string[],
        detail?: string,
    ): Promise<string | undefined> {
        return this.request<string | undefined>({
            kind: "message",
            id: this.genId(),
            severity,
            message,
            detail,
            items,
        });
    }

    showInputBox(options?: {
        prompt?: string;
        value?: string;
        placeHolder?: string;
        password?: boolean;
        validateInput?: (value: string) => string | null;
    }): Promise<string | undefined> {
        return this.request<string | undefined>({
            kind: "inputBox",
            id: this.genId(),
            ...options,
        });
    }

    showQuickPick(
        items: string[],
        options?: { placeHolder?: string; canPickMany?: boolean },
    ): Promise<string | undefined> {
        return this.request<string | undefined>({
            kind: "quickPick",
            id: this.genId(),
            items,
            ...options,
        });
    }

    // ═══════════════════════════════════════════════════════════
    //  Convenience helpers (for sidebar, status bar, anywhere)
    // ═══════════════════════════════════════════════════════════

    /** Show an info dialog. */
    info(message: string, ...items: string[]): Promise<string | undefined> {
        return this.showMessage("info", message, items);
    }

    /** Show a warning dialog. */
    warn(message: string, ...items: string[]): Promise<string | undefined> {
        return this.showMessage("warning", message, items);
    }

    /** Show an error dialog. */
    error(message: string, ...items: string[]): Promise<string | undefined> {
        return this.showMessage("error", message, items);
    }

    /**
     * Confirmation dialog — returns true if confirmed, false otherwise.
     *
     * Usage:
     *   if (await dialogService.confirm("Delete this file?")) { ... }
     *   if (await dialogService.confirm("Discard changes?", { severity: "warning", detail: "..." })) { ... }
     */
    async confirm(
        message: string,
        options?: {
            severity?: MessageSeverity;
            detail?: string;
            confirmLabel?: string;
            cancelLabel?: string;
        },
    ): Promise<boolean> {
        const confirmLabel = options?.confirmLabel ?? "OK";
        const cancelLabel = options?.cancelLabel ?? "Cancel";
        const result = await this.showMessage(
            options?.severity ?? "info",
            message,
            [confirmLabel, cancelLabel],
            options?.detail,
        );
        return result === confirmLabel;
    }

    /**
     * Prompt for text input — shorthand for showInputBox.
     *
     * Usage:
     *   const name = await dialogService.prompt("Enter file name");
     *   const pass = await dialogService.prompt("Enter password", { password: true });
     */
    prompt(
        message: string,
        options?: {
            value?: string;
            placeHolder?: string;
            password?: boolean;
            validateInput?: (value: string) => string | null;
        },
    ): Promise<string | undefined> {
        return this.showInputBox({
            prompt: message,
            ...options,
        });
    }

    /**
     * Pick from a list — shorthand for showQuickPick.
     *
     * Usage:
     *   const lang = await dialogService.pick(["JavaScript", "TypeScript"], "Select language");
     */
    pick(
        items: string[],
        placeHolder?: string,
    ): Promise<string | undefined> {
        return this.showQuickPick(items, { placeHolder });
    }

    // ═══════════════════════════════════════════════════════════
    //  React UI bridge
    // ═══════════════════════════════════════════════════════════

    /** Called by the React UI when the user responds. */
    resolve(requestId: string, value: unknown): void {
        const p = this.pending.get(requestId);
        if (p) {
            this.pending.delete(requestId);
            p.resolve(value);
        }
    }

    /** Called by the React UI when the user cancels/dismisses. */
    cancel(requestId: string): void {
        this.resolve(requestId, undefined);
    }

    // ─── Internal ────────────────────────────────────────────

    private request<T>(req: DialogRequest): Promise<T> {
        return new Promise<T>((resolve) => {
            this.pending.set(req.id, {
                resolve: resolve as (v: unknown) => void,
            });

            if (this.handler) {
                this.handler(req);
            } else {
                console.warn(
                    "[DialogService] No UI handler registered, auto-resolving",
                );
                this.pending.delete(req.id);
                resolve(undefined as T);
            }
        });
    }

    private genId(): string {
        return `dlg_${++this.nextId}_${Date.now()}`;
    }
}

/** Singleton dialog service. */
export const dialogService = new DialogServiceImpl();
