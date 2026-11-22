import { v4 as uuid } from 'uuid';
import { idb } from '@/lib/idb';
import { useSSHStore } from '@/store/sshStore';
import { useSidebarState } from '@/store/sidebarStore';
import { useTerminalStore } from '@/store/terminalStore';
import { usePanelStore } from '@/store/panelStore';
import { useDockerStore } from '@/store/dockerStore';
import { useComposeStore } from '@/store/composeStore';
import { useKubernetesStore } from '@/store/kubernetesStore';
import { useMonitorStore } from '@/store/monitorStore';
import { useWorkspaceStore, type Workspace, type WorkspaceTab } from '@/store/workspaceStore';
import { connectPayloads } from './connect-payloads';
import { setPendingConnect } from './pending-connects';
import type { FormValues } from './TerminalTab';

/** Snapshot of the open SSH tabs and panels, without any credentials. */
export function captureWorkspace(name: string, id: string = uuid()): Workspace {
  const ssh = useSSHStore.getState();
  const side = useSidebarState.getState();
  const cwd = useTerminalStore.getState().cwd;

  const tabs: WorkspaceTab[] = ssh.tabs.flatMap((t) => {
    const s = ssh.sessions[t.sessionId];
    if (!s?.host) return [];
    return [{
      title: t.title,
      host: s.host,
      username: s.username,
      port: connectPayloads.get(t.sessionId)?.port,
      cwd: cwd[t.sessionId],
      filesOpen: !!side.filesTabs[t.sessionId],
      view: side.views[t.sessionId] ?? 'Terminal',
    }];
  });

  const open = usePanelStore.getState().open;
  const now = Date.now();
  const existing = useWorkspaceStore.getState().workspaces.find((w) => w.id === id);
  return {
    id,
    name,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    tabs,
    activeIndex: Math.max(0, ssh.tabs.findIndex((t) => t.id === ssh.activeTabId)),
    panels: Object.keys(open).filter((k) => open[k]),
    builtins: {
      docker: useDockerStore.getState().isOpen,
      compose: useComposeStore.getState().isOpen,
      kubernetes: useKubernetesStore.getState().isOpen,
      monitor: useMonitorStore.getState().isOpen,
    },
  };
}

interface SavedHost extends Partial<FormValues> { host: string; username: string; port?: number }

function uniqueTitle(base: string, taken: Set<string>): string {
  if (!taken.has(base)) return base;
  let n = 1;
  while (taken.has(`${base}(${n})`)) n += 1;
  return `${base}(${n})`;
}

export interface RestoreResult {
  opened: number;
  /** Tabs with no saved login — they open with the connect form filled in. */
  needLogin: string[];
}

/**
 * Open every tab of a workspace (added next to the current tabs). Tabs whose
 * host has a saved login — or was connected earlier in this browser session —
 * connect on their own; the others open with the form pre-filled. Each tab
 * connects when it is first shown, since only the visible tab is mounted.
 */
export async function restoreWorkspace(ws: Workspace): Promise<RestoreResult> {
  let saved: SavedHost[] = [];
  try { saved = ((await idb.getAllItems('hosts')) as unknown as SavedHost[]) ?? []; } catch { /* no saved hosts */ }

  const ssh = useSSHStore.getState();
  const side = useSidebarState.getState();
  const taken = new Set(ssh.tabs.map((t) => t.title));
  const ids: string[] = [];
  const needLogin: string[] = [];

  for (const t of ws.tabs) {
    const id = uuid();
    const samePort = (p?: number) => !t.port || (p ?? 22) === t.port;
    const login =
      saved.find((h) => h.host === t.host && h.username === t.username && samePort(h.port)) ??
      [...connectPayloads.values()].find((p) => p.host === t.host && p.username === t.username && samePort(p.port));

    const title = uniqueTitle(t.title || t.host, taken);
    taken.add(title);
    ssh.addSession({ sessionId: id, host: t.host, username: t.username, status: 'connecting', sftp_enabled: false });
    ssh.addTab({ id, title, sessionId: id });

    if (login) {
      setPendingConnect(id, { creds: { ...(login as FormValues), saveCredentials: false }, cwd: t.cwd });
    } else {
      needLogin.push(`${t.username}@${t.host}`);
      setPendingConnect(id, {
        prefill: { host: t.host, username: t.username, port: t.port ?? 22, authMethod: 'password' },
        cwd: t.cwd,
      });
    }

    if (t.filesOpen) {
      side.setView(id, 'SFTP');
      if (t.view === 'Terminal') side.setView(id, 'Terminal');
    }
    ids.push(id);
  }

  if (ids.length) ssh.setActiveTab(ids[Math.min(ws.activeIndex, ids.length - 1)]);

  const panels = usePanelStore.getState();
  ws.panels.forEach((p) => panels.openPanel(p));
  if (ws.builtins.docker) useDockerStore.getState().open();
  if (ws.builtins.compose) useComposeStore.getState().open();
  if (ws.builtins.kubernetes) useKubernetesStore.getState().open();
  if (ws.builtins.monitor) useMonitorStore.getState().open();

  return { opened: ids.length, needLogin };
}
