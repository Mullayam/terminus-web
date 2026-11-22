import { shQuote } from "./widget-utils";

/* Commands + parsers for the disk usage explorer (non-component helpers). */

/** Prefix that bounds slow scans; empty when `timeout` isn't installed. */
const TIMEOUT = "T=$(command -v timeout >/dev/null 2>&1 && echo 'timeout 60'); ";

/** Byte-exact df when supported (GNU), else POSIX kilobytes; inodes separately. */
export const MOUNTS_CMD =
  "echo __DFB__; df -PTB1 -x tmpfs -x devtmpfs -x squashfs -x overlay 2>/dev/null || { echo __DFK__; df -Pk 2>/dev/null; }; " +
  "echo __DFI__; df -Pi 2>/dev/null";

/** Fail fast (instead of hanging on a password prompt) when sudo isn't passwordless. */
const SUDO_GATE = "if ! sudo -n true 2>/dev/null; then echo __NOSUDO__; exit 0; fi; ";

/** Immediate sub-folders of `path` by size (largest first); `__RC__` carries du's exit code. */
export function duCmd(path: string, sudo: boolean): string {
  const q = shQuote(path);
  const run = sudo ? "sudo -n $T du" : "$T du";
  return (sudo ? SUDO_GATE : "") + TIMEOUT +
    `out=$(${run} -x -B1 -d1 ${q} 2>/dev/null); rc=$?; ` +
    `printf '%s\\n' "$out" | sort -nr | head -60; echo "__RC__$rc"`;
}

/** Files over 20 MB under `path` on the same filesystem. */
export function bigFilesCmd(path: string, sudo: boolean): string {
  const q = shQuote(path);
  const run = sudo ? "sudo -n $T find" : "$T find";
  return (sudo ? SUDO_GATE : "") + TIMEOUT +
    `out=$(${run} ${q} -xdev -type f -size +20M -printf '%s\\t%TY-%Tm-%Td\\t%p\\n' 2>/dev/null); rc=$?; ` +
    `printf '%s\\n' "$out" | sort -nr | head -40; echo "__RC__$rc"`;
}

export function deleteCmd(path: string, isDir: boolean): string {
  return `rm ${isDir ? "-rf" : "-f"} -- ${shQuote(path)} 2>&1; echo "__RC__$?"`;
}

/** Cheap probes for the usual space hogs; one marker per section. */
export const CLEANUP_CMD = [
  "echo __APT__; [ -d /var/cache/apt/archives ] && du -sB1 /var/cache/apt/archives 2>/dev/null | cut -f1",
  "echo __JOURNAL__; command -v journalctl >/dev/null 2>&1 && journalctl --disk-usage 2>&1",
  "echo __ROTATED__; find /var/log -type f '(' -name '*.gz' -o -name '*.[0-9]' ')' -printf '%s\\n' 2>/dev/null | awk '{s+=$1} END {print s+0}'",
  "echo __DOCKER__; command -v docker >/dev/null 2>&1 && { command -v timeout >/dev/null 2>&1 && timeout 20 docker system df 2>&1 || docker system df 2>&1; }",
  "echo __CACHE__; [ -d \"$HOME/.cache\" ] && du -sB1 \"$HOME/.cache\" 2>/dev/null | cut -f1",
  "echo __SNAP__; command -v snap >/dev/null 2>&1 && snap list --all 2>/dev/null | awk '/disabled/ {print $1, $3}'",
  "echo __END__",
].join("; ");

/** Cleanup actions — always run in the visible terminal, never silently. */
export const CLEANUP_ACTIONS = {
  apt: "sudo apt-get clean",
  journal: "sudo journalctl --vacuum-size=200M",
  rotated: "sudo find /var/log -type f '(' -name '*.gz' -o -name '*.[0-9]' ')' -delete",
  docker: "docker system prune",
  cache: "rm -rf ~/.cache/*",
} as const;
export type CleanupKey = keyof typeof CLEANUP_ACTIONS;

/* ── Parsing ─────────────────────────────────────────────── */

