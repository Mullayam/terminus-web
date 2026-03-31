/**
 * @module extension-host/api/ExtensionDialogHost
 *
 * React component that renders VS Code-style dialogs for extensions.
 * Mount this once at the app root (or editor layout).
 *
 * Handles:
 *   - showInformationMessage / showWarningMessage / showErrorMessage
 *   - showInputBox
 *   - showQuickPick
 */

import * as React from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "@/components/ui/dialog";
import {
    AlertCircle,
    AlertTriangle,
    Info,
    Check,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
    dialogService,
    type DialogRequest,
    type MessageSeverity,
} from "./dialog-service";

// ─── Severity config ─────────────────────────────────────────

const SEVERITY_CONFIG: Record<
    MessageSeverity,
    { icon: React.ElementType; color: string; title: string }
> = {
    info: {
        icon: Info,
        color: "text-blue-500",
        title: "Information",
    },
    warning: {
        icon: AlertTriangle,
        color: "text-yellow-500",
        title: "Warning",
    },
    error: {
        icon: AlertCircle,
        color: "text-red-500",
        title: "Error",
    },
};

// ─── Component ───────────────────────────────────────────────

export function ExtensionDialogHost() {
    const [current, setCurrent] = React.useState<DialogRequest | null>(null);
    const [inputValue, setInputValue] = React.useState("");
    const [selectedItems, setSelectedItems] = React.useState<Set<string>>(
        new Set(),
    );

    React.useEffect(() => {
        const sub = dialogService.onRequest((req) => {
            setCurrent(req);
            setInputValue(
                req.kind === "inputBox" ? (req.value ?? "") : "",
            );
            setSelectedItems(new Set());
        });
        return () => sub.dispose();
    }, []);

    const handleClose = React.useCallback(() => {
        if (current) {
            dialogService.cancel(current.id);
            setCurrent(null);
        }
    }, [current]);

    const handleResolve = React.useCallback(
        (value: unknown) => {
            if (current) {
                dialogService.resolve(current.id, value);
                setCurrent(null);
            }
        },
        [current],
    );

    if (!current) return null;

    return (
        <Dialog open onOpenChange={(open) => !open && handleClose()}>
            <DialogContent
                className="sm:max-w-[480px] p-0 gap-0 overflow-hidden border shadow-2xl"
                style={{
                    background: "var(--editor-bg, #1e1e1e)",
                    color: "var(--editor-fg, #cccccc)",
                    borderColor: "var(--editor-border, #3c3c3c)",
                }}
            >
                {current.kind === "message" && (
                    <MessageDialog
                        request={current}
                        onSelect={handleResolve}
                        onClose={handleClose}
                    />
                )}
                {current.kind === "inputBox" && (
                    <InputBoxDialog
                        request={current}
                        value={inputValue}
                        onChange={setInputValue}
                        onSubmit={() => handleResolve(inputValue)}
                        onClose={handleClose}
                    />
                )}
                {current.kind === "quickPick" && (
                    <QuickPickDialog
                        request={current}
                        selected={selectedItems}
                        onToggle={(item) => {
                            setSelectedItems((prev) => {
                                const next = new Set(prev);
                                if (next.has(item)) {
                                    next.delete(item);
                                } else {
                                    if (!current.canPickMany) next.clear();
                                    next.add(item);
                                }
                                return next;
                            });
                        }}
                        onSelect={(item) => handleResolve(item)}
                        onSubmit={() =>
                            handleResolve([...selectedItems][0])
                        }
                        onClose={handleClose}
                    />
                )}
            </DialogContent>
        </Dialog>
    );
}

// ─── Message dialog ──────────────────────────────────────────

