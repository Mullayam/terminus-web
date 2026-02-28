/**
 * @module monaco-editor/themes
 *
 * Built-in Monaco themes. All themes follow the MonacoThemeDef interface
 * and are auto-registered when the editor mounts.
 *
 * To add a custom theme:
 *   import { registerTheme, type MonacoThemeDef } from "@/modules/monaco-editor";
 *
 *   const myTheme: MonacoThemeDef = { id: "my-theme", ... };
 *   // Register in onBeforeMount or on the raw monaco instance
 */

import type { MonacoThemeDef } from "../types";

// ── One Dark ─────────────────────────────────────────────────

export const oneDark: MonacoThemeDef = {
  id: "one-dark",
  name: "One Dark",
  base: "vs-dark",
  inherit: true,
  rules: [
    { token: "comment", foreground: "5c6370", fontStyle: "italic" },
    { token: "keyword", foreground: "c678dd" },
    { token: "string", foreground: "98c379" },
    { token: "number", foreground: "d19a66" },
    { token: "type", foreground: "e5c07b" },
    { token: "function", foreground: "61afef" },
    { token: "variable", foreground: "e06c75" },
    { token: "constant", foreground: "d19a66" },
    { token: "operator", foreground: "56b6c2" },
    { token: "tag", foreground: "e06c75" },
    { token: "attribute.name", foreground: "d19a66" },
    { token: "attribute.value", foreground: "98c379" },
    { token: "delimiter", foreground: "abb2bf" },
    { token: "regexp", foreground: "56b6c2" },
  ],
  colors: {
    "editor.background": "#282c34",
    "editor.foreground": "#abb2bf",
    "editor.lineHighlightBackground": "#2c313a",
    "editor.selectionBackground": "#3e4451",
    "editorCursor.foreground": "#528bff",
    "editorWhitespace.foreground": "#3b4048",
    "editorLineNumber.foreground": "#495162",
    "editorLineNumber.activeForeground": "#abb2bf",
    "editorIndentGuide.background": "#3b4048",
    "editorIndentGuide.activeBackground": "#c8c8c859",
    "editorBracketMatch.background": "#515a6b40",
    "editorBracketMatch.border": "#515a6b99",
    "editor.findMatchBackground": "#d19a6644",
    "editor.findMatchHighlightBackground": "#ffffff22",
    "editorOverviewRuler.border": "#282c34",
    "scrollbarSlider.background": "#4e566680",
    "scrollbarSlider.hoverBackground": "#5a637580",
    "scrollbarSlider.activeBackground": "#747d9180",
  },
};

// ── Dracula ──────────────────────────────────────────────────

export const dracula: MonacoThemeDef = {
  id: "dracula",
  name: "Dracula",
  base: "vs-dark",
  inherit: true,
  rules: [
    { token: "comment", foreground: "6272a4", fontStyle: "italic" },
    { token: "keyword", foreground: "ff79c6" },
    { token: "string", foreground: "f1fa8c" },
    { token: "number", foreground: "bd93f9" },
    { token: "type", foreground: "8be9fd", fontStyle: "italic" },
    { token: "function", foreground: "50fa7b" },
    { token: "variable", foreground: "f8f8f2" },
    { token: "constant", foreground: "bd93f9" },
    { token: "operator", foreground: "ff79c6" },
    { token: "tag", foreground: "ff79c6" },
    { token: "attribute.name", foreground: "50fa7b" },
    { token: "attribute.value", foreground: "f1fa8c" },
    { token: "delimiter", foreground: "f8f8f2" },
    { token: "regexp", foreground: "ff5555" },
  ],
  colors: {
    "editor.background": "#282a36",
    "editor.foreground": "#f8f8f2",
    "editor.lineHighlightBackground": "#44475a75",
    "editor.selectionBackground": "#44475a",
    "editorCursor.foreground": "#f8f8f2",
    "editorWhitespace.foreground": "#44475a",
    "editorLineNumber.foreground": "#6272a4",
    "editorLineNumber.activeForeground": "#f8f8f2",
    "editorIndentGuide.background": "#44475a60",
    "editorIndentGuide.activeBackground": "#6272a4",
    "editorBracketMatch.background": "#44475a80",
    "editorBracketMatch.border": "#bd93f9",
    "editor.findMatchBackground": "#ffb86c44",
    "editor.findMatchHighlightBackground": "#ffffff22",
    "editorOverviewRuler.border": "#282a36",
    "scrollbarSlider.background": "#44475a80",
    "scrollbarSlider.hoverBackground": "#44475aaa",
    "scrollbarSlider.activeBackground": "#44475acc",
  },
};

// ── GitHub Dark ──────────────────────────────────────────────

