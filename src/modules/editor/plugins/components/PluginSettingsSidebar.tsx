/**
 * @module editor/plugins/components/PluginSettingsSidebar
 *
 * Toggleable, resizable right-side sidebar panel for plugin settings.
 * Opens on click (like ThemeSelector), loads plugin settings dynamically.
 *
 * Features:
 *   - Drag-to-resize divider (min 240px, max 50% viewport)
 *   - Plugin list with expand/collapse sections
 *   - Dynamic settings per plugin (keybinding editor, toggles, etc.)
 *   - Keyboard shortcuts viewer with conflict indicators
 *   - Smooth open/close animation
 */
import { memo, useState, useRef, useCallback, useEffect, useMemo } from "react";
import type { PluginHostState, ExtendedEditorPlugin } from "../types";
import type { PluginHost } from "../PluginHost";
import type { KeybindingManager, KeybindingEntry } from "../KeybindingManager";

interface PluginSettingsSidebarProps {
    host: PluginHost;
    snapshot: PluginHostState;
    keybindingManager: KeybindingManager;
    open: boolean;
    onClose: () => void;
}

const MIN_WIDTH = 260;
const MAX_WIDTH_RATIO = 0.5;
const DEFAULT_WIDTH = 340;

const CATEGORY_COLORS: Record<string, string> = {
    editor: "#50fa7b",
    language: "#8be9fd",
    ai: "#bd93f9",
    ui: "#ffb86c",
    validation: "#f1fa8c",
    tools: "#ff79c6",
};