function MessageDialog({
    request,
    onSelect,
    onClose,
}: {
    request: Extract<DialogRequest, { kind: "message" }>;
    onSelect: (value: string | undefined) => void;
    onClose: () => void;
}) {
    const config = SEVERITY_CONFIG[request.severity];
    const Icon = config.icon;

    return (
        <>
            <div className="px-5 pt-5 pb-3" style={{ borderBottom: "1px solid var(--editor-border, #3c3c3c)" }}>
                <DialogHeader>
                    <div className="flex items-center gap-3">
                        <Icon className={cn("h-5 w-5 shrink-0", config.color)} />
                        <DialogTitle className="text-sm font-semibold" style={{ color: "var(--editor-fg, #cccccc)" }}>
                            {config.title}
                        </DialogTitle>
                    </div>
                    <DialogDescription className="mt-2 text-[13px] leading-relaxed" style={{ color: "var(--editor-fg, #cccccc)", opacity: 0.85 }}>
                        {request.message}
                    </DialogDescription>
                    {request.detail && (
                        <p className="mt-1 text-xs leading-relaxed" style={{ color: "var(--editor-fg, #808080)", opacity: 0.6 }}>
                            {request.detail}
                        </p>
                    )}
                </DialogHeader>
            </div>
            <DialogFooter className="px-5 py-3 flex-row justify-end gap-2 sm:justify-end">
                {request.items.length > 0 ? (
                    request.items.map((item) => (
                        <button
                            key={item}
                            className="px-3 py-1.5 text-xs font-medium rounded transition-colors"
                            style={{
                                background: "var(--editor-hover-bg, #37373d)",
                                color: "var(--editor-fg, #cccccc)",
                                border: "1px solid var(--editor-border, #3c3c3c)",
                            }}
                            onMouseEnter={(e) => { e.currentTarget.style.background = "var(--editor-accent, #007acc)"; }}
                            onMouseLeave={(e) => { e.currentTarget.style.background = "var(--editor-hover-bg, #37373d)"; }}
                            onClick={() => onSelect(item)}
                        >
                            {item}
                        </button>
                    ))
                ) : (
                    <button
                        className="px-4 py-1.5 text-xs font-medium rounded transition-colors"
                        style={{ background: "var(--editor-accent, #007acc)", color: "#fff" }}
                        onClick={onClose}
                    >
                        OK
                    </button>
                )}
            </DialogFooter>
        </>
    );
}

// ─── Input box dialog ────────────────────────────────────────

function InputBoxDialog({
    request,
    value,
    onChange,
    onSubmit,
    onClose,
}: {
    request: Extract<DialogRequest, { kind: "inputBox" }>;
    value: string;
    onChange: (v: string) => void;
    onSubmit: () => void;
    onClose: () => void;
}) {
    const validationError = request.validateInput
        ? request.validateInput(value)
        : null;

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter" && !validationError) {
            e.preventDefault();
            onSubmit();
        }
        if (e.key === "Escape") {
            e.preventDefault();
            onClose();
        }
    };

    return (
        <>
            <div className="px-5 pt-5 pb-3" style={{ borderBottom: "1px solid var(--editor-border, #3c3c3c)" }}>
                <DialogHeader>
                    <DialogTitle className="text-sm font-semibold" style={{ color: "var(--editor-fg, #cccccc)" }}>
                        {request.prompt ?? "Input"}
                    </DialogTitle>
                </DialogHeader>
            </div>
            <div className="px-5 py-4">
                <input
                    autoFocus
                    type={request.password ? "password" : "text"}
                    placeholder={request.placeHolder}
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    onKeyDown={handleKeyDown}
                    className="w-full rounded px-3 py-1.5 text-sm outline-none transition-colors"
                    style={{
                        background: "var(--editor-hover-bg, #37373d)",
                        color: "var(--editor-fg, #cccccc)",
                        border: `1px solid ${validationError ? "#f14c4c" : "var(--editor-border, #3c3c3c)"}`,
                    }}
                />
                {validationError && (
                    <p className="mt-1 text-xs" style={{ color: "#f14c4c" }}>{validationError}</p>
                )}
            </div>
            <DialogFooter className="px-5 py-3 flex-row justify-end gap-2 sm:justify-end" style={{ borderTop: "1px solid var(--editor-border, #3c3c3c)" }}>
                <button
                    className="px-3 py-1.5 text-xs font-medium rounded transition-colors"
                    style={{ background: "var(--editor-hover-bg, #37373d)", color: "var(--editor-fg, #cccccc)", border: "1px solid var(--editor-border, #3c3c3c)" }}
                    onClick={onClose}
                >
                    Cancel
                </button>
                <button
                    className="px-4 py-1.5 text-xs font-medium rounded transition-colors"
                    style={{ background: validationError ? "#37373d" : "var(--editor-accent, #007acc)", color: "#fff", opacity: validationError ? 0.5 : 1 }}
                    disabled={!!validationError}
                    onClick={onSubmit}
                >
                    OK
                </button>
            </DialogFooter>
        </>
    );
}

