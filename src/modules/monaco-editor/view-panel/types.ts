/**
 * @module monaco-editor/view-panel/types
 *
 * Types for the View Panel system — render React components in editor tabs.
 */
import type { ReactNode } from "react";

/** Descriptor for a view panel (a React component shown in an editor tab). */
export interface ViewPanelDescriptor {
  /** Unique panel ID (kebab-case, e.g. "npm-manager") */
  id: string;
  /** Display title shown in the tab bar */
  title: string;
  /** Icon element for the tab (Lucide, SVG, emoji, etc.) */
  icon?: ReactNode;
  /** The React component to render as the panel body */
  component: React.ComponentType<ViewPanelProps>;
  /** Optional props forwarded to the component */
  props?: Record<string, unknown>;
  /** If true, only one instance of this panel can be open at a time */
  singleton?: boolean;
  /** Priority for ordering in command palette (higher = first, default 0) */
  priority?: number;
}

/** Props injected into every view panel component by the host. */
export interface ViewPanelProps {
  /** The panel descriptor */
  panel: ViewPanelDescriptor;
  /** Current file path in the active editor tab (if any) */
  filePath?: string;
  /** Current file content (if available) */
  fileContent?: string;
  /** Callback to update the editor content (e.g. after adding a dependency) */
  onContentChange?: (content: string) => void;
  /** Close this panel */
  onClose?: () => void;
  /** Open a file in a new editor tab */
  onOpenFile?: (path: string) => void;
  /** Show a notification */
  onNotify?: (msg: string, type?: "info" | "success" | "warning" | "error") => void;
  /** Any extra props from the descriptor */
  [key: string]: unknown;
}
