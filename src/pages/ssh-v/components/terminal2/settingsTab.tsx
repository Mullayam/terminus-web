
import { Palette, Save, Type } from 'lucide-react';
import { useTabStore } from '@/store/rightSidebarTabStore';
import { Badge } from '@/components/ui/badge';
import { XtermTheme, ThemeName, themeNames } from '@/pages/ssh-v/components/themes';

export default function SettingsTab() {
  const { settings, updateSettings } = useTabStore();

  const handleThemeChange = (theme: ThemeName) => {
    updateSettings({ theme });
  };

  const handleFontSizeChange = (fontSize: 'small' | 'medium' | 'large') => {
    updateSettings({ fontSize });
  };

  const handleToggleSetting = (key: 'notifications' | 'autoSave') => {
    updateSettings({ [key]: !settings[key] });
  };

  return (
    <div className="space-y-6 text-neutral-200 px-2">
      {/* Header */}
      <div>
        <h3 className="text-lg font-semibold text-white">Dummy Settings</h3>
        <p className="text-sm text-neutral-400">Customize your experience</p>
      </div>

      {/* Appearance */}
      <div className="bg-[#1a1b26] rounded-lg p-4 border border-neutral-700">
        <div className="flex items-center space-x-2 mb-4">
          <Palette size={16} className="text-purple-400" />
          <h4 className="font-medium text-white text-sm">Appearance</h4>
        </div>

        <div className="space-y-4">
          {/* Theme */}
          <div>
            <label className="block text-xs font-medium text-neutral-400 mb-2">Theme</label>
            <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
              {themeNames.map((theme) => {
                const colors = XtermTheme[theme];
                const isSelected = settings.theme === theme;

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
                      <span className="block w-3 h-3" style={{ backgroundColor: colors.red }} />
                      <span className="block w-3 h-3" style={{ backgroundColor: colors.green }} />
                      <span className="block w-3 h-3" style={{ backgroundColor: colors.yellow }} />
                      <span className="block w-3 h-3" style={{ backgroundColor: colors.blue }} />
                    </div>
                    <span className="capitalize truncate">{theme}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Font Size */}
          <div>
            <label className="block text-xs font-medium text-neutral-400 mb-2">Font Size</label>
            <div className="grid grid-cols-3 gap-2">
              {(['small', 'medium', 'large'] as const).map((size) => {
                const isSelected = settings.fontSize === size;

                return (
                  <button
                    key={size}
                    onClick={() => handleFontSizeChange(size)}
                    className={`
                      flex items-center justify-center space-x-1 p-2 rounded border transition-colors text-xs
                      ${isSelected
                        ? 'border-blue-400 bg-blue-950 text-blue-200'
                        : 'border-neutral-700 bg-neutral-800 text-neutral-300 hover:border-neutral-600'
                      }
                    `}
                  >
                    <Type size={12} />
                    <span className="capitalize">{size}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Behavior */}
      <div className="bg-[#1a1b26] rounded-lg p-4 border border-neutral-700">
        <h4 className="font-medium text-white text-sm mb-4">Behavior</h4>

        <div className="space-y-3">
          {/* Notifications */}


          {/* Auto Save */}
          <div className="flex items-center justify-between p-2 bg-neutral-800 rounded">
            <div className="flex items-center space-x-2">
              <Save size={14} className="text-neutral-300" />
              <div>
                <p className="font-medium text-white text-xs">Auto Save</p>
                <p className="text-xs text-neutral-400">Save automatically</p>
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
        <span className="text-sm text-neutral-300">Autocomplete</span>
        <Badge variant="outline" className="bg-neutral-700 text-neutral-300 border border-neutral-600">
          Disabled
        </Badge>
      </div>
    </div>
  );
}
