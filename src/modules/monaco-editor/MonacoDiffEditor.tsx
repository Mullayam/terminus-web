/**
 * @module monaco-editor/MonacoDiffEditor
 *
 * Reusable diff editor component built on @monaco-editor/react.
 *
 * Usage:
 *   import { MonacoDiffEditor } from "@/modules/monaco-editor";
 *
 *   <MonacoDiffEditor original={old} modified={current} language="json" />
 */

import React, { useCallback } from "react";
import { DiffEditor, type DiffOnMount } from "@monaco-editor/react";
import type { Monaco, MonacoDiffEditorConfig, MonacoDiffEditorInstance } from "./types";
import { registerThemes } from "./core/theme-registry";
import { BUILT_IN_THEMES } from "./themes";

export const MonacoDiffEditor: React.FC<MonacoDiffEditorConfig> = ({
  original,
  modified,
  language = "plaintext",
  theme = "one-dark",
  renderSideBySide = true,
  height = "100%",
  width = "100%",
  options = {},
  onMount: onMountProp,
}) => {
  const handleMount: DiffOnMount = useCallback(
    (editor: MonacoDiffEditorInstance, monaco: Monaco) => {
      // Register built-in themes
      registerThemes(monaco, BUILT_IN_THEMES);
      onMountProp?.(editor, monaco);
    },
    [onMountProp],
  );

  const mergedOptions = {
    readOnly: true,
    renderSideBySide,
    fontSize: 14,
    fontFamily: "'Fira Code', 'Cascadia Code', Consolas, monospace",
    fontLigatures: true,
    smoothScrolling: true,
    automaticLayout: true,
    scrollBeyondLastLine: false,
    minimap: { enabled: false },
    ...options,
  };

  return (
    <DiffEditor
      height={height}
      width={width}
      language={language}
      theme={theme}
      original={original}
      modified={modified}
      options={mergedOptions}
      onMount={handleMount}
      loading={
        <div className="flex items-center justify-center h-full w-full bg-background text-muted-foreground">
          <div className="flex flex-col items-center gap-2">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <span className="text-sm">Loading diff editor…</span>
          </div>
        </div>
      }
    />
  );
};

MonacoDiffEditor.displayName = "MonacoDiffEditor";
