/**
 * @module editor/plugins/builtin/symbol-outline
 *
 * Provides a symbol outline panel showing functions, classes,
 * interfaces, types, and variables in the current file.
 */
import { createElement, useMemo, useState } from "react";
import type { ExtendedEditorPlugin, ExtendedPluginAPI, PanelDescriptor } from "../types";

interface Symbol {
    name: string;
    kind: "function" | "class" | "interface" | "type" | "variable" | "method" | "enum" | "struct";
    line: number;
    indent: number;
}

function extractSymbols(content: string, language: string): Symbol[] {
    const symbols: Symbol[] = [];
    const lines = content.split("\n");
    const lang = language.toLowerCase();

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();
        const indent = line.length - trimmed.length;
        const lineNum = i + 1;

        if (["javascript", "typescript", "jsx", "tsx"].includes(lang)) {
            let m = trimmed.match(/^(?:export\s+)?(?:async\s+)?function\s+(\w+)/);
            if (m) { symbols.push({ name: m[1], kind: "function", line: lineNum, indent }); continue; }
            m = trimmed.match(/^(?:export\s+)?(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?(?:\([^)]*\)|[a-zA-Z_$]\w*)\s*=>/);
            if (m) { symbols.push({ name: m[1], kind: "function", line: lineNum, indent }); continue; }
            m = trimmed.match(/^(?:export\s+)?class\s+(\w+)/);
            if (m) { symbols.push({ name: m[1], kind: "class", line: lineNum, indent }); continue; }
            m = trimmed.match(/^(?:export\s+)?interface\s+(\w+)/);
            if (m) { symbols.push({ name: m[1], kind: "interface", line: lineNum, indent }); continue; }
            m = trimmed.match(/^(?:export\s+)?type\s+(\w+)/);
            if (m) { symbols.push({ name: m[1], kind: "type", line: lineNum, indent }); continue; }
            m = trimmed.match(/^(?:export\s+)?enum\s+(\w+)/);
            if (m) { symbols.push({ name: m[1], kind: "enum", line: lineNum, indent }); continue; }
            m = trimmed.match(/^(?:export\s+)?(?:const|let|var)\s+(\w+)\s*[=:]/);
            if (m) { symbols.push({ name: m[1], kind: "variable", line: lineNum, indent }); continue; }
        }

        if (lang === "python") {
            let m = trimmed.match(/^(?:async\s+)?def\s+(\w+)/);
            if (m) { symbols.push({ name: m[1], kind: "function", line: lineNum, indent }); continue; }
            m = trimmed.match(/^class\s+(\w+)/);
            if (m) { symbols.push({ name: m[1], kind: "class", line: lineNum, indent }); continue; }
        }

        if (lang === "go") {
            let m = trimmed.match(/^func\s+(?:\([^)]*\)\s+)?(\w+)/);
            if (m) { symbols.push({ name: m[1], kind: "function", line: lineNum, indent }); continue; }
            m = trimmed.match(/^type\s+(\w+)\s+(struct|interface)/);
            if (m) { symbols.push({ name: m[1], kind: m[2] as "struct" | "interface", line: lineNum, indent }); continue; }
        }

        if (lang === "rust") {
            let m = trimmed.match(/^(?:pub\s+)?fn\s+(\w+)/);
            if (m) { symbols.push({ name: m[1], kind: "function", line: lineNum, indent }); continue; }
            m = trimmed.match(/^(?:pub\s+)?struct\s+(\w+)/);
            if (m) { symbols.push({ name: m[1], kind: "struct", line: lineNum, indent }); continue; }
            m = trimmed.match(/^(?:pub\s+)?enum\s+(\w+)/);
            if (m) { symbols.push({ name: m[1], kind: "enum", line: lineNum, indent }); continue; }
            m = trimmed.match(/^(?:pub\s+)?trait\s+(\w+)/);
            if (m) { symbols.push({ name: m[1], kind: "interface", line: lineNum, indent }); continue; }
        }
    }

    return symbols;
}

const ICON_MAP: Record<string, string> = {
    function: "ƒ", class: "C", interface: "I", type: "T",
    variable: "V", method: "M", enum: "E", struct: "S",
};

const COLOR_MAP: Record<string, string> = {
    function: "#50fa7b", class: "#ff79c6", interface: "#8be9fd",
    type: "#bd93f9", variable: "#f8f8f2", method: "#50fa7b",
    enum: "#ffb86c", struct: "#ff79c6",
};

function SymbolOutlinePanel({ api }: { api: ExtendedPluginAPI }) {
    const content = api.getContent();
    const { language } = api.getFileInfo();
    const [filter, setFilter] = useState("");

    const symbols = useMemo(() => extractSymbols(content, language), [content, language]);
    const filtered = filter
        ? symbols.filter((s) => s.name.toLowerCase().includes(filter.toLowerCase()))
        : symbols;

    return createElement("div", { style: { height: "100%", overflow: "auto", fontSize: "12px" } },
        createElement("div", { style: { padding: "8px", borderBottom: "1px solid var(--editor-border, #44475a)" } },
            createElement("input", {
                type: "text",
                placeholder: "Filter symbols...",
                value: filter,
                onChange: (e: React.ChangeEvent<HTMLInputElement>) => setFilter(e.target.value),
                style: {
                    width: "100%", padding: "4px 8px", borderRadius: "4px",
                    border: "1px solid var(--editor-border, #44475a)",
                    background: "var(--editor-bg, #282a36)",
                    color: "var(--editor-foreground, #f8f8f2)", fontSize: "11px",
                },
            }),
        ),
        createElement("div", { style: { padding: "4px 0" } },
            filtered.length === 0
                ? createElement("div", { style: { padding: "12px", color: "var(--editor-muted, #6272a4)", textAlign: "center" } }, "No symbols found")
                : filtered.map((sym, i) =>
                    createElement("div", {
                        key: i,
                        onClick: () => api.executeCommand("goToLine", sym.line),
                        style: {
                            padding: "3px 8px 3px " + (12 + sym.indent) + "px",
                            cursor: "pointer", display: "flex", alignItems: "center", gap: "6px",
                        },
                    },
                        createElement("span", {
                            style: {
                                color: COLOR_MAP[sym.kind] ?? "#f8f8f2",
                                fontWeight: 600, fontSize: "10px", width: "14px",
                            },
                        }, ICON_MAP[sym.kind] ?? "?"),
                        createElement("span", { style: { color: "var(--editor-foreground, #f8f8f2)" } }, sym.name),
                        createElement("span", {
                            style: { marginLeft: "auto", color: "var(--editor-muted, #6272a4)", fontSize: "10px" },
                        }, `L${sym.line}`),
                    ),
                ),
        ),
    );
}

export function createSymbolOutlinePlugin(): ExtendedEditorPlugin {
    return {
        id: "symbol-outline",
        name: "Symbol Outline",
        version: "1.0.0",
        description: "Shows a navigable outline of all symbols in the current file",
        category: "editor",
        defaultEnabled: true,

        panels: [
            {
                id: "symbol-outline:panel",
                title: "Outline",
                position: "right",
                defaultSize: 280,
                render: (api) => createElement(SymbolOutlinePanel, { api }),
            },
        ],

        onActivate(api) {
            api.registerKeybinding({
                id: "symbol-outline:toggle",
                label: "Toggle Symbol Outline",
                keys: "Ctrl+Shift+O",
                handler: (e) => { e.preventDefault(); api.togglePanel("symbol-outline:panel"); },
                when: "editor",
                category: "Navigation",
            });
        },
    };
}
