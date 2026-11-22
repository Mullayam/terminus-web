/* Package updates: detection/list script, parsers and action commands (no React). */
import { shScript } from "./health-utils";
import { shQuote } from "./widget-utils";

export type Manager = "apt-get" | "dnf" | "yum" | "zypper" | "apk" | "pacman";
export type Priv = "root" | "sudo" | "none";

export const MANAGER_LABEL: Record<Manager, string> = {
  "apt-get": "apt", dnf: "dnf", yum: "yum", zypper: "zypper", apk: "apk", pacman: "pacman",
};

/** Detect the manager and list upgradable packages in one round-trip. */
const LIST_SCRIPT = String.raw`
PATH="$PATH:/usr/sbin:/sbin"
S(){ printf '\n__%s__\n' "$1"; }
S PRIV
if [ "$(id -u)" = 0 ]; then echo root; elif command -v sudo >/dev/null 2>&1 && sudo -n true 2>/dev/null; then echo sudo; else echo none; fi
m=""
for c in apt-get dnf yum zypper apk pacman; do if command -v "$c" >/dev/null 2>&1; then m="$c"; break; fi; done
S MGR
echo "$m"
S UU
if command -v unattended-upgrade >/dev/null 2>&1; then echo yes; else echo no; fi
S REBOOT
if [ -f /var/run/reboot-required ]; then echo yes; cat /var/run/reboot-required.pkgs 2>/dev/null | head -20; else echo no; fi
S LASTUPDATE
case "$m" in
  apt-get) stat -c %Y /var/lib/apt/periodic/update-success-stamp 2>/dev/null || stat -c %Y /var/cache/apt/pkgcache.bin 2>/dev/null ;;
  dnf|yum) stat -c %Y /var/cache/dnf/last_makecache 2>/dev/null || stat -c %Y /var/cache/yum 2>/dev/null ;;
  pacman) stat -c %Y /var/lib/pacman/sync 2>/dev/null ;;
  apk) stat -c %Y /var/cache/apk 2>/dev/null ;;
esac
S LIST
case "$m" in
  apt-get) apt list --upgradable 2>/dev/null | grep -v '^Listing' ;;
  dnf) dnf -q check-update 2>/dev/null ;;
  yum) yum -q check-update 2>/dev/null ;;
  zypper) zypper -q --non-interactive lu 2>/dev/null ;;
  apk) apk version -l '<' 2>/dev/null ;;
  pacman) if command -v checkupdates >/dev/null 2>&1; then checkupdates 2>/dev/null; else pacman -Qu 2>/dev/null; fi ;;
esac
S SECURITY
case "$m" in
  dnf) dnf -q updateinfo list --security 2>/dev/null | awk '{print $3}' ;;
  yum) yum -q updateinfo list security 2>/dev/null | awk '{print $3}' ;;
esac
S END
`;

export const LIST_CMD = shScript(LIST_SCRIPT);

export interface Pkg {
  name: string;
  current: string;
  next: string;
  arch: string;
  repo: string;
  security: boolean;
}

export interface UpdatesInfo {
  priv: Priv;
  manager: Manager | null;
  hasUnattended: boolean;
  reboot: { required: boolean; pkgs: string[] };
  lastUpdate: number | null; // epoch seconds
  pkgs: Pkg[];
}

function sections(output: string): Record<string, string[]> {
  const b: Record<string, string[]> = {};
  let sec = "";
  for (const raw of output.split("\n")) {
    const line = raw.replace(/\r/g, "");
    const m = line.match(/^__([A-Z]+)__$/);
    if (m) { sec = m[1]; b[sec] = []; continue; }
    if (sec && line.trim()) b[sec].push(line);
  }
  return b;
}

const MANAGERS: Manager[] = ["apt-get", "dnf", "yum", "zypper", "apk", "pacman"];

/** `openssl/jammy-updates,jammy-security 3.0.2-0ubuntu1.15 amd64 [upgradable from: 3.0.2-0ubuntu1.14]` */
function parseApt(lines: string[]): Pkg[] {
  const out: Pkg[] = [];
  for (const l of lines) {
    const m = l.match(/^([^/\s]+)\/(\S+)\s+(\S+)\s+(\S+)(?:\s+\[upgradable from:\s*([^\]]+)\])?/);
    if (!m) continue;
    out.push({ name: m[1], repo: m[2], next: m[3], arch: m[4], current: m[5]?.trim() ?? "", security: /-security\b/.test(m[2]) });
  }
  return out;
}

