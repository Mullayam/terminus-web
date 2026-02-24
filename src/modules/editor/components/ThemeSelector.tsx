/**
 * @module editor/components/ThemeSelector
 * Side panel showing all available themes with a live preview swatch.
 */
import { memo, useEffect, useState } from "react";
import { X, Check, Download, Upload, Trash2, Plus } from "lucide-react";
import { ThemeManager } from "../themes/manager";
import { useEditorStore } from "../state/context";
import type { EditorTheme } from "../types";

export const ThemeSelector = memo(function ThemeSelector() {
    const showThemeSelector = useEditorStore((s) => s.showThemeSelector);
    const themeId = useEditorStore((s) => s.activeThemeId);
    const setThemeId = useEditorStore((s) => s.setThemeId);
    const closeThemeSelector = useEditorStore((s) => s.closeThemeSelector);
    const [themes, setThemes] = useState<EditorTheme[]>([]);

    const mgr = ThemeManager.getInstance();

    useEffect(() => {
        setThemes(mgr.getAll());
        return mgr.subscribe(() => setThemes(mgr.getAll()));
    }, [mgr]);

    if (!showThemeSelector) return null;

    const handleExport = () => {
        const data = JSON.stringify(mgr.exportToJSON(), null, 2);
        const blob = new Blob([data], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url; a.download = "editor-themes.json"; a.click();
        URL.revokeObjectURL(url);
    };

    const handleImport = () => {
        const input = document.createElement("input");
        input.type = "file"; input.accept = ".json";
        input.onchange = () => {
            const file = input.files?.[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = () => {
                try { mgr.importFromJSON(JSON.parse(reader.result as string)); }
                catch { /* ignore bad files */ }
            };
            reader.readAsText(file);
        };
        input.click();
    };

    const handleDelete = (id: string) => {
        if (confirm("Delete this theme?")) mgr.deleteTheme(id);
    };

    return (
        <div
            className="flex flex-col"
            style={{
                width: 240,
                background: "var(--editor-popup-bg)",
                borderLeft: "1px solid var(--editor-border)",
                color: "var(--editor-foreground)",
                overflowY: "auto",
            }}
        >
            {/* Header */}
            <div
                className="flex items-center justify-between px-3 py-2"
                style={{ borderBottom: "1px solid var(--editor-border)" }}
            >
                <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--editor-accent)" }}>
                    Themes
                </span>
                <button
                    onClick={closeThemeSelector}
                    style={{ padding: 2, background: "transparent", border: "none", color: "var(--editor-muted)", cursor: "pointer" }}
                >
                    <X className="w-3.5 h-3.5" />
                </button>
            </div>

            {/* Actions */}
            <div
                className="flex items-center gap-1 px-3 py-1.5"
                style={{ borderBottom: "1px solid var(--editor-border)" }}
            >
                <SmallBtn icon={<Download className="w-3 h-3" />} label="Export" onClick={handleExport} />
                <SmallBtn icon={<Upload className="w-3 h-3" />} label="Import" onClick={handleImport} />
            </div>

            {/* Theme list */}
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
                {themes.map((t) => (
                    <ThemeCard
                        key={t.id}
                        theme={t}
                        active={t.id === themeId}
                        onClick={() => setThemeId(t.id)}
                        onDelete={t.isBuiltIn ? undefined : () => handleDelete(t.id)}
                    />
                ))}
            </div>
        </div>
    );
});

/* ── helper components ─────────────────────────────────── */

function SmallBtn(props: { icon: React.ReactNode; label: string; onClick: () => void }) {
    return (
        <button
            onClick={props.onClick}
            className="flex items-center gap-1 text-[11px] px-2 py-1 rounded"
            style={{
                background: "var(--editor-popup-hover-bg)",
                color: "var(--editor-muted)",
                border: "none", cursor: "pointer",
            }}
        >
            {props.icon} {props.label}
        </button>
    );
}

function ThemeCard(props: { theme: EditorTheme; active: boolean; onClick: () => void; onDelete?: () => void }) {
    const { theme: t, active } = props;
    const colors = t.colors;

    return (
        <button
            onClick={props.onClick}
            className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left transition-colors"
            style={{
                background: active ? "var(--editor-selection)" : "transparent",
                border: active ? "1px solid var(--editor-accent)" : "1px solid transparent",
                cursor: "pointer",
                color: "var(--editor-foreground)",
            }}
            onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = "var(--editor-popup-hover-bg)"; }}
            onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = "transparent"; }}
        >
            {/* Swatch */}
            <div
                className="w-7 h-7 rounded shrink-0 flex items-center justify-center"
                style={{
                    background: colors.background,
                    border: `1px solid ${colors.border}`,
                }}
            >
                {active && <Check className="w-3.5 h-3.5" style={{ color: colors.accent }} />}
            </div>

            {/* Name */}
            <div className="flex-1 min-w-0">
                <div className="text-[12px] font-medium truncate">{t.name}</div>
                <div className="text-[10px] truncate" style={{ color: "var(--editor-muted)" }}>
                    {t.isBuiltIn ? "Built-in" : "Custom"}
                </div>
            </div>

            {/* Delete */}
            {props.onDelete && (
                <button
                    onClick={(e) => { e.stopPropagation(); props.onDelete!(); }}
                    style={{ padding: 2, background: "transparent", border: "none", color: "var(--editor-muted)", cursor: "pointer" }}
                    title="Delete"
                >
                    <Trash2 className="w-3 h-3" />
                </button>
            )}
        </button>
    );
}
