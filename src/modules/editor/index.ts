/**
 * @module editor
 *
 * Public API for the File Editor module.
 *
 * Usage:
 *   import { FileEditor, ThemeManager, FormatterRegistry, ApiContentProvider } from "@/modules/editor";
 *
 *   <FileEditor
 *     sessionId={sessionId}
 *     remotePath={remotePath}
 *     provider={new ApiContentProvider()}
 *   />
 */

// ── Main component ──────────────────────────────────────────
export { FileEditor, type FileEditorProps } from "./FileEditor";

// ── Theme management ────────────────────────────────────────
export { ThemeManager } from "./themes/manager";
export { BUILT_IN_THEMES, dracula, vsDark, monokai, oneDark, darcula, solarizedDark, githubDark } from "./themes/defaults";

// ── Content providers ───────────────────────────────────────
export { ApiContentProvider, SocketContentProvider, createContentProvider } from "./api/providers";

// ── Formatters ──────────────────────────────────────────────
export { FormatterRegistry } from "./formatters";

// ── Core utilities ──────────────────────────────────────────
export { detectLanguage, detectPrismLanguage } from "./core/detect-lang";
export { highlightCode } from "./core/syntax";

// ── State (for advanced / embed use cases) ──────────────────
export { EditorProvider, useEditorStore, useEditorStoreApi, useEditorRefs } from "./state/context";
export { createEditorStore } from "./state/store";

// ── Hooks ───────────────────────────────────────────────────
export { useEditor } from "./hooks/useEditor";
export { useTheme } from "./hooks/useTheme";
export { useKeybindings } from "./hooks/useKeybindings";
export { useContentProvider } from "./hooks/useContentProvider";

// ── Types ───────────────────────────────────────────────────
export type {
    EditorTheme,
    PartialTheme,
    ThemeColors,
    ThemeSyntax,
    ThemeFont,
    EditorConfig,
    ContentProvider,
    FormatterFn,
    FormatterDefinition,
    KeyBinding,
    ContextMenuItem,
    EditorPlugin,
    EditorPluginAPI,
    EditorState,
    EditorActions,
    EditorStoreType,
} from "./types";