function sections(output: string): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  let cur = "";
  for (const raw of output.split("\n")) {
    const line = raw.replace(/\r/g, "");
    const m = line.match(/^__([A-Z]+)__$/);
    if (m) { cur = m[1]; out[cur] = []; continue; }
    if (cur) (out[cur] ||= []).push(line);
  }
  return out;
}

/** `__RC__<n>` trailer → { body, rc }. */
export function splitRc(output: string): { body: string; rc: number | null } {
  const m = output.match(/__RC__(\d+)\s*$/);
  return {
    body: m ? output.slice(0, m.index).trimEnd() : output.trimEnd(),
    rc: m ? Number(m[1]) : null,
  };
}

export interface Mount {
  fs: string;
  type: string;
  size: number;
  used: number;
  free: number;
  pct: number;
  mount: string;
  inodePct: number | null;
}

const PSEUDO_FS = /^(tmpfs|devtmpfs|udev|overlay|squashfs|none|shm|run)$/;

export function parseMounts(output: string): Mount[] {
  const sec = sections(output);
  const inodes = new Map<string, number>();
  for (const l of (sec.DFI ?? []).slice(1)) {
    const p = l.trim().split(/\s+/);
    if (p.length < 6) continue;
    const pct = parseInt(p[4], 10);
    if (!Number.isNaN(pct)) inodes.set(p.slice(5).join(" "), pct);
  }

  const mounts: Mount[] = [];
  const byteLines = (sec.DFB ?? []).filter((l) => l.trim());
  const kLines = (sec.DFK ?? []).filter((l) => l.trim());
  if (kLines.length > 1) {
    // POSIX: Filesystem 1024-blocks Used Available Capacity Mounted-on
    for (const l of kLines.slice(1)) {
      const p = l.trim().split(/\s+/);
      if (p.length < 6 || PSEUDO_FS.test(p[0])) continue;
      const mount = p.slice(5).join(" ");
      mounts.push({
        fs: p[0], type: "", size: Number(p[1]) * 1024, used: Number(p[2]) * 1024, free: Number(p[3]) * 1024,
        pct: parseInt(p[4], 10) || 0, mount, inodePct: inodes.get(mount) ?? null,
      });
    }
  } else {
    // GNU -T: Filesystem Type 1-blocks Used Available Capacity Mounted-on
    for (const l of byteLines.slice(1)) {
      const p = l.trim().split(/\s+/);
      if (p.length < 7 || PSEUDO_FS.test(p[1])) continue;
      const mount = p.slice(6).join(" ");
      mounts.push({
        fs: p[0], type: p[1], size: Number(p[2]), used: Number(p[3]), free: Number(p[4]),
        pct: parseInt(p[5], 10) || 0, mount, inodePct: inodes.get(mount) ?? null,
      });
    }
  }
  return mounts.filter((m) => m.size > 0).sort((a, b) => a.mount.localeCompare(b.mount));
}

export interface DuEntry { path: string; size: number }

export interface DuResult {
  /** Size of the folder itself (du's own line), null if it never got there. */
  total: number | null;
  children: DuEntry[];
  /** Hit the 60s limit — sizes are partial. */
  timedOut: boolean;
  /** Some sub-folders couldn't be read. */
  partial: boolean;
  noSudo: boolean;
}

/** Strip trailing slashes ("/" stays "/"). */
export function normPath(p: string): string {
  const t = p.replace(/\/+$/, "");
  return t || "/";
}

export function parseDu(output: string, path: string): DuResult {
  if (output.includes("__NOSUDO__")) return { total: null, children: [], timedOut: false, partial: false, noSudo: true };
  const { body, rc } = splitRc(output);
  const self = normPath(path);
  let total: number | null = null;
  const children: DuEntry[] = [];
  for (const l of body.split("\n")) {
    const i = l.indexOf("\t");
    if (i < 0) continue;
    const size = Number(l.slice(0, i));
    const p = normPath(l.slice(i + 1));
    if (Number.isNaN(size)) continue;
    if (p === self) total = size;
    else children.push({ path: p, size });
  }
  return { total, children, timedOut: rc === 124, partial: rc === 1, noSudo: false };
}

