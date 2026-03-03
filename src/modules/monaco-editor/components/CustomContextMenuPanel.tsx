/**
 * @module components/CustomContextMenuPanel
 *
 * Dedicated sidebar panel for managing custom editor context menu items.
 * Supports three action types: command, url, and insert.
 */
import React, { useState, useCallback } from "react";
import { Plus, Trash2, Menu, Zap } from "lucide-react";

/* ── Props ─────────────────────────────────────────────────── */

export interface CustomContextMenuPanelProps {
  items: Array<{ label: string; action: string }>;
  onChange: (items: Array<{ label: string; action: string }>) => void;
}

/* ── Component ─────────────────────────────────────────────── */

export const CustomContextMenuPanel: React.FC<CustomContextMenuPanelProps> = ({
  items,
  onChange,
}) => {
  const [newLabel, setNewLabel] = useState("");
  const [newAction, setNewAction] = useState("");
  const [actionType, setActionType] = useState<"command" | "url" | "insert">("command");

  const actionPrefixes: Record<string, string> = {
    command: "command:",
    url: "url:",
    insert: "insert:",
  };

  const actionPlaceholders: Record<string, string> = {
    command: "editor.action.formatDocument",
    url: "https://api.example.com/ai-tool",
    insert: "// TODO: implement",
  };

  const addEntry = useCallback(() => {
    const label = newLabel.trim();
    const action = newAction.trim();
    if (!label || !action) return;
    const fullAction = `${actionPrefixes[actionType]}${action}`;
    if (items.some((e) => e.label === label && e.action === fullAction)) return;
    onChange([...items, { label, action: fullAction }]);
    setNewLabel("");
    setNewAction("");
  }, [newLabel, newAction, actionType, items, onChange]);

  const removeEntry = useCallback(
    (index: number) => {
      onChange(items.filter((_, i) => i !== index));
    },
    [items, onChange],
  );

  /** Parse action string back into type + value for display */
  const parseAction = (action: string) => {
    for (const [type, prefix] of Object.entries(actionPrefixes)) {
      if (action.startsWith(prefix)) {
        return { type, value: action.slice(prefix.length) };
      }
    }
    return { type: "command", value: action };
  };

  const typeColors: Record<string, string> = {
    command: "#007acc",
    url: "#4ec9b0",
    insert: "#ce9178",
  };

  return (
    <div className="py-2 px-3 context-menu-panel">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">
          Custom Context Menu
        </span>
        <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#3c3c3c] text-gray-400 border border-[#555] tabular-nums font-mono">
          {items.length} item{items.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Existing entries */}
      {items.length > 0 && (
        <div className="flex flex-col gap-1 mb-3">
          {items.map((entry, i) => {
            const parsed = parseAction(entry.action);
            return (
              <div
                key={i}
                className="flex items-center gap-1.5 px-1.5 py-1 rounded bg-[#2a2d2e] group"
              >
                <Menu className="w-3 h-3 text-gray-500 shrink-0" />
                <div className="flex flex-col min-w-0 flex-1">
                  <span className="text-[10px] text-gray-300 truncate font-medium">
                    {entry.label}
                  </span>
                  <span className="text-[9px] truncate flex items-center gap-1" title={entry.action}>
                    <span
                      className="px-1 py-px rounded text-[8px] font-mono uppercase"
                      style={{
                        background: `${typeColors[parsed.type] ?? "#555"}22`,
                        color: typeColors[parsed.type] ?? "#888",
                        border: `1px solid ${typeColors[parsed.type] ?? "#555"}44`,
                      }}
                    >
                      {parsed.type}
                    </span>
                    <span className="text-gray-500 truncate">{parsed.value}</span>
                  </span>
                </div>
                <button
                  onClick={() => removeEntry(i)}
                  className="text-gray-600 hover:text-red-400 transition-colors shrink-0"
                  title="Remove"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Add new entry */}
      <div className="mb-3">
        <div className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold mb-1.5 border-b border-[#3c3c3c] pb-1">
          Add Item
        </div>
        <div className="flex flex-col gap-1.5 px-1">
          <div className="flex items-center gap-1">
            <Zap className="w-3 h-3 text-gray-500 shrink-0" />
            <input
              type="text"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              placeholder="Menu label (e.g. Format Code)"
              className="bg-[#3c3c3c] text-[10px] text-gray-300 px-1.5 py-0.5 rounded border border-[#555] hover:border-[#007acc] focus:border-[#007acc] focus:outline-none transition-colors flex-1 min-w-0"
            />
          </div>
          <div className="flex items-center gap-1">
            <select
              value={actionType}
              onChange={(e) => setActionType(e.target.value as any)}
              className="appearance-none bg-[#3c3c3c] text-[10px] text-gray-300 pl-1.5 pr-4 py-0.5 rounded border border-[#555] hover:border-[#007acc] focus:border-[#007acc] focus:outline-none transition-colors cursor-pointer"
            >
              <option value="command">Command</option>
              <option value="url">URL (AI Tool)</option>
              <option value="insert">Insert Text</option>
            </select>
            <input
              type="text"
              value={newAction}
              onChange={(e) => setNewAction(e.target.value)}
              placeholder={actionPlaceholders[actionType]}
              className="bg-[#3c3c3c] text-[10px] text-gray-300 px-1.5 py-0.5 rounded border border-[#555] hover:border-[#007acc] focus:border-[#007acc] focus:outline-none transition-colors flex-1 min-w-0"
              onKeyDown={(e) => {
                if (e.key === "Enter") addEntry();
              }}
            />
          </div>
          <button
            onClick={addEntry}
            disabled={!newLabel.trim() || !newAction.trim()}
            className="flex items-center justify-center gap-0.5 text-[10px] px-2 py-0.5 rounded bg-[#007acc] text-white hover:bg-[#006bb3] disabled:opacity-40 disabled:cursor-not-allowed transition-colors w-full"
          >
            <Plus className="w-3 h-3" />
            Add Menu Item
          </button>
        </div>
      </div>

      {/* Help text when empty */}
      {items.length === 0 && (
        <div className="px-2 py-3">
          <Menu className="w-8 h-8 text-gray-700 mx-auto mb-2" />
          <p className="text-[11px] text-gray-500 mb-2 text-center">
            No custom context menu items
          </p>
          <div className="text-[10px] text-gray-600 space-y-1">
            <p>Add custom items to the editor right-click menu:</p>
            <p className="text-gray-700">
              <strong>Command</strong> — run a Monaco command<br />
              <strong>URL</strong> — POST editor context to an endpoint<br />
              <strong>Insert</strong> — insert text at cursor
            </p>
          </div>
        </div>
      )}

      {/* Scrollbar styling */}
      <style>{`
        .context-menu-panel::-webkit-scrollbar { width: 5px; }
        .context-menu-panel::-webkit-scrollbar-track { background: transparent; }
        .context-menu-panel::-webkit-scrollbar-thumb { background: #5a5a5a; border-radius: 3px; }
        .context-menu-panel::-webkit-scrollbar-thumb:hover { background: #7a7a7a; }
      `}</style>
    </div>
  );
};

CustomContextMenuPanel.displayName = "CustomContextMenuPanel";
