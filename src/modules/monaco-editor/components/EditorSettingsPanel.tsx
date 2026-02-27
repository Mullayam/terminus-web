/**
 * @module components/EditorSettingsPanel
 *
 * VS Code-style settings panel for the Monaco Editor sidebar.
 * Allows users to change editor settings like word wrap, minimap,
 * line numbers, font size, tab size, theme, and panel visibility.
 *
 * Settings are persisted to localStorage and applied in real-time.
 */
import React from "react";
import {
  ChevronDown,
  RotateCcw,
} from "lucide-react";

/* ── Types ─────────────────────────────────────────────────── */

export interface EditorSettings {
  fontSize: number;
  tabSize: number;
  wordWrap: "off" | "on" | "wordWrapColumn" | "bounded";
  minimap: boolean;
  lineNumbers: "on" | "off" | "relative" | "interval";
  stickyScroll: boolean;
  bracketPairColorization: boolean;
  cursorBlinking: "blink" | "smooth" | "phase" | "expand" | "solid";
  renderWhitespace: "none" | "boundary" | "selection" | "all";
  fontLigatures: boolean;
  mouseWheelZoom: boolean;
  showStatusBar: boolean;
  showTerminal: boolean;
}

export const DEFAULT_EDITOR_SETTINGS: EditorSettings = {
  fontSize: 14,
  tabSize: 2,
  wordWrap: "off",
  minimap: true,
  lineNumbers: "on",
  stickyScroll: true,
  bracketPairColorization: true,
  cursorBlinking: "smooth",
  renderWhitespace: "selection",
  fontLigatures: true,
  mouseWheelZoom: true,
  showStatusBar: true,
  showTerminal: false,
};

const STORAGE_KEY = "terminus-editor-settings";

/** Load settings from localStorage, merging with defaults */
export function loadEditorSettings(): EditorSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_EDITOR_SETTINGS };
    return { ...DEFAULT_EDITOR_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_EDITOR_SETTINGS };
  }
}

/** Save settings to localStorage */
export function saveEditorSettings(settings: EditorSettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    /* ignore quota errors */
  }
}

/* ── Props ─────────────────────────────────────────────────── */

export interface EditorSettingsPanelProps {
  settings: EditorSettings;
  onChange: (settings: EditorSettings) => void;
  /** Whether terminal integration is enabled (hides terminal toggle if false) */
  enableTerminal?: boolean;
}

/* ── Component ─────────────────────────────────────────────── */

