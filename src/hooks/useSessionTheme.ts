import { useMemo } from 'react';
import { useSSHStore } from '@/store/sshStore';
import { XtermTheme, ThemeName } from '@/pages/ssh-v/components/themes';

/**
 * Returns the resolved xterm theme for the currently active session.
 * Falls back to 'default' if no session is active or no theme is set.
 */
export function useSessionTheme() {
  const activeTabId = useSSHStore((s) => s.activeTabId);
  const sessionThemes = useSSHStore((s) => s.sessionThemes);

  const themeName: ThemeName = (activeTabId && sessionThemes[activeTabId]) || 'default';
  const colors = useMemo(() => XtermTheme[themeName] || XtermTheme.default, [themeName]);

  return { themeName, colors };
}
