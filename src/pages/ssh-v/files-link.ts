import { useSSHStore } from '@/store/sshStore';
import { useTerminalStore } from '@/store/terminalStore';
import { useSidebarState } from '@/store/sidebarStore';
import { useFilesNavStore } from '@/store/filesNavStore';
import { execOnce, sendToTerminal, shQuote } from './components/terminal2/widget-utils';

/**
 * Glue between an SSH tab's terminal and its Files (SFTP) view:
 * open a path from the terminal in Files, `cd` the terminal to a folder
 * from Files, and turn on folder tracking for shells that don't report it.
 */

function parentDir(path: string): string {
  const trimmed = path.replace(/\/+$/, '');
  const i = trimmed.lastIndexOf('/');
  return i <= 0 ? '/' : trimmed.slice(0, i);
}

/** Show `path` in the tab's Files view: a folder is listed, a file opens in the editor. */
export async function openPathInFiles(sessionId: string, path: string) {
  const socket = useSSHStore.getState().sessions[sessionId]?.socket;
  const q = shQuote(path);
  const kind = (await execOnce(socket, `if [ -d ${q} ]; then echo D; elif [ -e ${q} ]; then echo F; else echo N; fi`)).trim();
  const dir = kind === 'D' ? path : parentDir(path);
  const file = kind === 'F' ? path : undefined;

  // Also seeds the folder the Files view opens on if SFTP isn't connected yet.
  try { localStorage.setItem(`sftp_current_dir_${sessionId}`, dir); } catch { /* ignore */ }
  useFilesNavStore.getState().request(sessionId, dir, file);
  useSidebarState.getState().setView(sessionId, 'SFTP');
}

/**
 * Registers an OSC 7 prompt hook in the running bash/zsh so the terminal
 * learns its folder after every command. The leading space keeps it out of
 * history where HISTCONTROL=ignorespace.
 */
const TRACK_CWD_CMD =
  ` __tw_osc7(){ printf '\\033]7;file://%s%s\\007' "\${HOSTNAME:-localhost}" "$PWD"; }; ` +
  `if [ -n "$ZSH_VERSION" ]; then precmd_functions+=(__tw_osc7); ` +
  `else case ";$PROMPT_COMMAND;" in *";__tw_osc7;"*) ;; *) PROMPT_COMMAND="__tw_osc7\${PROMPT_COMMAND:+;$PROMPT_COMMAND}";; esac; fi; __tw_osc7`;

/**
 * Open the terminal's current folder in Files. If the shell doesn't report
 * its folder yet, turn tracking on first and wait briefly for the report.
 */
export async function openTerminalFolderInFiles(sessionId: string) {
  const known = useTerminalStore.getState().cwd[sessionId];
  if (known) return openPathInFiles(sessionId, known);

  const socket = useSSHStore.getState().sessions[sessionId]?.socket;
  sendToTerminal(socket, TRACK_CWD_CMD);
  const cwd = await new Promise<string | undefined>((resolve) => {
    const timer = setTimeout(() => { unsub(); resolve(undefined); }, 4000);
    const unsub = useTerminalStore.subscribe((s) => {
      const c = s.cwd[sessionId];
      if (c) { clearTimeout(timer); unsub(); resolve(c); }
    });
  });
  if (cwd) return openPathInFiles(sessionId, cwd);
  // Shell didn't cooperate (e.g. a program is running) — just open Files.
  useSidebarState.getState().setView(sessionId, 'SFTP');
}

/** `cd` the tab's terminal into `dir` and switch back to it. */
export function cdTerminalTo(sessionId: string, dir: string) {
  const socket = useSSHStore.getState().sessions[sessionId]?.socket;
  sendToTerminal(socket, ` cd ${shQuote(dir)}`);
  useSidebarState.getState().setView(sessionId, 'Terminal');
}

/**
 * Absolute paths in terminal output, e.g. `/etc/nginx/nginx.conf` or
 * `/var/log/app.log:42`. Requires a leading boundary so URLs don't match.
 */
export const TERMINAL_PATH_RE = /(?:^|[\s'"(=[,])(\/(?:[\w.@+~-]+\/)*[\w.@+~-]+\/?)(?::\d+)?/g;