/** dnf/yum check-update: `name.arch  version  repo`; long names wrap onto the next line. */
function parseRpm(lines: string[], security: string[]): Pkg[] {
  const out: Pkg[] = [];
  const joined: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const t = lines[i].trim().split(/\s+/);
    if (t.length === 1 && i + 1 < lines.length) { joined.push(`${t[0]} ${lines[++i].trim()}`); continue; }
    joined.push(lines[i].trim());
  }
  for (const l of joined) {
    if (/^(Obsoleting|Security:|Last metadata)/i.test(l)) break;
    const t = l.split(/\s+/);
    if (t.length !== 3 || !t[0].includes(".")) continue;
    const dot = t[0].lastIndexOf(".");
    const name = t[0].slice(0, dot);
    const arch = t[0].slice(dot + 1);
    // updateinfo prints NEVRAs like `openssl-libs-1:3.0.7-25.el9.x86_64`.
    const sec = security.some((n) => n.startsWith(`${name}-`) && /^\d|^\d+:/.test(n.slice(name.length + 1)));
    out.push({ name, arch, next: t[1], repo: t[2], current: "", security: sec });
  }
  return out;
}

/** `v | repo | name | current | available | arch` */
function parseZypper(lines: string[]): Pkg[] {
  const out: Pkg[] = [];
  for (const l of lines) {
    const c = l.split("|").map((x) => x.trim());
    if (c.length < 6 || c[0] !== "v") continue;
    out.push({ repo: c[1], name: c[2], current: c[3], next: c[4], arch: c[5], security: false });
  }
  return out;
}

/** `busybox-1.36.1-r5 < 1.36.1-r6` */
function parseApk(lines: string[]): Pkg[] {
  const out: Pkg[] = [];
  for (const l of lines) {
    const m = l.trim().match(/^(.+?)-(\d\S*)\s+<\s+(\S+)/);
    if (m) out.push({ name: m[1], current: m[2], next: m[3], arch: "", repo: "", security: false });
  }
  return out;
}

/** `name old -> new` */
function parsePacman(lines: string[]): Pkg[] {
  const out: Pkg[] = [];
  for (const l of lines) {
    const m = l.trim().match(/^(\S+)\s+(\S+)\s+->\s+(\S+)/);
    if (m) out.push({ name: m[1], current: m[2], next: m[3], arch: "", repo: "", security: false });
  }
  return out;
}

export function parseUpdates(output: string): UpdatesInfo {
  const b = sections(output);
  const privRaw = b.PRIV?.[0]?.trim();
  const mgrRaw = b.MGR?.[0]?.trim() as Manager | undefined;
  const manager = mgrRaw && MANAGERS.includes(mgrRaw) ? mgrRaw : null;
  const list = b.LIST ?? [];
  const security = (b.SECURITY ?? []).map((l) => l.trim()).filter(Boolean);
  let pkgs: Pkg[] = [];
  if (manager === "apt-get") pkgs = parseApt(list);
  else if (manager === "dnf" || manager === "yum") pkgs = parseRpm(list, security);
  else if (manager === "zypper") pkgs = parseZypper(list);
  else if (manager === "apk") pkgs = parseApk(list);
  else if (manager === "pacman") pkgs = parsePacman(list);
  pkgs.sort((a, b2) => Number(b2.security) - Number(a.security) || a.name.localeCompare(b2.name));

  const reboot = b.REBOOT ?? [];
  const last = Number(b.LASTUPDATE?.[0]?.trim());
  return {
    priv: privRaw === "root" || privRaw === "sudo" ? privRaw : "none",
    manager,
    hasUnattended: b.UU?.[0]?.trim() === "yes",
    reboot: { required: reboot[0]?.trim() === "yes", pkgs: reboot.slice(1).map((l) => l.trim()) },
    lastUpdate: Number.isFinite(last) && last > 0 ? last : null,
    pkgs,
  };
}

/* ── Actions ─────────────────────────────────────────────────── */

export type UpdateAction = "refresh" | "all" | "security" | "selected";

