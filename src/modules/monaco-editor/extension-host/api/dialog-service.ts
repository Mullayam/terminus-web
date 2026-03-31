/**
 * @module extension-host/api/dialog-service
 *
 * Event bus-driven dialog system for vscode.window.show*Message,
 * showInputBox, and showQuickPick calls.
 *
 * Dialogs are MODAL (block until user responds).
 * For non-blocking toast notifications, see notification-service.ts.
 *
 * Flow:
 *   Extension (Worker) → RPC → Main Thread → DialogService.emit() →
 *   React UI (ExtensionDialogHost) renders dialog → user responds →
 *   Promise resolves → RPC response → Extension gets result
 *
 * This runs on the MAIN THREAD.
 */

import type { Disposable } from "../types";

// ─── Dialog request types ────────────────────────────────────

export type MessageSeverity = "info" | "warning" | "error";

export interface ShowMessageRequest {
    kind: "message";
    id: string;
    severity: MessageSeverity;
    message: string;
    items: string[];
}

export interface ShowInputBoxRequest {
    kind: "inputBox";
    id: string;
    prompt?: string;
    value?: string;
    placeHolder?: string;
    password?: boolean;
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

    /** Show a modal message dialog with optional action buttons. */
    showMessage(
        severity: MessageSeverity,
        message: string,
        items: string[],
    ): Promise<string | undefined> {
        return this.request<string | undefined>({
            kind: "message",
            id: this.genId(),
            severity,
            message,
            items,
        });
    }

    showInputBox(options?: {
        prompt?: string;
        value?: string;
        placeHolder?: string;
        password?: boolean;
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
                // No UI handler registered — auto-resolve with undefined (no UI available)
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
