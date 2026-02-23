import { useMemo } from 'react';
import { useSSHStore, SessionFontSettings } from '@/store/sshStore';

const DEFAULT_FONT: SessionFontSettings = {
  fontSize: 14,
  fontWeight: '400',
  fontWeightBold: '700',
};

/**
 * Returns the font settings for the currently active session.
 */
export function useSessionFont() {
  const activeTabId = useSSHStore((s) => s.activeTabId);
  const sessionFonts = useSSHStore((s) => s.sessionFonts);

  const font: SessionFontSettings = useMemo(
    () => (activeTabId && sessionFonts[activeTabId]) || DEFAULT_FONT,
    [activeTabId, sessionFonts]
  );

  return font;
}
