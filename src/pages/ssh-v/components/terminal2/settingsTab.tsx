
import { Palette, Save, Type } from 'lucide-react';
import { useTabStore } from '@/store/rightSidebarTabStore';
import { Badge } from '@/components/ui/badge';
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

  const handleToggleSetting = (key: 'notifications' | 'autoSave') => {
    updateSettings({ [key]: !settings[key] });
  };

  return (
    <div className="space-y-6 px-2" style={{ color: `${colors.foreground}dd` }}>
      {/* Header */}
      <div>
        <h3 className="text-lg font-semibold" style={{ color: colors.foreground }}>Dummy Settings</h3>
        <p className="text-sm" style={{ color: `${colors.foreground}80` }}>Customize your experience</p>
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

      {/* Behavior */}
      <div className="rounded-lg p-4 border" style={{ backgroundColor: `${colors.background}dd`, borderColor: `${colors.foreground}20` }}>
        <h4 className="font-medium text-sm mb-4" style={{ color: colors.foreground }}>Behavior</h4>

        <div className="space-y-3">
          {/* Notifications */}


          {/* Auto Save */}
          <div className="flex items-center justify-between p-2 rounded" style={{ backgroundColor: `${colors.foreground}10` }}>
            <div className="flex items-center space-x-2">
              <Save size={14} style={{ color: `${colors.foreground}cc` }} />
              <div>
                <p className="font-medium text-xs" style={{ color: colors.foreground }}>Auto Save</p>
                <p className="text-xs" style={{ color: `${colors.foreground}80` }}>Save automatically</p>
              </div>
            </div>
            <button
              onClick={() => handleToggleSetting('autoSave')}
              className={`
                relative inline-flex h-4 w-7 items-center rounded-full transition-colors
                ${settings.autoSave ? 'bg-blue-600' : 'bg-neutral-600'}
              `}
            >
              <span
                className={`
                  inline-block h-3 w-3 transform rounded-full bg-white transition-transform
                  ${settings.autoSave ? 'translate-x-4' : 'translate-x-0.5'}
                `}
              />
            </button>
          </div>
        </div>
      </div>

    

      {/* Autocomplete status */}
      <div className="flex items-center justify-between p-4">
        <span className="text-sm" style={{ color: `${colors.foreground}cc` }}>Autocomplete</span>
        <Badge variant="outline" style={{ backgroundColor: `${colors.foreground}15`, color: `${colors.foreground}cc`, borderColor: `${colors.foreground}20` }}>
          Disabled
        </Badge>
      </div>
    </div>
  );
}