export const PluginSettingsSidebar = memo(function PluginSettingsSidebar({
    host,
    snapshot,
    keybindingManager,
    open,
    onClose,
}: PluginSettingsSidebarProps) {
    const [width, setWidth] = useState(DEFAULT_WIDTH);
    const [isDragging, setIsDragging] = useState(false);
    const [expandedPlugin, setExpandedPlugin] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<"plugins" | "keybindings">("plugins");
    const [kbEntries, setKbEntries] = useState<KeybindingEntry[]>([]);
    const sidebarRef = useRef<HTMLDivElement>(null);
    const dragStartXRef = useRef(0);
    const dragStartWidthRef = useRef(DEFAULT_WIDTH);

    // Subscribe to keybinding manager changes
    useEffect(() => {
        const update = () => setKbEntries(keybindingManager.getAllEntries());
        update();
        return keybindingManager.subscribe(update);
    }, [keybindingManager]);

    // ── Drag to resize ───────────────────────────────────────
    const onDragStart = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        setIsDragging(true);
        dragStartXRef.current = e.clientX;
        dragStartWidthRef.current = width;
    }, [width]);

    useEffect(() => {
        if (!isDragging) return;

        const onMouseMove = (e: MouseEvent) => {
            const delta = dragStartXRef.current - e.clientX;
            const maxWidth = window.innerWidth * MAX_WIDTH_RATIO;
            const newWidth = Math.min(maxWidth, Math.max(MIN_WIDTH, dragStartWidthRef.current + delta));
            setWidth(newWidth);
        };

        const onMouseUp = () => {
            setIsDragging(false);
        };

        document.addEventListener("mousemove", onMouseMove);
        document.addEventListener("mouseup", onMouseUp);
        return () => {
            document.removeEventListener("mousemove", onMouseMove);
            document.removeEventListener("mouseup", onMouseUp);
        };
    }, [isDragging]);

    // Close on Escape
    useEffect(() => {
        if (!open) return;
        const handler = (e: KeyboardEvent) => {
            if (e.key === "Escape") { onClose(); e.stopPropagation(); }
        };
        document.addEventListener("keydown", handler, true);
        return () => document.removeEventListener("keydown", handler, true);
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

    const reloadPlugin = useCallback(
        (pluginId: string) => {
            host.disable(pluginId);
            // Re-enable after a short delay to allow cleanup
            setTimeout(() => host.enable(pluginId), 50);
        },
        [host],
    );

    const allPlugins = useMemo(() => Array.from(snapshot.plugins.values()), [snapshot.plugins]);

    if (!open) return null;

    return (
        <div style={{ display: "flex", flexShrink: 0, height: "100%" }}>
            {/* Drag handle */}
            <div
                onMouseDown={onDragStart}
                style={{
                    width: 4,
                    cursor: "col-resize",
                    background: isDragging
                        ? "var(--editor-accent, #bd93f9)"
                        : "var(--editor-border, #44475a)",
                    transition: isDragging ? "none" : "background 0.15s",
                    flexShrink: 0,
                }}
                onMouseEnter={(e) => {
                    if (!isDragging) (e.currentTarget as HTMLElement).style.background = "var(--editor-accent, #bd93f9)";
                }}
                onMouseLeave={(e) => {
                    if (!isDragging) (e.currentTarget as HTMLElement).style.background = "var(--editor-border, #44475a)";
                }}
            />

            {/* Sidebar content */}
            <div
                ref={sidebarRef}
                style={{
                    width,
                    display: "flex",
                    flexDirection: "column",
                    background: "var(--editor-popup-bg, #282a36)",
                    borderLeft: "1px solid var(--editor-border, #44475a)",
                    overflow: "hidden",
                    animation: "sidebarSlideIn 0.2s ease-out",
                }}
            >
                {/* Header */}
                <div
                    style={{
                        padding: "8px 12px",
                        borderBottom: "1px solid var(--editor-border, #44475a)",
                        background: "var(--editor-toolbar-bg, #21222c)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        flexShrink: 0,
                    }}
                >
                    <span style={{ fontSize: 12, fontWeight: 600, color: "var(--editor-foreground, #f8f8f2)" }}>
                        Plugin Settings
                    </span>
                    <button
                        onClick={onClose}
                        style={{
                            background: "transparent",
                            border: "none",
                            color: "var(--editor-muted, #6272a4)",
                            cursor: "pointer",
                            fontSize: 14,
                            lineHeight: 1,
                            padding: "2px 4px",
                            borderRadius: 3,
                        }}
                        title="Close (Esc)"
                    >
                        ✕
                    </button>
                </div>

                {/* Tab bar */}
                <div
                    style={{
                        display: "flex",
                        borderBottom: "1px solid var(--editor-border, #44475a)",
                        flexShrink: 0,
                    }}
                >
                    {(["plugins", "keybindings"] as const).map((tab) => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            style={{
                                flex: 1,
                                padding: "6px 0",
                                fontSize: 11,
                                fontWeight: 600,
                                textTransform: "capitalize",
                                background: "transparent",
                                border: "none",
                                borderBottom: activeTab === tab
                                    ? "2px solid var(--editor-accent, #bd93f9)"
                                    : "2px solid transparent",
                                color: activeTab === tab
                                    ? "var(--editor-foreground, #f8f8f2)"
                                    : "var(--editor-muted, #6272a4)",
                                cursor: "pointer",
                                transition: "all 0.15s",
                            }}
                        >
                            {tab}
                        </button>
                    ))}
                </div>

                {/* Tab content */}
                <div style={{ flex: 1, overflowY: "auto", padding: "4px 0" }}>
                    {activeTab === "plugins" && (
                        <PluginListTab
                            plugins={allPlugins}
                            snapshot={snapshot}
                            expandedPlugin={expandedPlugin}
                            onToggleExpand={(id) => setExpandedPlugin(expandedPlugin === id ? null : id)}
                            onTogglePlugin={togglePlugin}
                            onReloadPlugin={reloadPlugin}
                        />
                    )}
                    {activeTab === "keybindings" && (
                        <KeybindingsTab
                            entries={kbEntries}
                            manager={keybindingManager}
                        />
                    )}
                </div>
            </div>

            <style>{`
                @keyframes sidebarSlideIn {
                    from { opacity: 0; transform: translateX(20px); }
                    to   { opacity: 1; transform: translateX(0); }
                }
            `}</style>
        </div>
    );
});

// ═══════════════════════════════════════════════════════════════
//  SUB-COMPONENTS
// ═══════════════════════════════════════════════════════════════

interface PluginListTabProps {
    plugins: ExtendedEditorPlugin[];
    snapshot: PluginHostState;
    expandedPlugin: string | null;
    onToggleExpand: (id: string) => void;
    onTogglePlugin: (id: string) => void;
    onReloadPlugin: (id: string) => void;
}

