/**
 * Debounced toast hook — shows a toast once, then suppresses
 * repeated calls for `delay` ms (default 3000).
 */
import { useRef, useCallback } from 'react';
import { toast } from '@/hooks/use-toast';

export function useDebouncedToast(delay = 3000) {
  const lastFired = useRef<Record<string, number>>({});

  return useCallback(
    (key: string, opts: Parameters<typeof toast>[0]) => {
      const now = Date.now();
      if (lastFired.current[key] && now - lastFired.current[key] < delay) {
        return; // suppress
      }
      lastFired.current[key] = now;
      toast(opts);
    },
    [delay]
  );
}
