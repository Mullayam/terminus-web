/**
 * @module editor/plugins/components/PluginStatusBar
 *
 * Status bar section showing plugin-contributed information:
 * - Diagnostic counts (errors, warnings)
 * - Active plugin count
 * - Quick toggle buttons
 */
import type { PluginHostState } from "../types";

interface PluginStatusBarProps {
    snapshot: PluginHostState;
}

export function PluginStatusBar({ snapshot }: PluginStatusBarProps) {
    const errorCount = snapshot.diagnostics.filter((d) => d.severity === "error").length;
    const warningCount = snapshot.diagnostics.filter((d) => d.severity === "warning").length;
    const infoCount = snapshot.diagnostics.filter((d) => d.severity === "info" || d.severity === "hint").length;
    const pluginCount = snapshot.enabledPlugins.size;
    const panelCount = snapshot.openPanels.size;

    return (
        <div
            className="editor-plugin-statusbar"
            style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "0 8px",
                fontSize: 11,
                color: "var(--editor-muted, #6272a4)",
                userSelect: "none",
            }}
        >
            {(errorCount > 0 || warningCount > 0) && (
                <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    {errorCount > 0 && (
                        <span style={{ color: "#ff5555" }}>
                            ● {errorCount}
                        </span>
                    )}
                    {warningCount > 0 && (
                        <span style={{ color: "#f1fa8c" }}>
                            ▲ {warningCount}
                        </span>
                    )}
                    {infoCount > 0 && (
                        <span style={{ color: "#8be9fd" }}>
                            ℹ {infoCount}
                        </span>
                    )}
                </span>
            )}
            <span title={`${pluginCount} plugin${pluginCount !== 1 ? "s" : ""} active`}>
                ⚡ {pluginCount}
            </span>
            {panelCount > 0 && (
                <span title={`${panelCount} panel${panelCount !== 1 ? "s" : ""} open`}>
                    ▪ {panelCount}
                </span>
            )}
        </div>
    );
}
