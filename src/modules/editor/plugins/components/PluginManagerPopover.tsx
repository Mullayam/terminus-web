/**
 * @module editor/plugins/components/PluginManagerPopover
 *
 * Themed inline plugin-manager panel that renders inside the editor layout.
 * Uses --editor-* CSS custom properties so it always matches the active theme.
 *
 * Opens with a CSS-only slide/fade animation (GPU-accelerated via transform).
 * No portals, no position: fixed, no flicker.
 *
 * Each plugin row shows:
 *   - Category badge (color-coded)
 *   - Plugin name + version
 *   - Description (if available)
 *   - Toggle switch
 */
import { memo, useState, useCallback, useMemo, useRef, useEffect } from "react";
import type { PluginHostState, ExtendedEditorPlugin } from "../types";
import type { PluginHost } from "../PluginHost";

interface PluginManagerPopoverProps {
    host: PluginHost;
    snapshot: PluginHostState;
    open: boolean;
    onClose: () => void;
    /** Unused — kept for API compat */
    anchorRef?: React.RefObject<HTMLElement | null>;
}

const CATEGORY_COLORS: Record<string, string> = {
    editor: "#50fa7b",
    language: "#8be9fd",
    ai: "#bd93f9",
    ui: "#ffb86c",
    validation: "#f1fa8c",
    tools: "#ff79c6",
};

const CATEGORY_LABELS: Record<string, string> = {
    editor: "Editor",
    language: "Language",
    ai: "AI",
    ui: "UI",
    validation: "Validation",
    tools: "Tools",
};

export const PluginManagerPopover = memo(function PluginManagerPopover({
    host,
    snapshot,
    open,
    onClose,
}: PluginManagerPopoverProps) {
    const [filter, setFilter] = useState("");
    const panelRef = useRef<HTMLDivElement>(null);
    const filterRef = useRef<HTMLInputElement>(null);

    // ── Close on Escape ──────────────────────────────────────
    useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                e.stopPropagation();
                onClose();
            }
        };
        document.addEventListener("keydown", onKey, true);
        return () => document.removeEventListener("keydown", onKey, true);
    }, [open, onClose]);

    // ── Focus filter input when panel opens ──────────────────
    useEffect(() => {
        if (open) {
            requestAnimationFrame(() => filterRef.current?.focus());
        } else {
            setFilter("");
        }
    }, [open]);

    // ── Close on click outside ───────────────────────────────
    useEffect(() => {
        if (!open) return;
        const onClick = (e: MouseEvent) => {
            if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
                onClose();
            }
        };
        // Delay to avoid catching the same click that opened the panel
        const timer = setTimeout(() => {
            document.addEventListener("mousedown", onClick);
        }, 0);
        return () => {
            clearTimeout(timer);
            document.removeEventListener("mousedown", onClick);
        };
    }, [open, onClose]);

    const togglePlugin = useCallback(
        (pluginId: string) => {
            if (snapshot.enabledPlugins.has(pluginId)) {
                host.disable(pluginId);
            } else {
                host.enable(pluginId);
            }
        },
        [host, snapshot.enabledPlugins],
    );

    const allPlugins = useMemo(
        () => Array.from(snapshot.plugins.values()),
        [snapshot.plugins],
    );

    const filtered = useMemo(() => {
        if (!filter) return allPlugins;
        const q = filter.toLowerCase();
        return allPlugins.filter(
            (p) =>
                p.name.toLowerCase().includes(q) ||
                p.id.toLowerCase().includes(q) ||
                (p.category ?? "").toLowerCase().includes(q),
        );
    }, [allPlugins, filter]);

    const groups = useMemo(() => {
        const m = new Map<string, ExtendedEditorPlugin[]>();
        for (const p of filtered) {
            const cat = p.category ?? "tools";
            if (!m.has(cat)) m.set(cat, []);
            m.get(cat)!.push(p);
        }
        return m;
    }, [filtered]);

    const enabledCount = snapshot.enabledPlugins.size;
    const totalCount = snapshot.plugins.size;

    if (!open) return null;

    return (
        <div
            ref={panelRef}
            className="plugin-manager-panel"
            style={{
                position: "absolute",
                top: 0,
                right: 0,
                bottom: 0,
                width: 320,
                maxWidth: "85%",
                zIndex: 30,
                display: "flex",
                flexDirection: "column",
                background: "var(--editor-popup-bg, #1e1f29)",
                borderLeft: "1px solid var(--editor-border, #44475a)",
                color: "var(--editor-foreground, #f8f8f2)",
                fontFamily: "var(--editor-font-family)",
                fontSize: 12,
                boxShadow: "-4px 0 16px rgba(0,0,0,0.3)",
                animation: "plugin-panel-slide-in 150ms ease-out both",
                willChange: "transform, opacity",
            }}
        >
            {/* ── Header ─────────────────────────────────────── */}
            <div
                style={{
                    padding: "10px 12px 8px",
                    borderBottom: "1px solid var(--editor-border, #44475a)",
                    display: "flex",
                    flexDirection: "column",
                    gap: 6,
                    background: "var(--editor-toolbar-bg, var(--editor-popup-bg, #1e1f29))",
                }}
            >
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <svg
                        width="14" height="14" viewBox="0 0 24 24" fill="none"
                        stroke="var(--editor-accent, #bd93f9)" strokeWidth="2"
                        strokeLinecap="round" strokeLinejoin="round"
                    >
                        <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                    </svg>
                    <span style={{ fontWeight: 600, fontSize: 12 }}>Plugins</span>
                    <span
                        style={{
                            marginLeft: "auto",
                            fontSize: 10,
                            color: "var(--editor-muted, #6272a4)",
                            fontVariantNumeric: "tabular-nums",
                        }}
                    >
                        {enabledCount}/{totalCount} active
                    </span>
                    <button
                        onClick={onClose}
                        style={{
                            background: "none",
                            border: "none",
                            color: "var(--editor-muted, #6272a4)",
                            cursor: "pointer",
                            padding: "2px 4px",
                            fontSize: 14,
                            lineHeight: 1,
                            borderRadius: 3,
                        }}
                        title="Close (Esc)"
                    >
                        ✕
                    </button>
                </div>
                <input
                    ref={filterRef}
                    type="text"
                    placeholder="Filter plugins…"
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                    style={{
                        width: "100%",
                        padding: "4px 8px",
                        fontSize: 11,
                        borderRadius: 4,
                        border: "1px solid var(--editor-border, #44475a)",
                        background: "var(--editor-background, #282a36)",
                        color: "var(--editor-foreground, #f8f8f2)",
                        outline: "none",
                        boxSizing: "border-box",
                    }}
                />
            </div>

            {/* ── Plugin list ─────────────────────────────────── */}
            <div
                style={{
                    flex: 1,
                    overflowY: "auto",
                    overflowX: "hidden",
                    padding: "2px 0",
                }}
            >
                {filtered.length === 0 && (
                    <div
                        style={{
                            padding: "32px 12px",
                            textAlign: "center",
                            fontSize: 11,
                            color: "var(--editor-muted, #6272a4)",
                        }}
                    >
                        No plugins found
                    </div>
                )}
                {Array.from(groups.entries()).map(([category, plugins]) => (
                    <div key={category}>
                        <div
                            style={{
                                padding: "8px 12px 2px",
                                fontSize: 9,
                                fontWeight: 700,
                                textTransform: "uppercase",
                                letterSpacing: "0.08em",
                                color: CATEGORY_COLORS[category] ?? "var(--editor-muted, #6272a4)",
                                opacity: 0.85,
                            }}
                        >
                            {CATEGORY_LABELS[category] ?? category}
                        </div>
                        {plugins.map((plugin) => (
                            <PluginRow
                                key={plugin.id}
                                plugin={plugin}
                                enabled={snapshot.enabledPlugins.has(plugin.id)}
                                onToggle={togglePlugin}
                            />
                        ))}
                    </div>
                ))}
            </div>

            {/* ── Footer ──────────────────────────────────────── */}
            <div
                style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "4px 12px",
                    borderTop: "1px solid var(--editor-border, #44475a)",
                    fontSize: 9,
                    color: "var(--editor-muted, #6272a4)",
                    userSelect: "none",
                }}
            >
                <span>Click to toggle</span>
                <span>Esc to close</span>
            </div>
        </div>
    );
});