export interface BigFile { path: string; size: number; date: string }

export function parseBigFiles(output: string): { files: BigFile[]; timedOut: boolean; noSudo: boolean } {
  if (output.includes("__NOSUDO__")) return { files: [], timedOut: false, noSudo: true };
  const { body, rc } = splitRc(output);
  const files: BigFile[] = [];
  for (const l of body.split("\n")) {
    const p = l.split("\t");
    if (p.length < 3) continue;
    const size = Number(p[0]);
    if (Number.isNaN(size)) continue;
    files.push({ size, date: p[1], path: p.slice(2).join("\t") });
  }
  return { files, timedOut: rc === 124, noSudo: false };
}

export interface CleanupInfo {
  apt: number | null;
  journal: string | null;
  rotated: number | null;
  docker: { type: string; size: string; reclaimable: string }[] | null;
  cache: number | null;
  snap: string[] | null;
}

function num(lines: string[] | undefined): number | null {
  const v = (lines ?? []).map((l) => l.trim()).find(Boolean);
  if (!v) return null;
  const n = Number(v);
  return Number.isNaN(n) ? null : n;
}

export function parseCleanup(output: string): CleanupInfo {
  const sec = sections(output);
  const journalText = (sec.JOURNAL ?? []).join(" ");
  const journal = journalText.match(/take up ([\d.]+\s*[KMGTP]?i?B?)/i)?.[1] ?? null;

  let docker: CleanupInfo["docker"] = null;
  if (sec.DOCKER && sec.DOCKER.some((l) => /^TYPE\s/.test(l))) {
    docker = [];
    for (const l of sec.DOCKER) {
      const m = l.match(/^(Images|Containers|Local Volumes|Build Cache)\s+\d+\s+\d+\s+(\S+)\s+(.+)$/);
      if (m) docker.push({ type: m[1], size: m[2], reclaimable: m[3].trim() });
    }
  }

  const snapLines = (sec.SNAP ?? []).map((l) => l.trim()).filter(Boolean);
  return {
    apt: num(sec.APT),
    journal,
    rotated: num(sec.ROTATED),
    docker,
    cache: num(sec.CACHE),
    snap: sec.SNAP ? snapLines : null,
  };
}

/* ── Safety ──────────────────────────────────────────────── */

const CRITICAL = new Set(["/", "/bin", "/boot", "/dev", "/etc", "/proc", "/root", "/sbin", "/sys", "/usr", "/var", "/home", "/run", "/srv", "/opt", "/snap", "/lost+found"]);

/** System folders and mount points can't be deleted from the panel. */
export function isProtected(path: string, mountPoints: string[]): boolean {
  const p = normPath(path);
  if (CRITICAL.has(p)) return true;
  if (/^\/lib(32|64|x32)?$/.test(p)) return true;
  if (/^\/usr\/[^/]+$/.test(p) || /^\/var\/(lib|log|cache|spool|run|tmp)$/.test(p)) return true;
  return mountPoints.some((m) => normPath(m) === p);
}

/* ── Formatting ──────────────────────────────────────────── */

export function fmtBytes(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  const units = ["B", "K", "M", "G", "T", "P"];
  let v = n;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i++; }
  return `${v >= 100 || i === 0 ? Math.round(v) : v.toFixed(1)}${units[i]}`;
}

export function parentOf(path: string): string {
  const p = normPath(path);
  if (p === "/") return "/";
  const i = p.lastIndexOf("/");
  return i <= 0 ? "/" : p.slice(0, i);
}

export function baseName(path: string): string {
  const p = normPath(path);
  return p === "/" ? "/" : p.slice(p.lastIndexOf("/") + 1);
}

/** "/" → ["/"], "/var/log" → ["/", "/var", "/var/log"]. */
export function crumbs(path: string): string[] {
  const p = normPath(path);
  if (p === "/") return ["/"];
  const parts = p.split("/").filter(Boolean);
  return ["/", ...parts.map((_, i) => "/" + parts.slice(0, i + 1).join("/"))];
}