export const githubDark: MonacoThemeDef = {
  id: "github-dark",
  name: "GitHub Dark",
  base: "vs-dark",
  inherit: true,
  rules: [
    { token: "comment", foreground: "8b949e", fontStyle: "italic" },
    { token: "keyword", foreground: "ff7b72" },
    { token: "string", foreground: "a5d6ff" },
    { token: "number", foreground: "79c0ff" },
    { token: "type", foreground: "ffa657" },
    { token: "function", foreground: "d2a8ff" },
    { token: "variable", foreground: "ffa657" },
    { token: "constant", foreground: "79c0ff" },
    { token: "operator", foreground: "ff7b72" },
    { token: "tag", foreground: "7ee787" },
    { token: "attribute.name", foreground: "79c0ff" },
    { token: "attribute.value", foreground: "a5d6ff" },
    { token: "delimiter", foreground: "c9d1d9" },
  ],
  colors: {
    "editor.background": "#0d1117",
    "editor.foreground": "#c9d1d9",
    "editor.lineHighlightBackground": "#161b22",
    "editor.selectionBackground": "#264f78",
    "editorCursor.foreground": "#c9d1d9",
    "editorWhitespace.foreground": "#21262d",
    "editorLineNumber.foreground": "#484f58",
    "editorLineNumber.activeForeground": "#c9d1d9",
    "editorIndentGuide.background": "#21262d",
    "editorIndentGuide.activeBackground": "#30363d",
    "editorBracketMatch.background": "#264f7850",
    "editorBracketMatch.border": "#79c0ff50",
    "editor.findMatchBackground": "#ffa65733",
    "editor.findMatchHighlightBackground": "#ffffff18",
    "editorOverviewRuler.border": "#0d1117",
    "scrollbarSlider.background": "#484f5860",
    "scrollbarSlider.hoverBackground": "#484f5880",
    "scrollbarSlider.activeBackground": "#484f58a0",
  },
};

// ── Monokai ──────────────────────────────────────────────────

export const monokai: MonacoThemeDef = {
  id: "monokai",
  name: "Monokai",
  base: "vs-dark",
  inherit: true,
  rules: [
    { token: "comment", foreground: "75715e", fontStyle: "italic" },
    { token: "keyword", foreground: "f92672" },
    { token: "string", foreground: "e6db74" },
    { token: "number", foreground: "ae81ff" },
    { token: "type", foreground: "66d9ef", fontStyle: "italic" },
    { token: "function", foreground: "a6e22e" },
    { token: "variable", foreground: "f8f8f2" },
    { token: "constant", foreground: "ae81ff" },
    { token: "operator", foreground: "f92672" },
    { token: "tag", foreground: "f92672" },
    { token: "attribute.name", foreground: "a6e22e" },
    { token: "attribute.value", foreground: "e6db74" },
    { token: "delimiter", foreground: "f8f8f2" },
  ],
  colors: {
    "editor.background": "#272822",
    "editor.foreground": "#f8f8f2",
    "editor.lineHighlightBackground": "#3e3d32",
    "editor.selectionBackground": "#49483e",
    "editorCursor.foreground": "#f8f8f0",
    "editorWhitespace.foreground": "#3b3a32",
    "editorLineNumber.foreground": "#90908a",
    "editorLineNumber.activeForeground": "#c2c2bf",
    "editorIndentGuide.background": "#3b3a32",
    "editorIndentGuide.activeBackground": "#767771",
    "editorBracketMatch.background": "#49483e80",
    "editorBracketMatch.border": "#a6e22e50",
    "editor.findMatchBackground": "#e6db7444",
    "editor.findMatchHighlightBackground": "#ffffff18",
    "editorOverviewRuler.border": "#272822",
    "scrollbarSlider.background": "#49483e80",
    "scrollbarSlider.hoverBackground": "#49483ea0",
    "scrollbarSlider.activeBackground": "#49483ec0",
  },
};

// ── Nord ─────────────────────────────────────────────────────

export const nord: MonacoThemeDef = {
  id: "nord",
  name: "Nord",
  base: "vs-dark",
  inherit: true,
  rules: [
    { token: "comment", foreground: "616e88", fontStyle: "italic" },
    { token: "keyword", foreground: "81a1c1" },
    { token: "string", foreground: "a3be8c" },
    { token: "number", foreground: "b48ead" },
    { token: "type", foreground: "8fbcbb" },
    { token: "function", foreground: "88c0d0" },
    { token: "variable", foreground: "d8dee9" },
    { token: "constant", foreground: "b48ead" },
    { token: "operator", foreground: "81a1c1" },
    { token: "tag", foreground: "81a1c1" },
    { token: "attribute.name", foreground: "8fbcbb" },
    { token: "attribute.value", foreground: "a3be8c" },
    { token: "delimiter", foreground: "eceff4" },
  ],
  colors: {
    "editor.background": "#2e3440",
    "editor.foreground": "#d8dee9",
    "editor.lineHighlightBackground": "#3b4252",
    "editor.selectionBackground": "#434c5e",
    "editorCursor.foreground": "#d8dee9",
    "editorWhitespace.foreground": "#434c5e60",
    "editorLineNumber.foreground": "#4c566a",
    "editorLineNumber.activeForeground": "#d8dee9",
    "editorIndentGuide.background": "#434c5e60",
    "editorIndentGuide.activeBackground": "#4c566a",
    "editorBracketMatch.background": "#434c5e80",
    "editorBracketMatch.border": "#88c0d050",
    "editor.findMatchBackground": "#88c0d044",
    "editor.findMatchHighlightBackground": "#ffffff18",
    "editorOverviewRuler.border": "#2e3440",
    "scrollbarSlider.background": "#4c566a80",
    "scrollbarSlider.hoverBackground": "#4c566aa0",
    "scrollbarSlider.activeBackground": "#4c566ac0",
  },
};

// ── All built-in themes ──────────────────────────────────────

export const BUILT_IN_THEMES: MonacoThemeDef[] = [
  oneDark,
  dracula,
  githubDark,
  monokai,
  nord,
];