// ─── Quick pick dialog ───────────────────────────────────────

function QuickPickDialog({
    request,
    selected,
    onToggle,
    onSelect,
    onSubmit,
    onClose,
}: {
    request: Extract<DialogRequest, { kind: "quickPick" }>;
    selected: Set<string>;
    onToggle: (item: string) => void;
    onSelect: (item: string) => void;
    onSubmit: () => void;
    onClose: () => void;
}) {
    const [filter, setFilter] = React.useState("");

    const filtered = request.items.filter((item) =>
        item.toLowerCase().includes(filter.toLowerCase()),
    );

    return (
        <>
            <div className="px-5 pt-5 pb-3" style={{ borderBottom: "1px solid var(--editor-border, #3c3c3c)" }}>
                <DialogHeader>
                    <DialogTitle className="text-sm font-semibold" style={{ color: "var(--editor-fg, #cccccc)" }}>
                        {request.placeHolder ?? "Select an item"}
                    </DialogTitle>
                </DialogHeader>
            </div>

            <div className="px-5 pt-3">
                <input
                    autoFocus
                    placeholder="Type to filter..."
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                    className="w-full rounded px-3 py-1.5 text-sm outline-none"
                    style={{ background: "var(--editor-hover-bg, #37373d)", color: "var(--editor-fg, #cccccc)", border: "1px solid var(--editor-border, #3c3c3c)" }}
                    onKeyDown={(e) => {
                        if (e.key === "Escape") {
                            e.preventDefault();
                            onClose();
                        }
                    }}
                />
            </div>

            <div className="mx-5 my-3 max-h-[300px] overflow-y-auto rounded" style={{ border: "1px solid var(--editor-border, #3c3c3c)" }}>
                {filtered.map((item) => (
                    <button
                        key={item}
                        type="button"
                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] transition-colors"
                        style={{ color: "var(--editor-fg, #cccccc)" }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = "var(--editor-hover-bg, #37373d)"; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = selected.has(item) ? "var(--editor-hover-bg, #37373d)" : "transparent"; }}
                        onClick={() => {
                            if (request.canPickMany) {
                                onToggle(item);
                            } else {
                                onSelect(item);
                            }
                        }}
                    >
                        {request.canPickMany && (
                            <div
                                className="flex h-4 w-4 shrink-0 items-center justify-center rounded-sm"
                                style={{
                                    border: `1px solid ${selected.has(item) ? "var(--editor-accent, #007acc)" : "var(--editor-border, #3c3c3c)"}`,
                                    background: selected.has(item) ? "var(--editor-accent, #007acc)" : "transparent",
                                }}
                            >
                                {selected.has(item) && (
                                    <Check className="h-3 w-3" style={{ color: "#fff" }} />
                                )}
                            </div>
                        )}
                        {item}
                    </button>
                ))}
                {filtered.length === 0 && (
                    <div className="px-3 py-4 text-center text-[13px]" style={{ color: "var(--editor-fg, #808080)", opacity: 0.6 }}>
                        No matching items
                    </div>
                )}
            </div>

            {request.canPickMany && (
                <DialogFooter className="px-5 py-3 flex-row justify-end gap-2 sm:justify-end" style={{ borderTop: "1px solid var(--editor-border, #3c3c3c)" }}>
                    <button
                        className="px-3 py-1.5 text-xs font-medium rounded transition-colors"
                        style={{ background: "var(--editor-hover-bg, #37373d)", color: "var(--editor-fg, #cccccc)", border: "1px solid var(--editor-border, #3c3c3c)" }}
                        onClick={onClose}
                    >
                        Cancel
                    </button>
                    <button
                        className="px-4 py-1.5 text-xs font-medium rounded transition-colors"
                        style={{ background: selected.size === 0 ? "#37373d" : "var(--editor-accent, #007acc)", color: "#fff", opacity: selected.size === 0 ? 0.5 : 1 }}
                        disabled={selected.size === 0}
                        onClick={onSubmit}
                    >
                        OK ({selected.size})
                    </button>
                </DialogFooter>
            )}
        </>
    );
}
