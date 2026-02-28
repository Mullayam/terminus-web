/**
 * @module components/ThemeSidebar
 *
 * Monaco Editor theme management sidebar panel.
 * Browse built-in themes, extension-installed themes, import/export custom themes.
 * Stores custom (imported) themes in IndexedDB via the extension storage system.
 *
 * Follows the pattern from ThemeSelector.tsx (editor module) adapted for Monaco.
 */
import React, { useState, useEffect, useCallback, useRef } from "react";
import type * as monacoNs from "monaco-editor";
import {
  Check,
  Download,
  Upload,
  Trash2,
  Palette,
  Search,
  Sun,
  Moon,
  MonitorDot,
  Loader2,
} from "lucide-react";
import { BUILT_IN_THEMES } from "../themes";
import {
  getAllThemes as getStoredThemes,
  getTheme as getThemeFromRegistry,
  registerTheme,
} from "../core/theme-registry";
import {
  getAvailableExtensionThemes,
  registerExtensionTheme,
} from "../lib/extensionLoader";
import {
  getAllThemes as getAllExtensionThemes,
  getThemeById as getExtThemeById,
} from "../lib/extensionStorage";
import type { MonacoThemeDef } from "../types";
import type { StoredTheme } from "../lib/extensionStorage";

type Monaco = typeof monacoNs;

/* ── Types ─────────────────────────────────────────────────── */

interface ThemeEntry {
  id: string;
  name: string;
  base: "vs" | "vs-dark" | "hc-black" | "hc-light";
  source: "builtin" | "extension" | "custom";
  /** Extension ID (if from extension) */
  extensionId?: string;
  /** Preview colors */
  bg?: string;
  fg?: string;
  accent?: string;
}

export interface ThemeSidebarProps {
  monaco: Monaco | null;
  editor: monacoNs.editor.IStandaloneCodeEditor | null;
  /** Current active theme ID */
  activeTheme?: string;
  /** Called when user selects a theme */
  onThemeApply?: (themeId: string) => void;
}

/* ── Custom themes IDB key ─────────────────────────────────── */
const CUSTOM_THEMES_KEY = "monaco-custom-themes";

