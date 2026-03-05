/**
 * useCollabTheme — resolves the xterm theme for the collab terminal.
 * Reads from the collab store (not SSHStore), so it's fully independent.
 */
import { useMemo } from 'react';
import { XtermTheme } from '@/pages/ssh-v/components/themes';
import { useCollabStore } from '../store';

export function useCollabTheme() {
  const themeName = useCollabStore((s) => s.themeName);
  const colors = useMemo(() => XtermTheme[themeName] || XtermTheme.custom, [themeName]);
  return { themeName, colors };
}
