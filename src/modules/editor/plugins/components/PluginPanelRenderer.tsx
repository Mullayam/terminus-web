/**
 * @module editor/plugins/components/PluginPanelRenderer
 *
 * Renders open plugin panels alongside the editor.
 */
import { useMemo } from "react";
import type { PluginHostState, PanelDescriptor } from "../types";
import type { PluginHost } from "../PluginHost";

interface PluginPanelRendererProps {
    host: PluginHost;
    snapshot: PluginHostState;
    position: "right" | "bottom";
}

export function PluginPanelRenderer({ host, snapshot, position }: PluginPanelRendererProps) {
    const openPanels = useMemo(() => {
        const result: PanelDescriptor[] = [];
        for (const [id, panel] of snapshot.panels) {
            if (snapshot.openPanels.has(id) && panel.position === position) {
                result.push(panel);
            }
        }
        return result;
    }, [snapshot.panels, snapshot.openPanels, position]);

    if (openPanels.length === 0) return null;

    const isHorizontal = position === "right";

    return (
        <div
            className="editor-plugin-panels"
            style={{
                display: "flex",
                flexDirection: isHorizontal ? "row" : "column",
                borderLeft: isHorizontal ? "1px solid var(--editor-border, #44475a)" : undefined,
                borderTop: !isHorizontal ? "1px solid var(--editor-border, #44475a)" : undefined,
                overflow: "hidden",
                flexShrink: 0,
            }}
        >
            {openPanels.map((panel) => (
                <div
                    key={panel.id}
                    style={{
                        width: isHorizontal ? (panel.defaultSize ?? 350) : "100%",
                        height: !isHorizontal ? (panel.defaultSize ?? 250) : "100%",
                        overflow: "hidden",
                        display: "flex",
                        flexDirection: "column",
                        background: "var(--editor-background, #282a36)",
                        borderLeft: isHorizontal ? "1px solid var(--editor-border, #44475a)" : undefined,
                    }}
                >
                    {/* Panel header */}
                    <div
                        style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            padding: "4px 10px",
                            fontSize: 11,
                            fontWeight: 600,
                            borderBottom: "1px solid var(--editor-border, #44475a)",
                            background: "var(--editor-toolbar-bg, #21222c)",
                            color: "var(--editor-foreground, #f8f8f2)",
                            userSelect: "none",
                            flexShrink: 0,
                        }}
                    >
                        <span>{panel.title}</span>
                        <button
                            onClick={() => {
                                const api = host.createAPI("panel-renderer");
                                api.togglePanel(panel.id);
                            }}
                            style={{
                                background: "transparent",
                                border: "none",
                                color: "var(--editor-muted, #6272a4)",
                                cursor: "pointer",
                                fontSize: 14,
                                lineHeight: 1,
                                padding: "0 2px",
                            }}
                            title="Close panel"
                        >
                            ✕
                        </button>
                    </div>
                    {/* Panel content */}
                    <div style={{ flex: 1, overflow: "auto" }}>
                        {panel.render(host.createAPI("panel-renderer"))}
                    </div>
                </div>
            ))}
        </div>
    );
}