export const EditorSettingsPanel: React.FC<EditorSettingsPanelProps> = ({
  settings,
  onChange,
  enableTerminal = false,
}) => {
  const update = <K extends keyof EditorSettings>(key: K, value: EditorSettings[K]) => {
    const next = { ...settings, [key]: value };
    onChange(next);
  };

  const resetAll = () => {
    onChange({ ...DEFAULT_EDITOR_SETTINGS });
  };

  return (
    <div className="py-2 px-3 settings-panel">
      {/* Reset button */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">
          Settings
        </span>
        <button
          onClick={resetAll}
          title="Reset all settings to defaults"
          className="flex items-center gap-1 text-[10px] text-gray-500 hover:text-gray-300 transition-colors"
        >
          <RotateCcw className="w-3 h-3" />
          Reset
        </button>
      </div>

      {/* ── Editor Section ─────────────────────────────── */}
      <SettingsSection title="Editor">
        <NumberSetting
          label="Font Size"
          value={settings.fontSize}
          min={8}
          max={32}
          onChange={(v) => update("fontSize", v)}
        />
        <SelectSetting
          label="Tab Size"
          value={String(settings.tabSize)}
          options={[
            { label: "2", value: "2" },
            { label: "4", value: "4" },
            { label: "8", value: "8" },
          ]}
          onChange={(v) => update("tabSize", Number(v))}
        />
        <SelectSetting
          label="Word Wrap"
          value={settings.wordWrap}
          options={[
            { label: "Off", value: "off" },
            { label: "On", value: "on" },
            { label: "Word Wrap Column", value: "wordWrapColumn" },
            { label: "Bounded", value: "bounded" },
          ]}
          onChange={(v) => update("wordWrap", v as EditorSettings["wordWrap"])}
        />
        <SelectSetting
          label="Line Numbers"
          value={settings.lineNumbers}
          options={[
            { label: "On", value: "on" },
            { label: "Off", value: "off" },
            { label: "Relative", value: "relative" },
            { label: "Interval", value: "interval" },
          ]}
          onChange={(v) => update("lineNumbers", v as EditorSettings["lineNumbers"])}
        />
        <ToggleSetting
          label="Minimap"
          value={settings.minimap}
          onChange={(v) => update("minimap", v)}
        />
      </SettingsSection>

      {/* ── Appearance Section ─────────────────────────── */}
      <SettingsSection title="Appearance">
        <ToggleSetting
          label="Sticky Scroll"
          value={settings.stickyScroll}
          onChange={(v) => update("stickyScroll", v)}
        />
        <ToggleSetting
          label="Bracket Pair Colors"
          value={settings.bracketPairColorization}
          onChange={(v) => update("bracketPairColorization", v)}
        />
        <SelectSetting
          label="Cursor Animation"
          value={settings.cursorBlinking}
          options={[
            { label: "Blink", value: "blink" },
            { label: "Smooth", value: "smooth" },
            { label: "Phase", value: "phase" },
            { label: "Expand", value: "expand" },
            { label: "Solid", value: "solid" },
          ]}
          onChange={(v) => update("cursorBlinking", v as EditorSettings["cursorBlinking"])}
        />
        <SelectSetting
          label="Whitespace"
          value={settings.renderWhitespace}
          options={[
            { label: "None", value: "none" },
            { label: "Boundary", value: "boundary" },
            { label: "Selection", value: "selection" },
            { label: "All", value: "all" },
          ]}
          onChange={(v) => update("renderWhitespace", v as EditorSettings["renderWhitespace"])}
        />
        <ToggleSetting
          label="Font Ligatures"
          value={settings.fontLigatures}
          onChange={(v) => update("fontLigatures", v)}
        />
        <ToggleSetting
          label="Mouse Wheel Zoom"
          value={settings.mouseWheelZoom}
          onChange={(v) => update("mouseWheelZoom", v)}
        />
      </SettingsSection>

      {/* ── Panels Section ─────────────────────────────── */}
      <SettingsSection title="Panels">
        <ToggleSetting
          label="Status Bar"
          value={settings.showStatusBar}
          onChange={(v) => update("showStatusBar", v)}
        />
        {enableTerminal && (
          <ToggleSetting
            label="Terminal"
            value={settings.showTerminal}
            onChange={(v) => update("showTerminal", v)}
          />
        )}
      </SettingsSection>

      {/* Scrollbar styling */}
      <style>{`
        .settings-panel::-webkit-scrollbar { width: 5px; }
        .settings-panel::-webkit-scrollbar-track { background: transparent; }
        .settings-panel::-webkit-scrollbar-thumb { background: #5a5a5a; border-radius: 3px; }
        .settings-panel::-webkit-scrollbar-thumb:hover { background: #7a7a7a; }
      `}</style>
    </div>
  );
};

/* ── Sub-components ────────────────────────────────────────── */

function SettingsSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-3">
      <div className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold mb-1.5 border-b border-[#3c3c3c] pb-1">
        {title}
      </div>
      <div className="flex flex-col gap-1">{children}</div>
    </div>
  );
}

function ToggleSetting({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between py-1 px-1 rounded hover:bg-[#2a2d2e] transition-colors group">
      <span className="text-[12px] text-gray-400 group-hover:text-gray-200 transition-colors">
        {label}
      </span>
      <button
        onClick={() => onChange(!value)}
        className={`relative w-[32px] h-[16px] rounded-full transition-colors ${
          value ? "bg-[#007acc]" : "bg-[#555]"
        }`}
      >
        <span
          className={`absolute top-[2px] w-[12px] h-[12px] rounded-full bg-white transition-transform ${
            value ? "left-[18px]" : "left-[2px]"
          }`}
        />
      </button>
    </div>
  );
}

function SelectSetting({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { label: string; value: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex items-center justify-between py-1 px-1 rounded hover:bg-[#2a2d2e] transition-colors group">
      <span className="text-[12px] text-gray-400 group-hover:text-gray-200 transition-colors">
        {label}
      </span>
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="appearance-none bg-[#3c3c3c] text-[11px] text-gray-300 pl-2 pr-5 py-0.5 rounded border border-[#555] hover:border-[#007acc] focus:border-[#007acc] focus:outline-none transition-colors cursor-pointer"
        >
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <ChevronDown className="absolute right-1 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-500 pointer-events-none" />
      </div>
    </div>
  );
}

function NumberSetting({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="flex items-center justify-between py-1 px-1 rounded hover:bg-[#2a2d2e] transition-colors group">
      <span className="text-[12px] text-gray-400 group-hover:text-gray-200 transition-colors">
        {label}
      </span>
      <div className="flex items-center gap-1.5">
        <input
          type="range"
          min={min}
          max={max}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-[60px] h-[3px] accent-[#007acc] cursor-pointer"
        />
        <span className="text-[11px] text-gray-400 w-[20px] text-right tabular-nums">
          {value}
        </span>
      </div>
    </div>
  );
}

EditorSettingsPanel.displayName = "EditorSettingsPanel";
