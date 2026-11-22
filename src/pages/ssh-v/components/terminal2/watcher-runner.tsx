import { useEffect, useRef } from "react";
import { toast } from "@/hooks/use-toast";
import { useSSHStore } from "@/store/sshStore";
import { useWatcherStore, type WatchAlert } from "@/store/watcherStore";
import { openAlertTarget, startWatchers } from "./watcher-engine";

/** Short two-tone beep; no audio files needed. */
function beep(critical: boolean) {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const tones = critical ? [880, 660] : [660];
    tones.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      const t = ctx.currentTime + i * 0.18;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.15, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.17);
    });
    setTimeout(() => void ctx.close().catch(() => { }), 800);
  } catch { /* audio blocked */ }
}

/**
 * Drives the background watcher engine while mounted (mount once in the
 * terminal layout). Renders nothing; surfaces new alerts as toasts, browser
 * notifications (when allowed and the alert isn't for what you're looking
 * at) and an optional beep. Alerts arriving together are grouped.
 */
export default function WatcherRunner() {
  const batch = useRef<WatchAlert[]>([]);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const flush = () => {
      timer.current = null;
      const alerts = batch.current;
      batch.current = [];
      if (!alerts.length) return;

      const { settings } = useWatcherStore.getState();
      const ssh = useSSHStore.getState();
      const activeSessionId = ssh.tabs.find((t) => t.id === ssh.activeTabId)?.sessionId ?? ssh.activeTabId;
      const problems = alerts.filter((a) => !a.recovered);

      // In-app toast
      if (alerts.length > 2) {
        toast({
          title: `${alerts.length} new alerts`,
          description: alerts.slice(0, 3).map((a) => a.title).join(" · ") + (alerts.length > 3 ? " …" : ""),
          variant: problems.some((a) => a.severity === "critical") ? "destructive" : "default",
        });
      } else {
        for (const a of alerts) {
          toast({ title: a.title, description: a.detail.slice(0, 160), variant: a.severity === "critical" ? "destructive" : "default" });
        }
      }

      // Browser notifications for things you aren't looking at
      if (settings.notifications && typeof Notification !== "undefined" && Notification.permission === "granted") {
        const notify = alerts.filter((a) => document.hidden || a.sessionId !== activeSessionId);
        for (const a of notify.slice(0, 3)) {
          try {
            const n = new Notification(a.title, { body: a.detail.slice(0, 200), tag: `${a.ruleId}|${a.sessionId}|${a.key}` });
            n.onclick = () => {
              window.focus();
              openAlertTarget(a);
              n.close();
            };
          } catch { /* notifications unavailable */ }
        }
      }

      if (settings.sound && problems.length) beep(problems.some((a) => a.severity === "critical"));
    };

    const stop = startWatchers((alert) => {
      batch.current.push(alert);
      if (!timer.current) timer.current = setTimeout(flush, 400);
    });

    return () => {
      stop();
      if (timer.current) clearTimeout(timer.current);
      timer.current = null;
      batch.current = [];
    };
  }, []);

  return null;
}
