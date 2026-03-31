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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
            <DialogContent className="sm:max-w-[480px]">
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
            <DialogHeader>
                <div className="flex items-center gap-3">
                    <Icon className={cn("h-6 w-6 shrink-0", config.color)} />
                    <DialogTitle>{config.title}</DialogTitle>
                </div>
                <DialogDescription className="mt-2 text-sm leading-relaxed">
                    {request.message}
                </DialogDescription>
            </DialogHeader>
            <DialogFooter className="flex-row justify-end gap-2 sm:justify-end">
                {request.items.length > 0 ? (
                    request.items.map((item) => (
                        <Button
                            key={item}
                            variant="outline"
                            size="sm"
                            onClick={() => onSelect(item)}
                        >
                            {item}
                        </Button>
                    ))
                ) : (
                    <Button size="sm" onClick={onClose}>
                        OK
                    </Button>
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
    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter") {
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
            <DialogHeader>
                <DialogTitle>
                    {request.prompt ?? "Input"}
                </DialogTitle>
            </DialogHeader>
            <Input
                autoFocus
                type={request.password ? "password" : "text"}
                placeholder={request.placeHolder}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                onKeyDown={handleKeyDown}
            />
            <DialogFooter className="flex-row justify-end gap-2 sm:justify-end">
                <Button variant="outline" size="sm" onClick={onClose}>
                    Cancel
                </Button>
                <Button size="sm" onClick={onSubmit}>
                    OK
                </Button>
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
            <DialogHeader>
                <DialogTitle>
                    {request.placeHolder ?? "Select an item"}
                </DialogTitle>
            </DialogHeader>

            <Input
                autoFocus
                placeholder="Type to filter..."
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                onKeyDown={(e) => {
                    if (e.key === "Escape") {
                        e.preventDefault();
                        onClose();
                    }
                }}
            />

            <div className="max-h-[300px] overflow-y-auto rounded-md border">
                {filtered.map((item) => (
                    <button
                        key={item}
                        type="button"
                        className={cn(
                            "flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors",
                            "hover:bg-accent hover:text-accent-foreground",
                            selected.has(item) && "bg-accent",
                        )}
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
                                className={cn(
                                    "flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border",
                                    selected.has(item)
                                        ? "border-primary bg-primary text-primary-foreground"
                                        : "border-muted-foreground",
                                )}
                            >
                                {selected.has(item) && (
                                    <Check className="h-3 w-3" />
                                )}
                            </div>
                        )}
                        {item}
                    </button>
                ))}
                {filtered.length === 0 && (
                    <div className="px-3 py-4 text-center text-sm text-muted-foreground">
                        No matching items
                    </div>
                )}
            </div>

            {request.canPickMany && (
                <DialogFooter className="flex-row justify-end gap-2 sm:justify-end">
                    <Button variant="outline" size="sm" onClick={onClose}>
                        Cancel
                    </Button>
                    <Button
                        size="sm"
                        disabled={selected.size === 0}
                        onClick={onSubmit}
                    >
                        OK ({selected.size})
                    </Button>
                </DialogFooter>
            )}
        </>
    );
}
