import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * Background watchers: rules (persisted), notification settings (persisted)
 * and the alert history (memory only, newest first, capped).
 * The engine lives in terminal2/watcher-engine.ts.
 */

export type RuleType =
  | 'service-failed'
  | 'container-exited'
  | 'disk-usage'
  | 'high-load'
  | 'memory'
  | 'log-pattern'
  | 'command-finished';

export type Severity = 'critical' | 'warning' | 'info';

export interface WatchRule {
  id: string;
  type: RuleType;
  name: string;
  enabled: boolean;
  /** `user@host`, or null for every host. */
  scope: string | null;
  /** Polling interval (polling types only). */
  intervalSec: number;
  /** disk: used % · high-load: load1 per CPU · memory: available %. */
  threshold?: number;
  /** high-load: consecutive bad checks before alerting. */
  consecutive?: number;
  /** log-pattern */
  source?: 'file' | 'journal';
  target?: string;
  pattern?: string;
  cooldownSec?: number;
  /** command-finished: only commands that ran at least this long. */
  minSeconds?: number;
  /** Raise an info alert when the problem clears (polling types). */
  notifyRecovery: boolean;
}

export interface WatchAlert {
  id: string;
  ruleId: string;
  ruleType: RuleType;
  sessionId: string;
  hostKey: string;
  title: string;
  detail: string;
  severity: Severity;
  at: number;
  read: boolean;
  /** Dedupe key within rule+session (unit name, mount, …). */
  key: string;
  /** Panel to open for this alert ('docker' opens the Docker widget). */
  panel?: string;
  recovered?: boolean;
}

export interface WatcherSettings {
  notifications: boolean;
  sound: boolean;
}

export const RULE_TYPE_LABEL: Record<RuleType, string> = {
  'service-failed': 'Service failed',
  'container-exited': 'Container crashed',
  'disk-usage': 'Disk almost full',
  'high-load': 'High CPU load',
  memory: 'Low memory',
  'log-pattern': 'Log pattern',
  'command-finished': 'Long command finished',
};

/** Defaults applied when a rule of that type is created. */
export const RULE_DEFAULTS: Record<RuleType, Partial<WatchRule>> = {
  'service-failed': { intervalSec: 60, notifyRecovery: true },
  'container-exited': { intervalSec: 30, notifyRecovery: true },
  'disk-usage': { intervalSec: 300, threshold: 90, notifyRecovery: true },
  'high-load': { intervalSec: 60, threshold: 1.5, consecutive: 3, notifyRecovery: true },
  memory: { intervalSec: 60, threshold: 10, notifyRecovery: true },
  'log-pattern': { intervalSec: 0, source: 'file', target: '/var/log/syslog', pattern: 'error|fatal|panic|out of memory', cooldownSec: 60, notifyRecovery: false },
  'command-finished': { intervalSec: 0, minSeconds: 30, notifyRecovery: false },
};

const MAX_ALERTS = 200;

export function newRuleId(): string {
  return `rule-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function seedRules(): WatchRule[] {
  const make = (type: RuleType, enabled: boolean, extra: Partial<WatchRule> = {}): WatchRule => ({
    id: `default-${type}`,
    type,
    name: RULE_TYPE_LABEL[type],
    enabled,
    scope: null,
    intervalSec: 60,
    notifyRecovery: false,
    ...RULE_DEFAULTS[type],
    ...extra,
  });
  return [
    make('service-failed', true),
    make('container-exited', true),
    make('disk-usage', true),
    make('memory', true),
    make('high-load', false),
    make('log-pattern', false, { name: 'Errors in syslog' }),
    make('command-finished', true),
  ];
}

interface WatcherState {
  rules: WatchRule[];
  settings: WatcherSettings;
  alerts: WatchAlert[];

  addRule: (rule: WatchRule) => void;
  updateRule: (id: string, patch: Partial<WatchRule>) => void;
  removeRule: (id: string) => void;
  setSettings: (patch: Partial<WatcherSettings>) => void;

  pushAlert: (alert: Omit<WatchAlert, 'id' | 'read' | 'at'> & { at?: number }) => WatchAlert;
  markRead: (id: string) => void;
  markAllRead: (sessionId?: string) => void;
  dismiss: (id: string) => void;
  clearAlerts: () => void;
}

export const useWatcherStore = create<WatcherState>()(
  persist(
    (set) => ({
      rules: seedRules(),
      settings: { notifications: false, sound: false },
      alerts: [],

      addRule: (rule) => set((s) => ({ rules: [...s.rules, rule] })),
      updateRule: (id, patch) =>
        set((s) => ({ rules: s.rules.map((r) => (r.id === id ? { ...r, ...patch } : r)) })),
      removeRule: (id) => set((s) => ({ rules: s.rules.filter((r) => r.id !== id) })),
      setSettings: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),

      pushAlert: (a) => {
        const alert: WatchAlert = {
          ...a,
          id: `al-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
          at: a.at ?? Date.now(),
          read: false,
        };
        set((s) => ({ alerts: [alert, ...s.alerts].slice(0, MAX_ALERTS) }));
        return alert;
      },
      markRead: (id) =>
        set((s) => ({ alerts: s.alerts.map((a) => (a.id === id && !a.read ? { ...a, read: true } : a)) })),
      markAllRead: (sessionId) =>
        set((s) => ({
          alerts: s.alerts.map((a) => (!a.read && (!sessionId || a.sessionId === sessionId) ? { ...a, read: true } : a)),
        })),
      dismiss: (id) => set((s) => ({ alerts: s.alerts.filter((a) => a.id !== id) })),
      clearAlerts: () => set({ alerts: [] }),
    }),
    {
      name: 'terminus-watchers',
      partialize: (s) => ({ rules: s.rules, settings: s.settings }),
    },
  ),
);

/**
 * Unread alert count — overall, or for one SSH session (tab badge).
 * Recovered (info) alerts don't count toward the badge.
 */
export function useUnreadAlerts(sessionId?: string): number {
  return useWatcherStore((s) => {
    let n = 0;
    for (const a of s.alerts) {
      if (!a.read && !a.recovered && (!sessionId || a.sessionId === sessionId)) n++;
    }
    return n;
  });
}