function PluginListTab({
    plugins,
    snapshot,
    expandedPlugin,
    onToggleExpand,
    onTogglePlugin,
    onReloadPlugin,
}: PluginListTabProps) {
    return (
        <>
            {plugins.map((plugin) => {
                const enabled = snapshot.enabledPlugins.has(plugin.id);
                const expanded = expandedPlugin === plugin.id;
                const catColor = CATEGORY_COLORS[plugin.category ?? "tools"] ?? "#6272a4";

                return (
                    <div key={plugin.id} style={{ borderBottom: "1px solid var(--editor-border, #44475a)" }}>
                        {/* Plugin row */}
                        <div
                            style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 8,
                                padding: "8px 12px",
                                cursor: "pointer",
                                transition: "background 0.1s",
                            }}
                            onClick={() => onToggleExpand(plugin.id)}
                            onMouseEnter={(e) => {
                                (e.currentTarget as HTMLElement).style.background = "var(--editor-popup-hover-bg, #44475a)";
                            }}
                            onMouseLeave={(e) => {
                                (e.currentTarget as HTMLElement).style.background = "transparent";
                            }}
                        >
                            {/* Expand chevron */}
                            <svg
                                width="10"
                                height="10"
                                viewBox="0 0 10 10"
                                style={{
                                    transform: expanded ? "rotate(90deg)" : "rotate(0deg)",
                                    transition: "transform 0.15s",
                                    flexShrink: 0,
                                    fill: "var(--editor-muted, #6272a4)",
                                }}
                            >
                                <path d="M3 1l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1.5" />
                            </svg>

                            {/* Info */}
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                    <span
                                        style={{
                                            fontSize: 12,
                                            fontWeight: 500,
                                            color: enabled
                                                ? "var(--editor-foreground, #f8f8f2)"
                                                : "var(--editor-muted, #6272a4)",
                                        }}
                                    >
                                        {plugin.name}
                                    </span>
                                    <span
                                        style={{
                                            fontSize: 9,
                                            padding: "1px 4px",
                                            borderRadius: 3,
                                            background: `${catColor}18`,
                                            color: catColor,
                                            fontWeight: 600,
                                        }}
                                    >
                                        v{plugin.version}
                                    </span>
                                </div>
                                {plugin.description && (
                                    <div style={{
                                        fontSize: 10,
                                        color: "var(--editor-muted, #6272a4)",
                                        overflow: "hidden",
                                        textOverflow: "ellipsis",
                                        whiteSpace: "nowrap",
                                    }}>
                                        {plugin.description}
                                    </div>
                                )}
                            </div>

                            {/* Toggle switch */}
                            <div
                                onClick={(e) => { e.stopPropagation(); onTogglePlugin(plugin.id); }}
                                style={{
                                    width: 32,
                                    height: 16,
                                    borderRadius: 8,
                                    background: enabled
                                        ? "var(--editor-accent, #bd93f9)"
                                        : "var(--editor-border, #44475a)",
                                    cursor: "pointer",
                                    position: "relative",
                                    transition: "background 0.2s",
                                    flexShrink: 0,
                                }}
                            >
                                <div
                                    style={{
                                        position: "absolute",
                                        top: 2,
                                        left: enabled ? 16 : 2,
                                        width: 12,
                                        height: 12,
                                        borderRadius: "50%",
                                        background: "#fff",
                                        transition: "left 0.2s",
                                    }}
                                />
                            </div>
                        </div>

                        {/* Expanded details */}
                        {expanded && (
                            <div style={{ padding: "4px 12px 10px 30px" }}>
                                <div style={{ fontSize: 10, color: "var(--editor-muted, #6272a4)", marginBottom: 6 }}>
                                    <strong>ID:</strong> {plugin.id} &nbsp;|&nbsp;
                                    <strong>Category:</strong> {plugin.category ?? "tools"}
                                    {plugin.dependencies && plugin.dependencies.length > 0 && (
                                        <span> &nbsp;|&nbsp; <strong>Deps:</strong> {plugin.dependencies.join(", ")}</span>
                                    )}
                                </div>

                                {/* Keybindings */}
                                {plugin.keybindings && plugin.keybindings.length > 0 && (
                                    <div style={{ marginBottom: 6 }}>
                                        <div style={{ fontSize: 10, fontWeight: 600, color: "var(--editor-foreground, #f8f8f2)", marginBottom: 3 }}>
                                            Keybindings
                                        </div>
                                        {plugin.keybindings.map((kb) => (
                                            <div
                                                key={kb.id}
                                                style={{
                                                    display: "flex",
                                                    alignItems: "center",
                                                    justifyContent: "space-between",
                                                    padding: "2px 0",
                                                    fontSize: 10,
                                                }}
                                            >
                                                <span style={{ color: "var(--editor-muted, #6272a4)" }}>{kb.label}</span>
                                                <kbd
                                                    style={{
                                                        padding: "1px 5px",
                                                        borderRadius: 3,
                                                        fontSize: 9,
                                                        fontWeight: 600,
                                                        background: "rgba(255,255,255,0.06)",
                                                        border: "1px solid rgba(255,255,255,0.1)",
                                                        color: "var(--editor-foreground, #f8f8f2)",
                                                    }}
                                                >
                                                    {kb.keys}
                                                </kbd>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {/* Actions */}
                                <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
                                    {enabled && (
                                        <button
                                            onClick={() => onReloadPlugin(plugin.id)}
                                            style={{
                                                padding: "3px 8px",
                                                fontSize: 10,
                                                borderRadius: 3,
                                                border: "1px solid var(--editor-border, #44475a)",
                                                background: "transparent",
                                                color: "var(--editor-foreground, #f8f8f2)",
                                                cursor: "pointer",
                                            }}
                                        >
                                            ↻ Reload
                                        </button>
                                    )}
                                    <button
                                        onClick={() => onTogglePlugin(plugin.id)}
                                        style={{
                                            padding: "3px 8px",
                                            fontSize: 10,
                                            borderRadius: 3,
                                            border: "1px solid var(--editor-border, #44475a)",
                                            background: enabled ? "rgba(255, 85, 85, 0.1)" : "rgba(80, 250, 123, 0.1)",
                                            color: enabled ? "#ff5555" : "#50fa7b",
                                            cursor: "pointer",
                                        }}
                                    >
                                        {enabled ? "Disable" : "Enable"}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                );
            })}
        </>
    );
}

// ── Keybindings Tab ──────────────────────────────────────────

interface KeybindingsTabProps {
    entries: KeybindingEntry[];
    manager: KeybindingManager;
}

function KeybindingsTab({ entries, manager }: KeybindingsTabProps) {
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editValue, setEditValue] = useState("");

    const handleSaveOverride = useCallback(
        (bindingId: string) => {
            if (editValue.trim()) {
                manager.setUserOverride(bindingId, editValue.trim());
            } else {
                manager.removeUserOverride(bindingId);
            }
            setEditingId(null);
            setEditValue("");
        },
        [manager, editValue],
    );

    const handleDisable = useCallback(
        (bindingId: string) => {
            manager.setUserOverride(bindingId, null);
        },
        [manager],
    );

    const handleRestore = useCallback(
        (bindingId: string) => {
            manager.removeUserOverride(bindingId);
        },
        [manager],
    );

    // Group by pluginId
    const groups = useMemo(() => {
        const map = new Map<string, KeybindingEntry[]>();
        for (const entry of entries) {
            if (!map.has(entry.pluginId)) map.set(entry.pluginId, []);
            map.get(entry.pluginId)!.push(entry);
        }
        return map;
    }, [entries]);

    const conflicts = useMemo(() => manager.getConflicts(), [entries, manager]);

    return (
        <div style={{ padding: "8px 0" }}>
            {/* Conflict warnings */}
            {conflicts.length > 0 && (
                <div style={{ padding: "4px 12px 8px", borderBottom: "1px solid var(--editor-border, #44475a)" }}>
                    <div style={{ fontSize: 10, fontWeight: 600, color: "#f1fa8c", marginBottom: 4 }}>
                        ⚠ {conflicts.length} conflict{conflicts.length > 1 ? "s" : ""} detected
                    </div>
                    {conflicts.map((c, i) => (
                        <div key={i} style={{ fontSize: 10, color: "var(--editor-muted, #6272a4)", padding: "1px 0" }}>
                            <kbd style={{
                                padding: "0 4px",
                                borderRadius: 2,
                                fontSize: 9,
                                background: "rgba(241,250,140,0.1)",
                                border: "1px solid rgba(241,250,140,0.2)",
                                color: "#f1fa8c",
                            }}>
                                {c.keys}
                            </kbd>
                            <span style={{ marginLeft: 4 }}>
                                ({c.entries.length} bindings in "{c.when}")
                            </span>
                        </div>
                    ))}
                </div>
            )}

            {/* Keybinding list */}
            {Array.from(groups.entries()).map(([pluginId, groupEntries]) => (
                <div key={pluginId} style={{ borderBottom: "1px solid var(--editor-border, #44475a)" }}>
                    <div style={{
                        padding: "6px 12px 2px",
                        fontSize: 10,
                        fontWeight: 700,
                        textTransform: "uppercase",
                        letterSpacing: 0.5,
                        color: "var(--editor-accent, #bd93f9)",
                        opacity: 0.8,
                    }}>
                        {pluginId}
                    </div>
                    {groupEntries.map((entry) => (
                        <div
                            key={entry.binding.id}
                            style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 8,
                                padding: "5px 12px",
                                fontSize: 11,
                                opacity: entry.active ? 1 : 0.5,
                            }}
                        >
                            {/* Conflict indicator */}
                            {entry.hasConflict && (
                                <span title="Keybinding conflict" style={{ color: "#f1fa8c", fontSize: 10 }}>⚠</span>
                            )}
                            {entry.isUserOverride && (
                                <span title="Custom override" style={{ color: "#8be9fd", fontSize: 10 }}>✎</span>
                            )}

                            <span style={{ flex: 1, color: "var(--editor-foreground, #f8f8f2)" }}>
                                {entry.binding.label}
                            </span>

                            {editingId === entry.binding.id ? (
                                <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                                    <input
                                        type="text"
                                        value={editValue}
                                        onChange={(e) => setEditValue(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === "Enter") handleSaveOverride(entry.binding.id);
                                            if (e.key === "Escape") { setEditingId(null); setEditValue(""); }
                                        }}
                                        placeholder="e.g. Ctrl+Shift+K"
                                        autoFocus
                                        style={{
                                            width: 100,
                                            padding: "2px 6px",
                                            fontSize: 10,
                                            borderRadius: 3,
                                            border: "1px solid var(--editor-accent, #bd93f9)",
                                            background: "var(--editor-background, #282a36)",
                                            color: "var(--editor-foreground, #f8f8f2)",
                                            outline: "none",
                                        }}
                                    />
                                    <button
                                        onClick={() => handleSaveOverride(entry.binding.id)}
                                        style={{
                                            padding: "2px 6px",
                                            fontSize: 9,
                                            borderRadius: 3,
                                            border: "none",
                                            background: "var(--editor-accent, #bd93f9)",
                                            color: "#fff",
                                            cursor: "pointer",
                                        }}
                                    >
                                        ✓
                                    </button>
                                </div>
                            ) : (
                                <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                                    <kbd
                                        onClick={() => {
                                            setEditingId(entry.binding.id);
                                            setEditValue(entry.binding.keys);
                                        }}
                                        style={{
                                            padding: "1px 5px",
                                            borderRadius: 3,
                                            fontSize: 9,
                                            fontWeight: 600,
                                            background: entry.hasConflict
                                                ? "rgba(241,250,140,0.1)"
                                                : "rgba(255,255,255,0.06)",
                                            border: entry.hasConflict
                                                ? "1px solid rgba(241,250,140,0.2)"
                                                : "1px solid rgba(255,255,255,0.1)",
                                            color: entry.hasConflict ? "#f1fa8c" : "var(--editor-foreground, #f8f8f2)",
                                            cursor: "pointer",
                                            textDecoration: !entry.active ? "line-through" : undefined,
                                        }}
                                        title="Click to edit keybinding"
                                    >
                                        {entry.binding.keys}
                                    </kbd>
                                    {entry.active ? (
                                        <button
                                            onClick={() => handleDisable(entry.binding.id)}
                                            title="Disable this keybinding"
                                            style={{
                                                background: "transparent",
                                                border: "none",
                                                color: "var(--editor-muted, #6272a4)",
                                                cursor: "pointer",
                                                fontSize: 10,
                                                padding: "0 2px",
                                            }}
                                        >
                                            ✕
                                        </button>
                                    ) : (
                                        <button
                                            onClick={() => handleRestore(entry.binding.id)}
                                            title="Restore original keybinding"
                                            style={{
                                                background: "transparent",
                                                border: "none",
                                                color: "#50fa7b",
                                                cursor: "pointer",
                                                fontSize: 10,
                                                padding: "0 2px",
                                            }}
                                        >
                                            ↩
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            ))}

            {entries.length === 0 && (
                <div style={{ padding: "20px 12px", textAlign: "center", fontSize: 11, color: "var(--editor-muted, #6272a4)" }}>
                    No keybindings registered
                </div>
            )}

            {/* Reset all button */}
            {Array.from(groups.values()).some(g => g.some(e => e.isUserOverride)) && (
                <div style={{ padding: "8px 12px" }}>
                    <button
                        onClick={() => manager.resetAllOverrides()}
                        style={{
                            width: "100%",
                            padding: "5px 8px",
                            fontSize: 10,
                            borderRadius: 4,
                            border: "1px solid var(--editor-border, #44475a)",
                            background: "transparent",
                            color: "var(--editor-muted, #6272a4)",
                            cursor: "pointer",
                        }}
                    >
                        Reset All to Defaults
                    </button>
                </div>
            )}
        </div>
    );
}