/** Get custom themes from localStorage (lightweight, not IDB) */
function getCustomThemes(): MonacoThemeDef[] {
  try {
    const raw = localStorage.getItem(CUSTOM_THEMES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/** Save custom themes to localStorage */
function setCustomThemes(themes: MonacoThemeDef[]) {
  localStorage.setItem(CUSTOM_THEMES_KEY, JSON.stringify(themes));
}

/* ── Component ─────────────────────────────────────────────── */

export const ThemeSidebar: React.FC<ThemeSidebarProps> = ({
  monaco,
  editor,
  activeTheme,
  onThemeApply,
}) => {
  const [themes, setThemes] = useState<ThemeEntry[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Build combined theme list
  const loadThemes = useCallback(async () => {
    setLoading(true);
    const entries: ThemeEntry[] = [];

    // 1. Built-in themes
    for (const t of BUILT_IN_THEMES) {
      entries.push({
        id: t.id,
        name: t.name,
        base: t.base,
        source: "builtin",
        bg: t.colors["editor.background"],
        fg: t.colors["editor.foreground"],
        accent: t.colors["editorCursor.foreground"] || t.colors["editor.foreground"],
      });
    }

    // 2. Extension themes from IDB
    try {
      const extThemes = await getAvailableExtensionThemes();
      for (const et of extThemes) {
        // don't duplicate built-in
        if (entries.some((e) => e.id === et.themeId)) continue;
        entries.push({
          id: et.themeId,
          name: et.label,
          base: et.uiTheme as "vs" | "vs-dark" | "hc-black" | "hc-light",
          source: "extension",
          extensionId: et.extensionId,
        });
      }
    } catch {
      // ignore
    }

    // 3. Custom (imported) themes
    const customs = getCustomThemes();
    for (const c of customs) {
      if (entries.some((e) => e.id === c.id)) continue;
      entries.push({
        id: c.id,
        name: c.name,
        base: c.base,
        source: "custom",
        bg: c.colors["editor.background"],
        fg: c.colors["editor.foreground"],
        accent: c.colors["editorCursor.foreground"] || c.colors["editor.foreground"],
      });
    }

    setThemes(entries);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadThemes();
  }, [loadThemes]);

  /** Apply a theme */
  const handleApply = useCallback(
    async (themeId: string, source: ThemeEntry["source"]) => {
      if (!monaco) return;

      // If extension theme, ensure registered with Monaco
      if (source === "extension") {
        try {
          const storedTheme = await getExtThemeById(themeId);
          if (storedTheme) {
            registerExtensionTheme(monaco, storedTheme);
          }
        } catch {
          // may already be registered
        }
      }

      // If custom theme, ensure registered
      if (source === "custom") {
        const customs = getCustomThemes();
        const def = customs.find((c) => c.id === themeId);
        if (def) {
          registerTheme(monaco, def);
        }
      }

      monaco.editor.setTheme(themeId);
      onThemeApply?.(themeId);
    },
    [monaco, onThemeApply],
  );

  /** Export all custom themes */
  const handleExport = useCallback(() => {
    const customs = getCustomThemes();
    // Also include registered themes
    const allRegistered = getStoredThemes();
    // Merge without duplicates
    const exportSet = new Map<string, MonacoThemeDef>();
    for (const c of customs) exportSet.set(c.id, c);
    // Only export non-built-in themes
    const builtInIds = new Set(BUILT_IN_THEMES.map((b) => b.id));
    for (const r of allRegistered) {
      if (!builtInIds.has(r.id) && !exportSet.has(r.id)) {
        exportSet.set(r.id, r);
      }
    }

    const data = JSON.stringify(Array.from(exportSet.values()), null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "monaco-themes.json";
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  /** Import themes from JSON file */
  const handleImport = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file || !monaco) return;

      const reader = new FileReader();
      reader.onload = () => {
        try {
          const raw = JSON.parse(reader.result as string);
          const importedThemes: MonacoThemeDef[] = Array.isArray(raw) ? raw : [raw];
          const customs = getCustomThemes();

          for (const theme of importedThemes) {
            if (!theme.id || !theme.name || !theme.base || !theme.rules) continue;
            // Register with Monaco
            registerTheme(monaco, theme);
            // Save to custom themes (replace if exists)
            const idx = customs.findIndex((c) => c.id === theme.id);
            if (idx >= 0) {
              customs[idx] = theme;
            } else {
              customs.push(theme);
            }
          }

          setCustomThemes(customs);
          loadThemes();
        } catch {
          // ignore bad files
        }
      };
      reader.readAsText(file);

      // Reset input
      e.target.value = "";
    },
    [monaco, loadThemes],
  );

  /** Import VS Code theme JSON (with tokenColors) */
  const handleImportVSCode = useCallback(() => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file || !monaco) return;

      const reader = new FileReader();
      reader.onload = () => {
        try {
          const data = JSON.parse(reader.result as string);
          // VS Code theme format
          const themeId = file.name.replace(/\.json$/, "").replace(/\s+/g, "-").toLowerCase();
          const base: "vs" | "vs-dark" | "hc-black" =
            data.type === "light" ? "vs" : data.type === "hc" ? "hc-black" : "vs-dark";

          const rules: monacoNs.editor.ITokenThemeRule[] = [];
          if (data.tokenColors) {
            for (const tc of data.tokenColors) {
              const scopes = Array.isArray(tc.scope) ? tc.scope : tc.scope ? [tc.scope] : [];
              for (const scope of scopes) {
                const rule: monacoNs.editor.ITokenThemeRule = { token: scope };
                if (tc.settings?.foreground) rule.foreground = tc.settings.foreground.replace("#", "");
                if (tc.settings?.background) rule.background = tc.settings.background.replace("#", "");
                if (tc.settings?.fontStyle) rule.fontStyle = tc.settings.fontStyle;
                rules.push(rule);
              }
            }
          }

          const colors = data.colors ?? {};
          const themeDef: MonacoThemeDef = {
            id: themeId,
            name: data.name || file.name.replace(/\.json$/, ""),
            base,
            inherit: true,
            rules,
            colors,
          };

          registerTheme(monaco, themeDef);

          const customs = getCustomThemes();
          const idx = customs.findIndex((c) => c.id === themeId);
          if (idx >= 0) customs[idx] = themeDef;
          else customs.push(themeDef);
          setCustomThemes(customs);

          loadThemes();
          // Auto-apply
          monaco.editor.setTheme(themeId);
          onThemeApply?.(themeId);
        } catch {
          // ignore bad files
        }
      };
      reader.readAsText(file);
    };
    input.click();
  }, [monaco, loadThemes, onThemeApply]);

  /** Delete a custom theme */
  const handleDelete = useCallback(
    (themeId: string) => {
      const customs = getCustomThemes().filter((c) => c.id !== themeId);
      setCustomThemes(customs);
      loadThemes();
    },
    [loadThemes],
  );

  // Filtered themes
  const filtered = searchQuery
    ? themes.filter(
        (t) =>
          t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          t.id.toLowerCase().includes(searchQuery.toLowerCase()),
      )
    : themes;

  const builtinThemes = filtered.filter((t) => t.source === "builtin");
  const extensionThemes = filtered.filter((t) => t.source === "extension");
  const customThemes = filtered.filter((t) => t.source === "custom");

  return (
    <div className="flex flex-col h-full text-[12px]">
      {/* Hidden file input */}
      <input ref={fileInputRef} type="file" accept=".json" className="hidden" onChange={handleFileChange} />

      {/* Actions bar */}
      <div className="flex items-center gap-1 px-2 py-1.5 border-b border-[#3c3c3c] shrink-0">
        <ActionBtn icon={<Download className="w-3 h-3" />} label="Export" onClick={handleExport} />
        <ActionBtn icon={<Upload className="w-3 h-3" />} label="Import" onClick={handleImport} />
        <ActionBtn icon={<Upload className="w-3 h-3" />} label="VS Code" onClick={handleImportVSCode} title="Import VS Code .json theme" />
      </div>

      {/* Search */}
      <div className="px-2 py-1.5 border-b border-[#3c3c3c] shrink-0">
        <div className="flex items-center gap-1.5 bg-[#3c3c3c] rounded px-2 py-1">
          <Search className="w-3 h-3 text-gray-500 shrink-0" />
          <input
            type="text"
            placeholder="Filter themes…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 bg-transparent text-[11px] text-gray-200 placeholder-gray-500 outline-none border-none"
          />
        </div>
      </div>

      {/* Theme list */}
      <div className="flex-1 overflow-y-auto p-1.5 space-y-3 theme-sidebar-scroll">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-4 h-4 text-gray-500 animate-spin" />
          </div>
        ) : (
          <>
            {builtinThemes.length > 0 && (
              <ThemeGroup title="Built-in" themes={builtinThemes} activeTheme={activeTheme} onApply={handleApply} />
            )}
            {extensionThemes.length > 0 && (
              <ThemeGroup
                title="From Extensions"
                themes={extensionThemes}
                activeTheme={activeTheme}
                onApply={handleApply}
              />
            )}
            {customThemes.length > 0 && (
              <ThemeGroup
                title="Custom"
                themes={customThemes}
                activeTheme={activeTheme}
                onApply={handleApply}
                onDelete={handleDelete}
              />
            )}
            {filtered.length === 0 && (
              <div className="text-center text-gray-500 py-6">
                <Palette className="w-6 h-6 mx-auto mb-1 opacity-30" />
                <p className="text-[11px]">No themes found</p>
              </div>
            )}
          </>
        )}
      </div>

      <style>{`
        .theme-sidebar-scroll::-webkit-scrollbar { width: 5px; }
        .theme-sidebar-scroll::-webkit-scrollbar-track { background: transparent; }
        .theme-sidebar-scroll::-webkit-scrollbar-thumb { background: #5a5a5a; border-radius: 3px; }
        .theme-sidebar-scroll::-webkit-scrollbar-thumb:hover { background: #7a7a7a; }
      `}</style>
    </div>
  );
};

