/**
 * @module pages/sftp/hooks/useAutoSave
 *
 * Debounced auto-save. Calls `onSave` a fixed delay after the last change,
 * but only while `enabled` and `modified` are true. The save callback is held
 * in a ref so the debounce timer always invokes the latest closure without
 * re-arming on every render.
 */
import { useCallback, useEffect, useRef } from "react";

export interface UseAutoSaveOptions {
  /** Master switch — when false, no auto-save is scheduled. */
  enabled: boolean;
  /** Only save when there are unsaved changes. */
  modified: boolean;
  /** Debounce window in milliseconds after the last change. */
  delay?: number;
  /** The save action. May be async; rejections are swallowed by the caller. */
  onSave: () => void | Promise<void>;
}

export interface UseAutoSaveReturn {
  /** Call on every content change to (re)arm the debounce timer. */
  schedule: () => void;
  /** Cancel a pending auto-save (e.g. on a manual save or unmount). */
  cancel: () => void;
}

export function useAutoSave({
  enabled,
  modified,
  delay = 1500,
  onSave,
}: UseAutoSaveOptions): UseAutoSaveReturn {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Hold the latest values so the timer callback is never stale.
  const onSaveRef = useRef(onSave);
  onSaveRef.current = onSave;
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;
  const modifiedRef = useRef(modified);
  modifiedRef.current = modified;

  const cancel = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const schedule = useCallback(() => {
    cancel();
    if (!enabledRef.current) return;
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      if (enabledRef.current && modifiedRef.current) {
        void onSaveRef.current();
      }
    }, delay);
  }, [cancel, delay]);

  // Clear any pending timer on unmount.
  useEffect(() => cancel, [cancel]);

  return { schedule, cancel };
}
