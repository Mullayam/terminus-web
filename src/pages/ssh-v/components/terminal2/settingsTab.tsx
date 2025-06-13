
import { Palette,  Save, Type, Monitor, Sun, Moon } from 'lucide-react';
import { useTabStore } from '@/store/rightSidebarTabStore';
import { Badge } from '@/components/ui/badge';

export default function SettingsTab() {
  const { settings, updateSettings } = useTabStore();

  const handleThemeChange = (theme: 'light' | 'dark' | 'auto') => {
    updateSettings({ theme });
  };

  const handleFontSizeChange = (fontSize: 'small' | 'medium' | 'large') => {
    updateSettings({ fontSize });
  };

  const handleToggleSetting = (key: 'notifications' | 'autoSave') => {
    updateSettings({ [key]: !settings[key] });
  };

  const getThemeIcon = (theme: string) => {
    switch (theme) {
      case 'light': return Sun;
      case 'dark': return Moon;
      case 'auto': return Monitor;
      default: return Monitor;
    }
  };

  return (
    <div className="space-y-6 text-neutral-200">
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
            <div className="grid grid-cols-3 gap-2">
              {(['light', 'dark', 'auto'] as const).map((theme) => {
                const Icon = getThemeIcon(theme);
                const isSelected = settings.theme === theme;

                return (
                  <button
                    key={theme}
                    onClick={() => handleThemeChange(theme)}
                    className={`
                      flex items-center justify-center space-x-1 p-2 rounded border transition-colors text-xs
                      ${isSelected
                        ? 'border-blue-400 bg-blue-950 text-blue-200'
                        : 'border-neutral-700 bg-neutral-800 text-neutral-300 hover:border-neutral-600'
                      }
                    `}
                  >
                    <Icon size={14} />
                    <span className="capitalize">{theme}</span>
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

      {/* Current Config */}
      <div className="bg-neutral-800 border border-neutral-700 rounded-lg p-3">
        <h4 className="text-sm font-medium text-neutral-100 mb-2">Current Config</h4>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div>
            <p className="text-neutral-400 font-medium">Theme</p>
            <p className="text-neutral-200 capitalize">{settings.theme}</p>
          </div>
          <div>
            <p className="text-neutral-400 font-medium">Font</p>
            <p className="text-neutral-200 capitalize">{settings.fontSize}</p>
          </div>
          <div>
            <p className="text-neutral-400 font-medium">Notifications</p>
            <p className="text-neutral-200">{settings.notifications ? 'On' : 'Off'}</p>
          </div>
          <div>
            <p className="text-neutral-400 font-medium">Auto Save</p>
            <p className="text-neutral-200">{settings.autoSave ? 'On' : 'Off'}</p>
          </div>
        </div>
      </div>

      {/* Autocomplete status */}
      <div className="flex items-center justify-between">
        <span className="text-sm text-neutral-300">Autocomplete</span>
        <Badge variant="outline" className="bg-neutral-700 text-neutral-300 border border-neutral-600">
          Disabled
        </Badge>
      </div>
    </div>
  );
}
