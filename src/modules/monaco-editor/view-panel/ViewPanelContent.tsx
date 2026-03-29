/**
 * @module monaco-editor/view-panel/ViewPanelContent
 *
 * Renders the active view panel's React component in the editor area.
 */
import React, { memo, Suspense } from "react";
import { Loader2 } from "lucide-react";
import type { ViewPanelTab } from "./store";
import type { ViewPanelDescriptor, ViewPanelProps } from "./types";

interface ViewPanelContentProps {
  tab: ViewPanelTab;
  descriptor: ViewPanelDescriptor;
  filePath?: string;
  fileContent?: string;
  onContentChange?: (content: string) => void;
  onClose: () => void;
  onOpenFile?: (path: string) => void;
  onNotify?: (msg: string, type?: "info" | "success" | "warning" | "error") => void;
}

export const ViewPanelContent = memo(function ViewPanelContent({
  tab,
  descriptor,
  filePath,
  fileContent,
  onContentChange,
  onClose,
  onOpenFile,
  onNotify,
}: ViewPanelContentProps) {
  const Component = descriptor.component;
  const mergedProps: ViewPanelProps = {
    panel: descriptor,
    filePath,
    fileContent,
    onContentChange,
    onClose,
    onOpenFile,
    onNotify,
    ...(descriptor.props ?? {}),
    ...(tab.props ?? {}),
  };

  return (
    <div
      className="h-full w-full overflow-auto"
      style={{ background: "var(--editor-bg, #1e1e1e)", color: "var(--editor-fg, #d4d4d4)" }}
    >
      <Suspense
        fallback={
          <div className="flex items-center justify-center h-full">
            <Loader2 className="w-5 h-5 animate-spin text-blue-400" />
          </div>
        }
      >
        <Component {...mergedProps} />
      </Suspense>
    </div>
  );
});
