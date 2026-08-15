
import { type ReactNode } from 'react';
import { AlertCircle, Palette, RotateCcw, Save, Type, Bell, Sparkles, Command, Blocks, GitCompare, SquareTerminal, FileCode, Lightbulb } from 'lucide-react';
import { useTabStore } from '@/store/rightSidebarTabStore';
import { XtermTheme, ThemeName, themeNames } from '@/pages/ssh-v/components/themes';
import { useSSHStore } from '@/store/sshStore';
import { useSessionTheme } from '@/hooks/useSessionTheme';
import { useSessionFont } from '@/hooks/useSessionFont';

const FONT_WEIGHTS = [
  { label: 'Thin', value: '100' },
  { label: 'Light', value: '300' },
  { label: 'Normal', value: '400' },
  { label: 'Medium', value: '500' },
  { label: 'Semi', value: '600' },
  { label: 'Bold', value: '700' },
  { label: 'Extra', value: '800' },
  { label: 'Black', value: '900' },
];

/** A single labelled on/off setting row. */
function ToggleRow({ icon, title, description, checked, onToggle, fg }: {
  icon: ReactNode;
  title: string;
  description: string;
  checked: boolean;
  onToggle: () => void;
  fg: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md p-2.5" style={{ backgroundColor: `${fg}0d` }}>
      <div className="flex min-w-0 items-center gap-2.5">
        <span className="shrink-0" style={{ color: `${fg}cc` }}>{icon}</span>
        <div className="min-w-0">
          <p className="text-xs font-medium" style={{ color: fg }}>{title}</p>
          <p className="truncate text-[11px]" style={{ color: `${fg}80` }}>{description}</p>
        </div>
      </div>
      <button
        role="switch"
        aria-checked={checked}
        onClick={onToggle}
        className={`relative inline-flex h-4 w-7 shrink-0 items-center rounded-full transition-colors ${checked ? 'bg-blue-600' : 'bg-neutral-600'}`}
      >
        <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${checked ? 'translate-x-4' : 'translate-x-0.5'}`} />
      </button>
    </div>
  );
}

export default function SettingsTab() {
  const { settings, updateSettings } = useTabStore();
  const activeTabId = useSSHStore((s) => s.activeTabId);
  const setSessionTheme = useSSHStore((s) => s.setSessionTheme);
  const setSessionFont = useSSHStore((s) => s.setSessionFont);
  const { themeName, colors } = useSessionTheme();
  const font = useSessionFont();

  const handleThemeChange = (theme: ThemeName) => {
    if (activeTabId) {
      setSessionTheme(activeTabId, theme);
    }
  };

  const handleFontSizeChange = (fontSize: number) => {
    if (activeTabId) {
      setSessionFont(activeTabId, { fontSize });
    }
  };

  const handleFontWeightChange = (fontWeight: string) => {
    if (activeTabId) {
      setSessionFont(activeTabId, { fontWeight });
    }
  };

  const handleFontWeightBoldChange = (fontWeightBold: string) => {
    if (activeTabId) {
      setSessionFont(activeTabId, { fontWeightBold });
    }
  };

  const handleToggleSetting = (key: 'notifications' | 'autoSave' | 'autocomplete' | 'suggestionBox' | 'diagnostics' | 'commandPalette' | 'commandExplain' | 'commandBlocks' | 'diffBeforeSave') => {
    updateSettings({ [key]: !settings[key] });
  };

  // Reset theme, colors, font and all behavior toggles back to defaults
  const handleReset = () => {
    if (activeTabId) {
      setSessionTheme(activeTabId, 'custom');
      setSessionFont(activeTabId, { fontSize: 15, fontWeight: '400', fontWeightBold: '700' });
    }
    updateSettings({
      theme: 'custom',
      notifications: true,
      autoSave: true,
      autocomplete: true,
      suggestionBox: true,
      diagnostics: false,
      commandPalette: true,
      commandExplain: true,
      commandBlocks: true,
      diffBeforeSave: true,
      fontSize: 'medium',
    });
  };

  return (
    <div className="space-y-6 px-4 pt-4 pb-6" style={{ color: `${colors.foreground}dd` }}>
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-lg font-semibold" style={{ color: colors.foreground }}>Settings</h3>
          <p className="text-sm" style={{ color: `${colors.foreground}80` }}>Customize your experience</p>
        </div>
        <button
          onClick={handleReset}
          title="Reset theme, colors, font, autocomplete & suggestions to defaults"
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border text-xs transition-colors shrink-0 hover:opacity-80"
          style={{ borderColor: `${colors.foreground}30`, color: colors.foreground, backgroundColor: `${colors.foreground}10` }}
        >
          <RotateCcw size={14} />
          Reset
        </button>
      </div>

      {/* Appearance */}
      <div className="rounded-lg p-4 border" style={{ backgroundColor: `${colors.background}dd`, borderColor: `${colors.foreground}20` }}>
        <div className="flex items-center space-x-2 mb-4">
          <Palette size={16} className="text-purple-400" />
          <h4 className="font-medium text-sm" style={{ color: colors.foreground }}>Appearance</h4>
        </div>

        <div className="space-y-4">
          {/* Theme */}
          <div>
            <label className="block text-xs font-medium mb-2" style={{ color: `${colors.foreground}80` }}>Theme</label>
            <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
              {themeNames.map((theme) => {
                const colors = XtermTheme[theme];
                const isSelected = themeName === theme;

                return (
                  <button
                    key={theme}
                    onClick={() => handleThemeChange(theme)}
                    className={`
                      flex items-center space-x-2 p-2 rounded border transition-colors text-xs
                      ${isSelected
                        ? 'border-blue-400 bg-blue-950 text-blue-200'
                        : 'border-neutral-700 bg-neutral-800 text-neutral-300 hover:border-neutral-600'
                      }
                    `}
                  >
                    <div className="flex gap-px shrink-0 rounded overflow-hidden border border-neutral-600" style={{ backgroundColor: colors.background }}>
                      <span className="block w-3 h-3" style={{ backgroundColor: colors?.red }} />
                      <span className="block w-3 h-3" style={{ backgroundColor: colors?.green }} />
                      <span className="block w-3 h-3" style={{ backgroundColor: colors?.yellow }} />
                      <span className="block w-3 h-3" style={{ backgroundColor: colors?.blue }} />
                    </div>
                    <span className="capitalize truncate">{theme}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Font Size */}
          <div>
            <label className="block text-xs font-medium mb-2" style={{ color: `${colors.foreground}80` }}>
              Font Size: <span style={{ color: colors.foreground }}>{font.fontSize}px</span>
            </label>
            <input
              type="range"
              min={8}
              max={28}
              step={1}
              value={font.fontSize}
              onChange={(e) => handleFontSizeChange(Number(e.target.value))}
              className="w-full h-1.5 bg-neutral-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
            />
            <div className="flex justify-between text-[10px] mt-1" style={{ color: `${colors.foreground}60` }}>
              <span>8px</span>
              <span>28px</span>
            </div>
          </div>

          {/* Font Weight */}
          <div>
            <label className="block text-xs font-medium mb-2" style={{ color: `${colors.foreground}80` }}>Font Weight</label>
            <div className="grid grid-cols-4 gap-1.5">
              {FONT_WEIGHTS.map((w) => {
                const isSelected = font.fontWeight === w.value;
                return (
                  <button
                    key={w.value}
                    onClick={() => handleFontWeightChange(w.value)}
                    className={`
                      p-1.5 rounded border transition-colors text-[10px]
                      ${isSelected
                        ? 'border-blue-400 bg-blue-950 text-blue-200'
                        : 'border-neutral-700 bg-neutral-800 text-neutral-300 hover:border-neutral-600'
                      }
                    `}
                  >
                    {w.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Font Weight Bold */}
          <div>
            <label className="block text-xs font-medium mb-2" style={{ color: `${colors.foreground}80` }}>Font Weight Bold</label>
            <div className="grid grid-cols-4 gap-1.5">
              {FONT_WEIGHTS.map((w) => {
                const isSelected = font.fontWeightBold === w.value;
                return (
                  <button
                    key={w.value}
                    onClick={() => handleFontWeightBoldChange(w.value)}
                    className={`
                      p-1.5 rounded border transition-colors text-[10px]
                      ${isSelected
                        ? 'border-blue-400 bg-blue-950 text-blue-200'
                        : 'border-neutral-700 bg-neutral-800 text-neutral-300 hover:border-neutral-600'
                      }
                    `}
                  >
                    {w.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Terminal behavior */}
      <div className="rounded-lg p-4 border" style={{ backgroundColor: `${colors.background}dd`, borderColor: `${colors.foreground}20` }}>
        <div className="flex items-center space-x-2 mb-4">
          <SquareTerminal size={16} className="text-blue-400" />
          <h4 className="font-medium text-sm" style={{ color: colors.foreground }}>Terminal</h4>
        </div>
        <div className="space-y-2">
          <ToggleRow icon={<Type size={14} />} title="Autocomplete" description="Ghost text & suggestions" checked={settings.autocomplete} onToggle={() => handleToggleSetting('autocomplete')} fg={colors.foreground} />
          <ToggleRow icon={<Sparkles size={14} />} title="Suggestion Box" description="AI suggestions & ghost text" checked={settings.suggestionBox} onToggle={() => handleToggleSetting('suggestionBox')} fg={colors.foreground} />
          <ToggleRow icon={<Command size={14} />} title="Command Palette" description="Ctrl+K natural-language commands" checked={settings.commandPalette} onToggle={() => handleToggleSetting('commandPalette')} fg={colors.foreground} />
          <ToggleRow icon={<Lightbulb size={14} />} title="Explain Command" description="Ctrl+Shift+E AI explanation before running" checked={settings.commandExplain} onToggle={() => handleToggleSetting('commandExplain')} fg={colors.foreground} />
          <ToggleRow icon={<Blocks size={14} />} title="Command Blocks" description="Capture, re-run & fix commands" checked={settings.commandBlocks} onToggle={() => handleToggleSetting('commandBlocks')} fg={colors.foreground} />
          <ToggleRow icon={<AlertCircle size={14} />} title="Diagnostics" description="Error & warning detection" checked={settings.diagnostics} onToggle={() => handleToggleSetting('diagnostics')} fg={colors.foreground} />
          <ToggleRow icon={<Bell size={14} />} title="Notifications" description="Show terminal notifications" checked={settings.notifications} onToggle={() => handleToggleSetting('notifications')} fg={colors.foreground} />
        </div>
      </div>

      {/* Editor behavior */}
      <div className="rounded-lg p-4 border" style={{ backgroundColor: `${colors.background}dd`, borderColor: `${colors.foreground}20` }}>
        <div className="flex items-center space-x-2 mb-4">
          <FileCode size={16} className="text-emerald-400" />
          <h4 className="font-medium text-sm" style={{ color: colors.foreground }}>Editor</h4>
        </div>
        <div className="space-y-2">
          <ToggleRow icon={<Save size={14} />} title="Auto Save" description="Save automatically after edits" checked={settings.autoSave} onToggle={() => handleToggleSetting('autoSave')} fg={colors.foreground} />
          <ToggleRow icon={<GitCompare size={14} />} title="Diff Before Save" description="Review SFTP changes before writing" checked={settings.diffBeforeSave} onToggle={() => handleToggleSetting('diffBeforeSave')} fg={colors.foreground} />
        </div>
      </div>
    </div>
  );
}
