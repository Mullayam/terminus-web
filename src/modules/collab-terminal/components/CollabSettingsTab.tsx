/**
 * CollabSettingsTab — theme picker for the collaborative terminal.
 * Uses collabStore instead of SSHStore for full independence.
 */
import { Palette } from 'lucide-react';
import { XtermTheme, ThemeName, themeNames } from '@/pages/ssh-v/components/themes';
import { useCollabStore } from '../store';
import { useCollabTheme } from '../hooks';

export function CollabSettingsTab() {
  const setThemeName = useCollabStore((s) => s.setThemeName);
  const { themeName, colors } = useCollabTheme();

  const handleThemeChange = (theme: ThemeName) => {
    setThemeName(theme);
  };

  return (
    <div className="space-y-6 px-2 py-4" style={{ color: `${colors.foreground}dd` }}>
      <div>
        <h3 className="text-lg font-semibold" style={{ color: colors.foreground }}>Settings</h3>
        <p className="text-sm" style={{ color: `${colors.foreground}80` }}>Customize your collab terminal</p>
      </div>

      {/* Appearance */}
      <div
        className="rounded-lg p-4 border"
        style={{ backgroundColor: `${colors.background}dd`, borderColor: `${colors.foreground}20` }}
      >
        <div className="flex items-center space-x-2 mb-4">
          <Palette size={16} className="text-purple-400" />
          <h4 className="font-medium text-sm" style={{ color: colors.foreground }}>Theme</h4>
        </div>

        <div className="grid grid-cols-2 gap-2 max-h-72 overflow-y-auto pr-1">
          {themeNames.map((theme) => {
            const themeColors = XtermTheme[theme];
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
                <div
                  className="flex gap-px shrink-0 rounded overflow-hidden border border-neutral-600"
                  style={{ backgroundColor: themeColors.background }}
                >
                  <span className="block w-3 h-3" style={{ backgroundColor: themeColors?.red }} />
                  <span className="block w-3 h-3" style={{ backgroundColor: themeColors?.green }} />
                  <span className="block w-3 h-3" style={{ backgroundColor: themeColors?.yellow }} />
                  <span className="block w-3 h-3" style={{ backgroundColor: themeColors?.blue }} />
                </div>
                <span className="capitalize truncate">{theme}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
