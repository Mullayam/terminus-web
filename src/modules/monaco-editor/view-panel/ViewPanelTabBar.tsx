/**
 * @module monaco-editor/view-panel/ViewPanelTabBar
 *
 * Renders view panel tabs in the editor tab bar.
 * Each view panel tab shows an icon + title, with close button.
 */
import React, { memo } from "react";
import { XIcon } from "lucide-react";
import type { ViewPanelTab } from "./store";
import type { ViewPanelDescriptor } from "./types";

interface ViewPanelTabBarProps {
  tabs: ViewPanelTab[];
  registry: Map<string, ViewPanelDescriptor>;
  activeViewTabId: string | null;
  /** Currently active editor tab ID (null when a view panel is focused) */
  activeEditorTabId: string | null;
  onActivate: (tabId: string) => void;
  onClose: (tabId: string) => void;
}

export const ViewPanelTabBar = memo(function ViewPanelTabBar({
  tabs,
  registry,
  activeViewTabId,
  activeEditorTabId,
  onActivate,
  onClose,
}: ViewPanelTabBarProps) {
  if (tabs.length === 0) return null;

  return (
    <>
      {tabs.map((tab) => {
        const descriptor = registry.get(tab.panelId);
        if (!descriptor) return null;
        const isActive = tab.tabId === activeViewTabId && !activeEditorTabId;
        return (
          <div
            key={tab.tabId}
            className={`group/vptab flex items-center gap-1.5 px-3 py-1 cursor-pointer text-[12px] shrink-0 transition-colors ${
              isActive ? "text-gray-200" : "text-gray-500 hover:text-gray-300"
            }`}
            style={{
              background: isActive ? "var(--editor-bg, #1e1e1e)" : "transparent",
              borderRight: "1px solid var(--editor-border, #3c3c3c)",
            }}
            onClick={() => onActivate(tab.tabId)}
            onMouseEnter={(e) => {
              if (!isActive) e.currentTarget.style.background = "var(--editor-hover-bg, #2a2d2e)";
            }}
            onMouseLeave={(e) => {
              if (!isActive) e.currentTarget.style.background = "transparent";
            }}
          >
            {descriptor.icon && (
              <span className="flex items-center shrink-0" style={{ width: 14, height: 14 }}>
                {descriptor.icon}
              </span>
            )}
            <span className="truncate max-w-[120px]">{descriptor.title}</span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onClose(tab.tabId);
              }}
              className="ml-1 rounded-sm opacity-0 group-hover/vptab:opacity-100 transition-opacity"
              style={{ color: "var(--editor-fg, #ccc)" }}
              title="Close panel"
            >
              <XIcon className="w-3 h-3" />
            </button>
          </div>
        );
      })}
    </>
  );
});