export const ACTION_LABEL: Record<UpdateAction, string> = {
  refresh: "Refresh package lists",
  all: "Upgrade all",
  security: "Install security updates",
  selected: "Upgrade selected",
};

/** Which actions a manager supports. */
export function supports(manager: Manager, action: UpdateAction, info: UpdatesInfo): boolean {
  if (action === "security") {
    if (manager === "apt-get") return info.hasUnattended || info.pkgs.some((p) => p.security);
    return manager === "dnf" || manager === "yum" || manager === "zypper";
  }
  // Partial upgrades are unsupported on Arch.
  if (action === "selected") return manager !== "pacman";
  return true;
}

export interface BuiltCommand {
  /** What the user sees in the confirm bar. */
  display: string;
  /** Streamed live on a side channel (non-interactive, needs root or passwordless sudo). */
  live: string | null;
  /** Typed into the terminal (interactive, sudo may prompt). */
  terminal: string;
}

/**
 * `mode` decides the privilege prefix: root runs bare, passwordless sudo uses
 * `sudo -n` for the live run, everything else goes to the terminal with `sudo`.
 */
export function buildCommand(manager: Manager, action: UpdateAction, info: UpdatesInfo, selected: string[]): BuiltCommand {
  const names = (list: string[]) => list.map(shQuote).join(" ");
  const secNames = info.pkgs.filter((p) => p.security).map((p) => p.name);

  // [non-interactive form, interactive form]
  let pair: [string, string];
  switch (manager) {
    case "apt-get": {
      const ni = "env DEBIAN_FRONTEND=noninteractive apt-get -y -o Dpkg::Options::=--force-confdef -o Dpkg::Options::=--force-confold";
      if (action === "refresh") pair = ["apt-get update", "apt-get update"];
      else if (action === "all") pair = [`${ni} upgrade`, "apt-get upgrade"];
      else if (action === "security") pair = info.hasUnattended
        ? ["unattended-upgrade -v", "unattended-upgrade -v"]
        : [`${ni} install --only-upgrade ${names(secNames)}`, `apt-get install --only-upgrade ${names(secNames)}`];
      else pair = [`${ni} install --only-upgrade ${names(selected)}`, `apt-get install --only-upgrade ${names(selected)}`];
      break;
    }
    case "dnf":
    case "yum": {
      const m = manager;
      if (action === "refresh") pair = [`${m} -y makecache`, `${m} makecache`];
      else if (action === "all") pair = [`${m} -y upgrade`, `${m} upgrade`];
      else if (action === "security") pair = [`${m} -y upgrade --security`, `${m} upgrade --security`];
      else pair = [`${m} -y upgrade ${names(selected)}`, `${m} upgrade ${names(selected)}`];
      break;
    }
    case "zypper": {
      if (action === "refresh") pair = ["zypper --non-interactive refresh", "zypper refresh"];
      else if (action === "all") pair = ["zypper --non-interactive update", "zypper update"];
      else if (action === "security") pair = ["zypper --non-interactive patch --category security", "zypper patch --category security"];
      else pair = [`zypper --non-interactive update ${names(selected)}`, `zypper update ${names(selected)}`];
      break;
    }
    case "apk": {
      if (action === "refresh") pair = ["apk update", "apk update"];
      else if (action === "all") pair = ["apk upgrade", "apk upgrade"];
      else pair = [`apk add --upgrade ${names(selected)}`, `apk add --upgrade ${names(selected)}`];
      break;
    }
    case "pacman": {
      if (action === "refresh") pair = ["pacman -Sy", "pacman -Sy"];
      else pair = ["pacman -Syu --noconfirm", "pacman -Syu"];
      break;
    }
  }

  const [ni, interactive] = pair;
  if (info.priv === "root") return { display: ni, live: `${ni} 2>&1`, terminal: interactive };
  if (info.priv === "sudo") return { display: `sudo ${ni}`, live: `sudo -n ${ni} 2>&1`, terminal: `sudo ${interactive}` };
  return { display: `sudo ${interactive}`, live: null, terminal: `sudo ${interactive}` };
}

export function relTime(epochSec: number): string {
  const s = Math.max(0, Math.floor(Date.now() / 1000 - epochSec));
  if (s < 90) return "just now";
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400 * 2) return `${Math.round(s / 3600)} h ago`;
  return `${Math.round(s / 86400)} days ago`;
}
