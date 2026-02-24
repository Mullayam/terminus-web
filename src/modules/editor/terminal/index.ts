/**
 * @module editor/terminal
 *
 * Public barrel for the embedded terminal panel.
 *
 *   import { TerminalPanel, useTerminalPanelStore, XtermTerminal } from "@/modules/editor/terminal";
 */
export { TerminalPanel, type TerminalPanelProps } from "./TerminalPanel";
export { XtermTerminal, type XtermTerminalProps, type TerminalEvents } from "./XtermTerminal";
export { useTerminalPanelStore, type TerminalPanelState, type TerminalPanelActions, type TerminalPanelStore } from "./store";
export { editorThemeToXterm } from "./themeAdapter";
