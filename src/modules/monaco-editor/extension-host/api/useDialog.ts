/**
 * @module extension-host/api/useDialog
 *
 * React hook for the global dialog service.
 * Usable from any component — sidebar, status bar, header, editor, etc.
 *
 * Usage:
 *   const dialog = useDialog();
 *
 *   // Confirmation
 *   if (await dialog.confirm("Delete this file?")) { ... }
 *
 *   // Info / Warning / Error
 *   await dialog.info("Operation complete");
 *   const choice = await dialog.warn("Unsaved changes", "Save", "Discard");
 *
 *   // Input
 *   const name = await dialog.prompt("Enter file name");
 *
 *   // Quick pick
 *   const lang = await dialog.pick(["JavaScript", "TypeScript"], "Select language");
 *
 *   // Full control
 *   const result = await dialog.showInputBox({ prompt: "...", password: true });
 */

import { useMemo } from "react";
import { dialogService, type MessageSeverity } from "./dialog-service";

export interface DialogAPI {
    /** Show info message dialog. */
    info(message: string, ...items: string[]): Promise<string | undefined>;
    /** Show warning message dialog. */
    warn(message: string, ...items: string[]): Promise<string | undefined>;
    /** Show error message dialog. */
    error(message: string, ...items: string[]): Promise<string | undefined>;
    /** Confirmation dialog — returns true if confirmed. */
    confirm(
        message: string,
        options?: {
            severity?: MessageSeverity;
            detail?: string;
            confirmLabel?: string;
            cancelLabel?: string;
        },
    ): Promise<boolean>;
    /** Prompt for text input. */
    prompt(
        message: string,
        options?: {
            value?: string;
            placeHolder?: string;
            password?: boolean;
            validateInput?: (value: string) => string | null;
        },
    ): Promise<string | undefined>;
    /** Pick from a list. */
    pick(items: string[], placeHolder?: string): Promise<string | undefined>;
    /** Full showMessage control. */
    showMessage(
        severity: MessageSeverity,
        message: string,
        items: string[],
        detail?: string,
    ): Promise<string | undefined>;
    /** Full showInputBox control. */
    showInputBox(options?: {
        prompt?: string;
        value?: string;
        placeHolder?: string;
        password?: boolean;
        validateInput?: (value: string) => string | null;
    }): Promise<string | undefined>;
    /** Full showQuickPick control. */
    showQuickPick(
        items: string[],
        options?: { placeHolder?: string; canPickMany?: boolean },
    ): Promise<string | undefined>;
}

/**
 * React hook for the global dialog service.
 * Returns a stable API object — safe to use in dependency arrays.
 */
export function useDialog(): DialogAPI {
    return useMemo<DialogAPI>(
        () => ({
            info: (msg, ...items) => dialogService.info(msg, ...items),
            warn: (msg, ...items) => dialogService.warn(msg, ...items),
            error: (msg, ...items) => dialogService.error(msg, ...items),
            confirm: (msg, opts) => dialogService.confirm(msg, opts),
            prompt: (msg, opts) => dialogService.prompt(msg, opts),
            pick: (items, ph) => dialogService.pick(items, ph),
            showMessage: (sev, msg, items, detail) =>
                dialogService.showMessage(sev, msg, items, detail),
            showInputBox: (opts) => dialogService.showInputBox(opts),
            showQuickPick: (items, opts) =>
                dialogService.showQuickPick(items, opts),
        }),
        [],
    );
}