/* ── Isolated plugin row — only re-renders when its own props change ── */

const PluginRow = memo(function PluginRow({
    plugin,
    enabled,
    onToggle,
}: {
    plugin: ExtendedEditorPlugin;
    enabled: boolean;
    onToggle: (id: string) => void;
}) {
    const catColor = CATEGORY_COLORS[plugin.category ?? "tools"] ?? "#6272a4";

    return (
        <button
            type="button"
            onClick={() => onToggle(plugin.id)}
            className="plugin-manager-row"
            style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                width: "100%",
                padding: "6px 12px",
                border: "none",
                background: "transparent",
                color: "inherit",
                textAlign: "left",
                cursor: "pointer",
                fontSize: 12,
                outline: "none",
                transition: "background 100ms ease",
            }}
            onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.background =
                    "var(--editor-popup-hover-bg, rgba(68,71,90,0.5))";
            }}
            onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.background = "transparent";
            }}
        >
            <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                    <span
                        style={{
                            fontSize: 11,
                            fontWeight: 500,
                            color: enabled
                                ? "var(--editor-foreground, #f8f8f2)"
                                : "var(--editor-muted, #6272a4)",
                            transition: "color 150ms",
                        }}
                    >
                        {plugin.name}
                    </span>
                    <span
                        style={{
                            fontSize: 8,
                            padding: "1px 4px",
                            borderRadius: 3,
                            fontWeight: 600,
                            background: `${catColor}18`,
                            color: catColor,
                        }}
                    >
                        {plugin.version}
                    </span>
                </div>
                {plugin.description && (
                    <div
                        style={{
                            fontSize: 10,
                            color: "var(--editor-muted, #6272a4)",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                            marginTop: 1,
                        }}
                    >
                        {plugin.description}
                    </div>
                )}
            </div>

            {/* Toggle pill */}
            <span
                style={{
                    position: "relative",
                    flexShrink: 0,
                    width: 32,
                    height: 16,
                    borderRadius: 8,
                    background: enabled
                        ? "var(--editor-accent, #bd93f9)"
                        : "var(--editor-border, #44475a)",
                    transition: "background 200ms ease",
                }}
            >
                <span
                    style={{
                        position: "absolute",
                        top: 2,
                        left: enabled ? 16 : 2,
                        width: 12,
                        height: 12,
                        borderRadius: 6,
                        background: "#fff",
                        boxShadow: "0 1px 2px rgba(0,0,0,0.3)",
                        transition: "left 200ms ease",
                    }}
                />
            </span>
        </button>
    );
});