/* ── Helpers ───────────────────────────────────────────────── */

function ActionBtn({
  icon,
  label,
  onClick,
  title,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  title?: string;
}) {
  return (
    <button
      onClick={onClick}
      title={title ?? label}
      className="flex items-center gap-1 text-[10px] px-2 py-1 rounded bg-[#3c3c3c] text-gray-400 hover:text-gray-200 hover:bg-[#505050] transition-colors"
    >
      {icon} {label}
    </button>
  );
}

function BaseIcon({ base }: { base: string }) {
  if (base === "vs") return <Sun className="w-3 h-3 text-yellow-400" />;
  if (base === "hc-black" || base === "hc-light") return <MonitorDot className="w-3 h-3 text-cyan-400" />;
  return <Moon className="w-3 h-3 text-blue-400" />;
}

function ThemeGroup({
  title,
  themes,
  activeTheme,
  onApply,
  onDelete,
}: {
  title: string;
  themes: ThemeEntry[];
  activeTheme?: string;
  onApply: (id: string, source: ThemeEntry["source"]) => void;
  onDelete?: (id: string) => void;
}) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold px-1.5 mb-1">
        {title}
      </div>
      <div className="space-y-0.5">
        {themes.map((t) => (
          <ThemeCard
            key={t.id}
            theme={t}
            active={t.id === activeTheme}
            onApply={() => onApply(t.id, t.source)}
            onDelete={onDelete && t.source === "custom" ? () => onDelete(t.id) : undefined}
          />
        ))}
      </div>
    </div>
  );
}

function ThemeCard({
  theme,
  active,
  onApply,
  onDelete,
}: {
  theme: ThemeEntry;
  active: boolean;
  onApply: () => void;
  onDelete?: () => void;
}) {
  return (
    <button
      onClick={onApply}
      className={`w-full flex items-center gap-2 px-2 py-1.5 rounded transition-colors text-left group ${
        active
          ? "bg-[#094771] border border-blue-600/50"
          : "hover:bg-[#2a2d2e] border border-transparent"
      }`}
    >
      {/* Swatch */}
      <div
        className="w-6 h-6 rounded shrink-0 flex items-center justify-center border border-[#555]"
        style={{ background: theme.bg || (theme.base === "vs" ? "#fff" : "#1e1e1e") }}
      >
        {active ? (
          <Check className="w-3 h-3" style={{ color: theme.accent || "#007acc" }} />
        ) : (
          <BaseIcon base={theme.base} />
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="text-[11px] font-medium text-gray-200 truncate">{theme.name}</div>
        <div className="text-[9px] text-gray-500 truncate">
          {theme.source === "extension" && theme.extensionId
            ? theme.extensionId
            : theme.source === "builtin"
              ? "Built-in"
              : "Custom"}
        </div>
      </div>

      {/* Delete button for custom themes */}
      {onDelete && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="opacity-0 group-hover:opacity-100 p-1 rounded text-gray-500 hover:text-red-400 transition-all"
          title="Delete"
        >
          <Trash2 className="w-3 h-3" />
        </button>
      )}
    </button>
  );
}

ThemeSidebar.displayName = "ThemeSidebar";
