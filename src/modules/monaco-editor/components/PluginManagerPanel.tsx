/**
 * @module components/PluginManagerPanel
 *
 * VS Code-like plugin manager panel for the editor right sidebar.
 * Shows all loaded plugins with enable/disable toggles and search.
 */

import React, { useState, useMemo, useCallback } from "react";
import {
  Search,
  Puzzle,
  ToggleLeft,
  ToggleRight,
  ChevronDown,
  ChevronRight,
  AlertCircle,
  Info,
} from "lucide-react";
import { useMonacoPlugins } from "../hooks/useMonacoPlugins";

export const PluginManagerPanel: React.FC = () => {
  const { snapshot, togglePlugin } = useMonacoPlugins();
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    if (!search.trim()) return snapshot;
    const q = search.toLowerCase();
    return snapshot.filter(
      (p) =>
        p.name.toLowerCase().includes(q) || p.id.toLowerCase().includes(q),
    );
  }, [snapshot, search]);

  const enabledCount = useMemo(
    () => snapshot.filter((p) => p.enabled).length,
    [snapshot],
  );
  const disabledCount = snapshot.length - enabledCount;

  const handleToggle = useCallback(
    (pluginId: string) => {
      togglePlugin(pluginId);
    },
    [togglePlugin],
  );

  return (
    <div className="flex flex-col h-full">
      {/* Summary bar */}
      <div
        className="flex items-center justify-between px-3 py-2 text-[11px] text-gray-400 shrink-0"
        style={{ borderBottom: "1px solid var(--editor-border, #3c3c3c)" }}
      >
        <span>
          <span className="text-green-400 font-semibold">{enabledCount}</span> enabled
          {disabledCount > 0 && (
            <>
              {" · "}
              <span className="text-red-400 font-semibold">{disabledCount}</span> disabled
            </>
          )}
        </span>
        <span className="text-gray-500">{snapshot.length} total</span>
      </div>

      {/* Search bar */}
      <div className="px-2 py-1.5 shrink-0" style={{ borderBottom: "1px solid var(--editor-border, #3c3c3c)" }}>
        <div
          className="flex items-center gap-1.5 px-2 py-1 rounded-md"
          style={{ background: "var(--editor-hover-bg, #3c3c3c)" }}
        >
          <Search className="w-3 h-3 text-gray-500 shrink-0" />
          <input
            type="text"
            placeholder="Search plugins..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-transparent border-none outline-none text-[12px] text-gray-300 placeholder-gray-500 w-full"
          />
        </div>
      </div>

      {/* Plugin list */}
      <div className="flex-1 overflow-y-auto sidebar-scroll">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 px-4 text-gray-500">
            <Puzzle className="w-8 h-8 mb-2 opacity-40" />
            <span className="text-xs text-center">
              {search ? "No plugins match your search" : "No plugins loaded"}
            </span>
          </div>
        ) : (
          <div className="py-1">
            {filtered.map((plugin) => {
              const isExpanded = expandedId === plugin.id;
              return (
                <div key={plugin.id}>
                  <div
                    className="flex items-center gap-2 px-3 py-[6px] transition-colors hover:bg-[#2a2d2e] group cursor-pointer"
                    onClick={() =>
                      setExpandedId(isExpanded ? null : plugin.id)
                    }
                  >
                    {/* Expand chevron */}
                    {isExpanded ? (
                      <ChevronDown className="w-3 h-3 shrink-0 text-gray-500" />
                    ) : (
                      <ChevronRight className="w-3 h-3 shrink-0 text-gray-500" />
                    )}

                    {/* Plugin icon */}
                    <Puzzle
                      className={`w-3.5 h-3.5 shrink-0 ${
                        plugin.enabled ? "text-blue-400" : "text-gray-600"
                      }`}
                    />

                    {/* Name */}
                    <span
                      className={`text-[12px] truncate flex-1 ${
                        plugin.enabled
                          ? "text-gray-300 group-hover:text-white"
                          : "text-gray-600 line-through"
                      }`}
                    >
                      {plugin.name}
                    </span>

                    {/* Version badge */}
                    <span className="text-[9px] text-gray-500 shrink-0 font-mono">
                      {plugin.version}
                    </span>

                    {/* Toggle button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggle(plugin.id);
                      }}
                      className="shrink-0 transition-colors"
                      title={
                        plugin.enabled ? "Disable plugin" : "Enable plugin"
                      }
                    >
                      {plugin.enabled ? (
                        <ToggleRight className="w-4 h-4 text-green-400 hover:text-green-300" />
                      ) : (
                        <ToggleLeft className="w-4 h-4 text-gray-600 hover:text-gray-400" />
                      )}
                    </button>
                  </div>

                  {/* Expanded detail */}
                  {isExpanded && (
                    <div
                      className="mx-3 mb-1 px-3 py-2 rounded-md text-[11px]"
                      style={
                        { background: "var(--editor-hover-bg, #1e1e1e)" }
                      }
                    >
                      {/* Description */}
                      {plugin.description && (
                        <div className="flex items-start gap-1.5 mb-2 pb-2" style={{ borderBottom: "1px solid var(--editor-border, #3c3c3c)" }}>
                          <Info className="w-3 h-3 text-blue-400 shrink-0 mt-0.5" />
                          <span className="text-gray-300 leading-relaxed">
                            {plugin.description}
                          </span>
                        </div>
                      )}
                      <div className="text-gray-400 mb-1">
                        <span className="text-gray-500">ID:</span>{" "}
                        <span className="font-mono">{plugin.id}</span>
                      </div>
                      <div className="text-gray-400 mb-1">
                        <span className="text-gray-500">Version:</span>{" "}
                        <span className="font-mono">{plugin.version}</span>
                      </div>
                      <div className="flex items-center gap-1 mt-1.5">
                        <span
                          className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium ${
                            plugin.enabled
                              ? "bg-green-500/10 text-green-400"
                              : "bg-red-500/10 text-red-400"
                          }`}
                        >
                          {plugin.enabled ? "Active" : "Disabled"}
                        </span>
                        {!plugin.enabled && (
                          <span className="inline-flex items-center gap-0.5 text-[10px] text-yellow-500">
                            <AlertCircle className="w-3 h-3" />
                            Reload editor to fully unload
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

PluginManagerPanel.displayName = "PluginManagerPanel";
