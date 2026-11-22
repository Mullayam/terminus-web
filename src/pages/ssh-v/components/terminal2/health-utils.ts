/* Host health & security check: collector script, parsers and check rules (no React). */

/**
 * Run a POSIX sh script on the host regardless of the login shell (zsh/fish
 * don't word-split like sh): ship it base64-encoded and pipe it into `sh`.
 * Kept to syntax every login shell parses (no subshell parens for fish).
 * The script must be ASCII.
 */
export function shScript(script: string): string {
  const b64 = btoa(script);
  return `printf '%s' '${b64}' | base64 -d | sh 2>/dev/null`;
}

/**
 * One round-trip collector. Every section is fault tolerant: a missing tool
 * prints nothing or `n/a` and the parser reports "unknown". `$SUDO` is
 * `sudo -n` only when sudo works without a password.
 */
export const COLLECT_SCRIPT = String.raw`
PATH="$PATH:/usr/sbin:/sbin"
S(){ printf '\n__%s__\n' "$1"; }
SUDO=""
if [ "$(id -u)" != 0 ] && command -v sudo >/dev/null 2>&1 && sudo -n true 2>/dev/null; then SUDO="sudo -n"; fi
S PRIV
if [ "$(id -u)" = 0 ]; then echo root; elif [ -n "$SUDO" ]; then echo sudo; else echo none; fi
S OS
cat /etc/os-release 2>/dev/null
S KERNEL
uname -r 2>/dev/null
S UPTIME
cut -d' ' -f1 /proc/uptime 2>/dev/null
S LOAD
cat /proc/loadavg 2>/dev/null
nproc 2>/dev/null || getconf _NPROCESSORS_ONLN 2>/dev/null
S MEM
grep -E '^(MemTotal|MemAvailable|SwapTotal|SwapFree):' /proc/meminfo 2>/dev/null
S DISK
df -P -k -x tmpfs -x devtmpfs -x squashfs -x overlay 2>/dev/null || df -P -k 2>/dev/null
S INODE
df -P -i -x tmpfs -x devtmpfs -x squashfs -x overlay 2>/dev/null || df -P -i 2>/dev/null
S REBOOT
if [ -f /var/run/reboot-required ]; then echo yes; else echo no; fi
S UPDATES
if command -v apt-get >/dev/null 2>&1; then
  echo apt
  o=$(apt-get -s -o Debug::NoLocking=1 upgrade 2>/dev/null | grep '^Inst')
  if [ -n "$o" ]; then printf '%s\n' "$o" | grep -c '^Inst'; printf '%s\n' "$o" | grep -ci 'security'; else echo 0; echo 0; fi
elif command -v dnf >/dev/null 2>&1; then
  echo dnf
  dnf -q check-update 2>/dev/null | awk 'NF==3 && $1 ~ /\./' | wc -l
  dnf -q updateinfo list --security 2>/dev/null | wc -l
elif command -v yum >/dev/null 2>&1; then
  echo yum
  yum -q check-update 2>/dev/null | awk 'NF==3 && $1 ~ /\./' | wc -l
  yum -q updateinfo list security 2>/dev/null | wc -l
else
  echo none
fi
S FAILED
if command -v systemctl >/dev/null 2>&1 && [ -d /run/systemd/system ]; then
  systemctl --failed --no-legend --plain --no-pager 2>/dev/null | awk '{print $1}'
else
  echo n/a
fi
S TIMESYNC
if command -v timedatectl >/dev/null 2>&1; then timedatectl show -p NTPSynchronized --value 2>/dev/null; else echo n/a; fi
S SSHD
t=$( { $SUDO sshd -T 2>/dev/null || $SUDO /usr/sbin/sshd -T 2>/dev/null; } | grep -Ei '^(permitrootlogin|passwordauthentication|port|pubkeyauthentication) ')
if [ -n "$t" ]; then
  echo "src effective"; printf '%s\n' "$t"
elif [ -r /etc/ssh/sshd_config ]; then
  echo "src config"
  cat /etc/ssh/sshd_config.d/*.conf /etc/ssh/sshd_config 2>/dev/null | grep -Ei '^[[:space:]]*(permitrootlogin|passwordauthentication|port|pubkeyauthentication)[[:space:]]'
else
  echo "src none"
fi
S SSHFAIL
if [ "$(id -u)" = 0 ] || [ -n "$SUDO" ] || id -nG 2>/dev/null | grep -qwE 'systemd-journal|adm'; then
  if command -v journalctl >/dev/null 2>&1 && [ -n "$($SUDO journalctl -q -n 1 --no-pager 2>/dev/null)" ]; then
    echo "src journal"
    $SUDO journalctl --since "24 hours ago" --no-pager -q _COMM=sshd _COMM=sshd-session 2>/dev/null | grep -cE 'Failed password|Invalid user'
  else
    f=""
    for c in /var/log/auth.log /var/log/secure; do if $SUDO test -r "$c" 2>/dev/null; then f="$c"; break; fi; done
    if [ -n "$f" ]; then
      echo "src file"
      d1=$(date '+%b %e'); d2=$(date -d yesterday '+%b %e' 2>/dev/null || echo none)
      i1=$(date '+%Y-%m-%d'); i2=$(date -d yesterday '+%Y-%m-%d' 2>/dev/null || echo none)
      $SUDO cat "$f" 2>/dev/null | grep -E "^($d1|$d2|$i1|$i2)" | grep -cE 'Failed password|Invalid user'
    else
      echo "src none"
    fi
  fi
else
  echo "src none"
fi
S PORTS
if command -v ss >/dev/null 2>&1; then ss -tlnH 2>/dev/null | awk '{print $4}'
elif command -v netstat >/dev/null 2>&1; then netstat -tln 2>/dev/null | awk 'NR>2 {print $4}'
else echo n/a; fi
S FIREWALL
if command -v ufw >/dev/null 2>&1; then
  echo "tool ufw"; $SUDO ufw status 2>&1 | head -1
elif command -v firewall-cmd >/dev/null 2>&1; then
  echo "tool firewalld"; $SUDO firewall-cmd --state 2>&1 | head -1
elif command -v iptables >/dev/null 2>&1; then
  echo "tool iptables"
  r=$($SUDO iptables -S 2>&1)
  if printf '%s' "$r" | grep -qiE 'permission denied|must be root|you must be root'; then echo denied; else printf '%s\n' "$r" | grep -c '^-A'; printf '%s\n' "$r" | grep -E '^-P INPUT' | head -1; fi
else
  echo "tool none"
fi
S FAIL2BAN
if command -v fail2ban-client >/dev/null 2>&1 || [ -x /usr/bin/fail2ban-client ]; then echo installed; systemctl is-active fail2ban 2>/dev/null || echo unknown; else echo missing; fi
S AUTOUPD
if command -v apt-get >/dev/null 2>&1; then
  if dpkg -s unattended-upgrades 2>/dev/null | grep -q 'install ok installed'; then i=yes; else i=no; fi
  e=$(grep -hs 'APT::Periodic::Unattended-Upgrade' /etc/apt/apt.conf.d/* 2>/dev/null | tail -1 | tr -dc '0-9')
  echo "apt $i $e"
elif command -v dnf >/dev/null 2>&1 || command -v yum >/dev/null 2>&1; then
  e=$(systemctl is-enabled dnf-automatic-install.timer dnf-automatic.timer 2>/dev/null | grep -c '^enabled')
  if rpm -q dnf-automatic >/dev/null 2>&1; then i=yes; else i=no; fi
  echo "dnf $i $e"
else
  echo none
fi
S UID0
awk -F: '$3==0 {print $1}' /etc/passwd 2>/dev/null
S LAST
{ last -n 5 -w 2>/dev/null || last -n 5 2>/dev/null; } | head -5
S END
`;

export const COLLECT_CMD = shScript(COLLECT_SCRIPT);

/* ── Parsing ─────────────────────────────────────────────────── */

export function splitSections(output: string): Record<string, string[]> {
  const buckets: Record<string, string[]> = {};
  let section = "";
  for (const raw of output.split("\n")) {
    const line = raw.replace(/\r/g, "");
    const marker = line.match(/^__([A-Z0-9]+)__$/);
    if (marker) { section = marker[1]; buckets[section] = []; continue; }
    if (section) buckets[section].push(line);
  }
  // Drop blank lines at the edges of each section.
  for (const k of Object.keys(buckets)) buckets[k] = buckets[k].filter((l) => l.trim() !== "");
  return buckets;
}

export interface Mount { mount: string; usedPct: number; sizeKb: number; availKb: number }

export interface HealthData {
  priv: "root" | "sudo" | "none";
  os: string | null;
  osId: string | null;
  kernel: string | null;
  uptimeSec: number | null;
  load: [number, number, number] | null;
  cpus: number | null;
  memTotalKb: number | null;
  memAvailKb: number | null;
  swapTotalKb: number | null;
  swapFreeKb: number | null;
  disks: Mount[];
  inodes: { mount: string; usedPct: number }[];
  rebootRequired: boolean | null;
  updates: { manager: string; total: number; security: number } | null;
  failedUnits: string[] | null;
  timeSynced: boolean | null;
  sshd: { source: "effective" | "config"; values: Record<string, string> } | null;
  sshFailures: { source: "journal" | "file"; count: number } | null;
  listening: string[] | null;
  firewall: { tool: "ufw" | "firewalld" | "iptables"; active: boolean | null; detail: string } | null | "none";
  fail2ban: { installed: boolean; active: boolean | null };
  autoUpdates: { kind: "apt" | "dnf"; installed: boolean; enabled: boolean } | null;
  uid0: string[];
  lastLogins: string[];
}

const num = (s: string | undefined): number | null => {
  if (s === undefined) return null;
  const n = Number(s.trim());
  return Number.isFinite(n) ? n : null;
};

function parseDf(lines: string[]): { mount: string; usedPct: number; size: number; avail: number }[] {
  const out: { mount: string; usedPct: number; size: number; avail: number }[] = [];
  for (const l of lines) {
    if (/^Filesystem\b/i.test(l)) continue;
    const t = l.trim().split(/\s+/);
    if (t.length < 6) continue;
    const pct = parseInt(t[4], 10);
    if (Number.isNaN(pct)) continue;
    const mount = t.slice(5).join(" ");
    if (/^\/(snap|dev|sys|proc|run)(\/|$)/.test(mount)) continue;
    out.push({ mount, usedPct: pct, size: Number(t[1]) || 0, avail: Number(t[3]) || 0 });
  }
  return out;
}

export function parseHealth(output: string): HealthData {
  const b = splitSections(output);
  const first = (k: string) => b[k]?.[0]?.trim();

  const osKv: Record<string, string> = {};
  for (const l of b.OS ?? []) {
    const m = l.match(/^([A-Z_]+)=(.*)$/);
    if (m) osKv[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }

  const loadParts = (b.LOAD?.[0] ?? "").trim().split(/\s+/);
  const load = loadParts.length >= 3 && loadParts.slice(0, 3).every((x) => Number.isFinite(Number(x)))
    ? [Number(loadParts[0]), Number(loadParts[1]), Number(loadParts[2])] as [number, number, number]
    : null;

  const mem: Record<string, number> = {};
  for (const l of b.MEM ?? []) {
    const m = l.match(/^(\w+):\s+(\d+)/);
    if (m) mem[m[1]] = Number(m[2]);
  }

  const updLines = b.UPDATES ?? [];
  const updates = updLines[0] && updLines[0] !== "none"
    ? { manager: updLines[0].trim(), total: num(updLines[1]) ?? 0, security: num(updLines[2]) ?? 0 }
    : null;

  const failed = b.FAILED ?? [];
  const failedUnits = failed.includes("n/a") ? null : failed.map((l) => l.trim()).filter((l) => /\.\w+$/.test(l));

  const ts = first("TIMESYNC");
  const timeSynced = ts === "yes" ? true : ts === "no" ? false : null;

  let sshd: HealthData["sshd"] = null;
  const sshdLines = b.SSHD ?? [];
  const src = sshdLines[0]?.replace(/^src\s+/, "");
  if (src === "effective" || src === "config") {
    const values: Record<string, string> = {};
    for (const l of sshdLines.slice(1)) {
      const m = l.trim().match(/^(\S+)\s+(.+)$/);
      if (!m) continue;
      const key = m[1].toLowerCase();
      // sshd uses the first value it reads for a keyword (drop-ins are read first).
      if (key === "port") values.port = values.port ? `${values.port} ${m[2].trim()}` : m[2].trim();
      else if (!(key in values)) values[key] = m[2].trim().toLowerCase();
    }
    sshd = { source: src, values };
  }

  let sshFailures: HealthData["sshFailures"] = null;
  const sf = b.SSHFAIL ?? [];
  const sfSrc = sf[0]?.replace(/^src\s+/, "");
  if ((sfSrc === "journal" || sfSrc === "file") && num(sf[1]) !== null) {
    sshFailures = { source: sfSrc, count: num(sf[1]) ?? 0 };
  }

  const ports = b.PORTS ?? [];
  const listening = ports.includes("n/a") ? null : ports.map((l) => l.trim()).filter((l) => l.includes(":"));

  let firewall: HealthData["firewall"] = null;
  const fw = b.FIREWALL ?? [];
  const tool = fw[0]?.replace(/^tool\s+/, "");
  if (tool === "none") firewall = "none";
  else if (tool === "ufw") {
    const s = (fw[1] ?? "").toLowerCase();
    firewall = { tool, active: s.includes("status: active") ? true : s.includes("inactive") ? false : null, detail: fw[1] ?? "" };
  } else if (tool === "firewalld") {
    const s = (fw[1] ?? "").toLowerCase().trim();
    firewall = { tool, active: s === "running" ? true : s === "not running" ? false : null, detail: fw[1] ?? "" };
  } else if (tool === "iptables") {
    if (fw[1] === "denied" || fw[1] === undefined) firewall = { tool, active: null, detail: "needs root to read" };
    else {
      const rules = num(fw[1]) ?? 0;
      const policy = fw[2] ?? "";
      firewall = { tool, active: rules > 0 || /DROP|REJECT/.test(policy), detail: `${rules} rules${policy ? `, ${policy.replace(/^-P\s+/, "")}` : ""}` };
    }
  }

  const f2b = b.FAIL2BAN ?? [];
  const fail2ban = {
    installed: f2b[0] === "installed",
    active: f2b[1] === "active" ? true : f2b[1] && f2b[1] !== "unknown" ? false : null,
  };

  let autoUpdates: HealthData["autoUpdates"] = null;
  const au = (b.AUTOUPD?.[0] ?? "").trim().split(/\s+/);
  if (au[0] === "apt" || au[0] === "dnf") {
    autoUpdates = {
      kind: au[0],
      installed: au[1] === "yes",
      enabled: au[1] === "yes" && Number(au[2] ?? "0") > 0,
    };
  }

  const privRaw = first("PRIV");
  return {
    priv: privRaw === "root" || privRaw === "sudo" ? privRaw : "none",
    os: osKv.PRETTY_NAME || (osKv.NAME ? `${osKv.NAME} ${osKv.VERSION_ID ?? ""}`.trim() : null),
    osId: osKv.ID ?? null,
    kernel: first("KERNEL") ?? null,
    uptimeSec: num(first("UPTIME")),
    load,
    cpus: num(b.LOAD?.[1]),
    memTotalKb: mem.MemTotal ?? null,
    memAvailKb: mem.MemAvailable ?? null,
    swapTotalKb: mem.SwapTotal ?? null,
    swapFreeKb: mem.SwapFree ?? null,
    disks: parseDf(b.DISK ?? []).filter((d) => d.size > 0).map((d) => ({ mount: d.mount, usedPct: d.usedPct, sizeKb: d.size, availKb: d.avail })),
    inodes: parseDf(b.INODE ?? []).filter((d) => d.size > 0).map((d) => ({ mount: d.mount, usedPct: d.usedPct })),
    rebootRequired: first("REBOOT") === "yes" ? true : first("REBOOT") === "no" ? false : null,
    updates,
    failedUnits,
    timeSynced,
    sshd,
    sshFailures,
    listening,
    firewall,
    fail2ban,
    autoUpdates,
    uid0: (b.UID0 ?? []).map((l) => l.trim()).filter(Boolean),
    lastLogins: (b.LAST ?? []).filter((l) => l.trim() && !/^wtmp begins/.test(l)),
  };
}

/* ── Formatting ──────────────────────────────────────────────── */

export function fmtKb(kb: number): string {
  if (kb >= 1024 * 1024 * 1024) return `${(kb / (1024 * 1024 * 1024)).toFixed(1)} TB`;
  if (kb >= 1024 * 1024) return `${(kb / (1024 * 1024)).toFixed(1)} GB`;
  if (kb >= 1024) return `${Math.round(kb / 1024)} MB`;
  return `${kb} KB`;
}

export function fmtUptime(sec: number): string {
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

/* ── Checks ──────────────────────────────────────────────────── */

export type CheckStatus = "ok" | "warn" | "fail" | "unknown";
export type CheckCategory = "System" | "Resources" | "Security" | "Updates";
export type PanelLink = "services" | "ports" | "firewall" | "updates" | "disk" | "logs";

export interface CheckFix {
  label: string;
  /** Sent to the terminal after a confirm (never run silently). */
  command?: string;
  /** Extra caution shown in the confirm bar. */
  warning?: string;
  panel?: PanelLink;
}

export interface Check {
  id: string;
  category: CheckCategory;
  status: CheckStatus;
  title: string;
  detail: string;
  fix?: CheckFix;
}

export const CATEGORIES: CheckCategory[] = ["Security", "Updates", "Resources", "System"];

/** Address is reachable from outside the host (not loopback). */
function isExposed(addr: string): boolean {
  const host = addr.slice(0, addr.lastIndexOf(":")).replace(/^\[|\]$/g, "").replace(/%.*$/, "");
  if (!host) return true;
  return !(host.startsWith("127.") || host === "::1" || host === "localhost" || host === "::ffff:127.0.0.1");
}

function portOf(addr: string): number | null {
  const p = Number(addr.slice(addr.lastIndexOf(":") + 1));
  return Number.isFinite(p) ? p : null;
}

function installCmd(manager: string | undefined, pkg: string): string | undefined {
  if (manager === "apt") return `sudo apt-get install -y ${pkg}`;
  if (manager === "dnf") return `sudo dnf install -y ${pkg}`;
  if (manager === "yum") return `sudo yum install -y ${pkg}`;
  return undefined;
}

export function buildChecks(d: HealthData): Check[] {
  const checks: Check[] = [];
  const add = (c: Check) => checks.push(c);
  const mgr = d.updates?.manager;

  /* System */
  add(d.rebootRequired === null
    ? { id: "reboot", category: "System", status: "unknown", title: "Reboot status", detail: "Couldn't tell whether a reboot is pending." }
    : d.rebootRequired
      ? { id: "reboot", category: "System", status: "warn", title: "Reboot required", detail: "Updated packages (often the kernel) only take effect after a reboot.", fix: { label: "Reboot…", command: "sudo reboot", warning: "This disconnects every session on the host." } }
      : { id: "reboot", category: "System", status: "ok", title: "No reboot pending", detail: d.kernel ? `Running kernel ${d.kernel}` : "" });

  add(d.failedUnits === null
    ? { id: "failed-units", category: "System", status: "unknown", title: "Failed services", detail: "systemd isn't available on this host." }
    : d.failedUnits.length
      ? { id: "failed-units", category: "System", status: "fail", title: `${d.failedUnits.length} failed service${d.failedUnits.length > 1 ? "s" : ""}`, detail: d.failedUnits.slice(0, 6).join(", ") + (d.failedUnits.length > 6 ? ", …" : ""), fix: { label: "Open Services", panel: "services" } }
      : { id: "failed-units", category: "System", status: "ok", title: "No failed services", detail: "" });

  add(d.timeSynced === null
    ? { id: "time", category: "System", status: "unknown", title: "Clock sync", detail: "timedatectl isn't available." }
    : d.timeSynced
      ? { id: "time", category: "System", status: "ok", title: "Clock is synchronized", detail: "NTP sync is active." }
      : { id: "time", category: "System", status: "warn", title: "Clock isn't synchronized", detail: "Skewed clocks break TLS, logs and auth tokens.", fix: { label: "Enable NTP", command: "sudo timedatectl set-ntp true" } });

  /* Resources */
  if (d.disks.length) {
    const worst = [...d.disks].sort((a, b) => b.usedPct - a.usedPct)[0];
    const status: CheckStatus = worst.usedPct >= 90 ? "fail" : worst.usedPct >= 80 ? "warn" : "ok";
    const full = d.disks.filter((x) => x.usedPct >= 80).map((x) => `${x.mount} ${x.usedPct}%`);
    add({
      id: "disk", category: "Resources", status,
      title: status === "ok" ? "Disk space OK" : `Disk ${worst.mount} is ${worst.usedPct}% full`,
      detail: status === "ok" ? `Fullest: ${worst.mount} at ${worst.usedPct}% (${fmtKb(worst.availKb)} free)` : full.join(", "),
      fix: status === "ok" ? undefined : { label: "Find what's using it", panel: "disk" },
    });
  } else {
    add({ id: "disk", category: "Resources", status: "unknown", title: "Disk space", detail: "df returned nothing." });
  }

  if (d.inodes.length) {
    const worst = [...d.inodes].sort((a, b) => b.usedPct - a.usedPct)[0];
    const status: CheckStatus = worst.usedPct >= 90 ? "fail" : worst.usedPct >= 80 ? "warn" : "ok";
    add({ id: "inodes", category: "Resources", status, title: status === "ok" ? "Inodes OK" : `Inodes on ${worst.mount} at ${worst.usedPct}%`, detail: status === "ok" ? "" : "Lots of tiny files (caches, sessions, mail queues) can fill a disk that still has free space.", fix: status === "ok" ? undefined : { label: "Open disk explorer", panel: "disk" } });
  }

  if (d.memTotalKb && d.memAvailKb !== null) {
    const availPct = Math.round((d.memAvailKb / d.memTotalKb) * 100);
    const status: CheckStatus = availPct < 5 ? "fail" : availPct < 10 ? "warn" : "ok";
    add({ id: "memory", category: "Resources", status, title: status === "ok" ? "Memory OK" : `Only ${availPct}% memory available`, detail: `${fmtKb(d.memAvailKb)} available of ${fmtKb(d.memTotalKb)}`, fix: status === "ok" ? undefined : { label: "Top processes", panel: "ports" } });
  }
  if (d.swapTotalKb && d.swapFreeKb !== null) {
    const usedPct = Math.round(((d.swapTotalKb - d.swapFreeKb) / d.swapTotalKb) * 100);
    if (usedPct >= 50) add({ id: "swap", category: "Resources", status: "warn", title: `Swap ${usedPct}% used`, detail: "Heavy swapping slows everything down.", fix: { label: "Top processes", panel: "ports" } });
  }

  if (d.load && d.cpus) {
    const per = d.load[1] / d.cpus;
    const status: CheckStatus = per > 2 ? "fail" : per > 1 ? "warn" : "ok";
    add({ id: "load", category: "Resources", status, title: status === "ok" ? "CPU load OK" : "High CPU load", detail: `5-min load ${d.load[1].toFixed(2)} on ${d.cpus} CPU${d.cpus > 1 ? "s" : ""}`, fix: status === "ok" ? undefined : { label: "Top processes", panel: "ports" } });
  }

  /* Security */
  const sshCfgNote = d.sshd?.source === "config" ? " (from sshd_config; effective value needs root)" : "";
  if (d.sshd) {
    const root = d.sshd.values.permitrootlogin;
    if (root === "yes") {
      add({ id: "ssh-root", category: "Security", status: "fail", title: "Root can log in with a password over SSH", detail: `PermitRootLogin yes${sshCfgNote}`, fix: { label: "Disallow root password login", command: "echo 'PermitRootLogin prohibit-password' | sudo tee /etc/ssh/sshd_config.d/60-terminus-root.conf && sudo sshd -t && (sudo systemctl reload ssh 2>/dev/null || sudo systemctl reload sshd)", warning: "Make sure you can log in as a non-root user (or with a key) first." } });
    } else {
      add({ id: "ssh-root", category: "Security", status: "ok", title: "Root password login disabled", detail: `PermitRootLogin ${root ?? "prohibit-password (default)"}${sshCfgNote}` });
    }
    const pw = d.sshd.values.passwordauthentication ?? (d.sshd.source === "config" ? "yes" : undefined);
    if (pw === "yes") {
      add({ id: "ssh-password", category: "Security", status: "warn", title: "SSH password login is enabled", detail: `${d.sshd.values.passwordauthentication ? "PasswordAuthentication yes" : "Not set, so it defaults to yes"}${sshCfgNote}. Keys are much harder to brute-force.`, fix: { label: "Allow keys only", command: "echo 'PasswordAuthentication no' | sudo tee /etc/ssh/sshd_config.d/60-terminus-password.conf && sudo sshd -t && (sudo systemctl reload ssh 2>/dev/null || sudo systemctl reload sshd)", warning: "Only do this if your own login uses an SSH key — otherwise you'll lock yourself out." } });
    } else if (pw === "no") {
      add({ id: "ssh-password", category: "Security", status: "ok", title: "SSH accepts keys only", detail: `PasswordAuthentication no${sshCfgNote}` });
    }
  } else {
    add({ id: "ssh-config", category: "Security", status: "unknown", title: "SSH server config", detail: "sshd config isn't readable by this user." });
  }

  if (d.sshFailures) {
    const n = d.sshFailures.count;
    const span = d.sshFailures.source === "journal" ? "last 24h" : "today and yesterday";
    const status: CheckStatus = n >= 100 ? "warn" : "ok";
    add({ id: "ssh-failures", category: "Security", status, title: `${n} failed SSH login${n === 1 ? "" : "s"} (${span})`, detail: n >= 100 ? (d.fail2ban.installed ? "Someone is guessing passwords." : "Someone is guessing passwords — fail2ban would block them.") : "", fix: n >= 100 ? { label: "Open logs", panel: "logs" } : undefined });
  } else {
    add({ id: "ssh-failures", category: "Security", status: "unknown", title: "Failed SSH logins", detail: "The auth log needs root (or the systemd-journal / adm group)." });
  }

  if (d.firewall === "none") {
    add({ id: "firewall", category: "Security", status: "warn", title: "No firewall tool found", detail: "Neither ufw, firewalld nor iptables is installed.", fix: { label: "Install ufw", command: installCmd(mgr, "ufw") } });
  } else if (d.firewall) {
    const fw = d.firewall;
    add(fw.active === null
      ? { id: "firewall", category: "Security", status: "unknown", title: `Firewall (${fw.tool})`, detail: "Reading the rules needs sudo.", fix: { label: "Open Firewall", panel: "firewall" } }
      : fw.active
        ? { id: "firewall", category: "Security", status: "ok", title: `Firewall active (${fw.tool})`, detail: fw.detail, fix: { label: "Open Firewall", panel: "firewall" } }
        : { id: "firewall", category: "Security", status: "warn", title: `Firewall is off (${fw.tool})`, detail: "Every listening port is reachable from the network.", fix: { label: "Open Firewall", panel: "firewall" } });
  }

  if (d.listening) {
    const sshPorts = (d.sshd?.values.port ?? "22").split(/\s+/).map(Number);
    const exposed = [...new Set(d.listening.filter(isExposed).map(portOf).filter((p): p is number => p !== null))].sort((a, b) => a - b);
    const unexpected = exposed.filter((p) => !sshPorts.includes(p) && p !== 80 && p !== 443);
    add(unexpected.length
      ? { id: "exposed-ports", category: "Security", status: "warn", title: `${unexpected.length} port${unexpected.length > 1 ? "s" : ""} open to the network`, detail: `Listening on all interfaces: ${unexpected.slice(0, 12).join(", ")}${unexpected.length > 12 ? ", …" : ""}. Bind internal services to 127.0.0.1 or firewall them.`, fix: { label: "Open Ports", panel: "ports" } }
      : { id: "exposed-ports", category: "Security", status: "ok", title: "Only SSH / web ports are exposed", detail: exposed.length ? `Exposed: ${exposed.join(", ")}` : "Nothing listens on public interfaces." });
  }

  add(d.fail2ban.installed
    ? d.fail2ban.active === false
      ? { id: "fail2ban", category: "Security", status: "warn", title: "fail2ban is installed but not running", detail: "", fix: { label: "Start fail2ban", command: "sudo systemctl enable --now fail2ban" } }
      : { id: "fail2ban", category: "Security", status: "ok", title: "fail2ban is active", detail: "Repeated failed logins get banned." }
    : { id: "fail2ban", category: "Security", status: "warn", title: "fail2ban isn't installed", detail: "It bans IPs that keep failing to log in.", fix: { label: "Install fail2ban", command: installCmd(mgr, "fail2ban") } });

  const extraRoot = d.uid0.filter((u) => u !== "root");
  if (d.uid0.length) {
    add(extraRoot.length
      ? { id: "uid0", category: "Security", status: "fail", title: "Extra accounts with root privileges", detail: `UID 0: ${extraRoot.join(", ")} — usually a sign of compromise or a mistake.` }
      : { id: "uid0", category: "Security", status: "ok", title: "Only root has UID 0", detail: "" });
  }

  /* Updates */
  if (d.updates) {
    const { total, security } = d.updates;
    add(security > 0
      ? { id: "updates", category: "Updates", status: "fail", title: `${security} security update${security > 1 ? "s" : ""} pending`, detail: `${total} package update${total === 1 ? "" : "s"} in total (${d.updates.manager}).`, fix: { label: "Open Updates", panel: "updates" } }
      : total > 0
        ? { id: "updates", category: "Updates", status: "warn", title: `${total} update${total > 1 ? "s" : ""} pending`, detail: `No security updates among them (${d.updates.manager}).`, fix: { label: "Open Updates", panel: "updates" } }
        : { id: "updates", category: "Updates", status: "ok", title: "Packages are up to date", detail: `${d.updates.manager} reports no pending updates.` });
  } else {
    add({ id: "updates", category: "Updates", status: "unknown", title: "Pending updates", detail: "No apt, dnf or yum found." });
  }

  if (d.autoUpdates) {
    const au = d.autoUpdates;
    const pkg = au.kind === "apt" ? "unattended-upgrades" : "dnf-automatic";
    const enableCmd = au.kind === "apt"
      ? `${au.installed ? "" : "sudo apt-get install -y unattended-upgrades && "}sudo dpkg-reconfigure -plow unattended-upgrades`
      : `${au.installed ? "" : "sudo dnf install -y dnf-automatic && "}sudo systemctl enable --now dnf-automatic-install.timer`;
    add(au.enabled
      ? { id: "auto-updates", category: "Updates", status: "ok", title: "Automatic security updates are on", detail: pkg }
      : { id: "auto-updates", category: "Updates", status: "warn", title: "Automatic security updates are off", detail: au.installed ? `${pkg} is installed but not enabled.` : `${pkg} isn't installed.`, fix: { label: "Turn on", command: enableCmd } });
  }

  return checks;
}

export function scoreOf(checks: Check[]): { ok: number; known: number; pct: number } {
  const known = checks.filter((c) => c.status !== "unknown");
  const ok = known.filter((c) => c.status === "ok").length;
  return { ok, known: known.length, pct: known.length ? Math.round((ok / known.length) * 100) : 0 };
}

const STATUS_MARK: Record<CheckStatus, string> = { ok: "OK", warn: "WARN", fail: "FAIL", unknown: "?" };

/** Markdown report — used for "Copy report" and as AI context. */
export function buildReport(host: string, d: HealthData, checks: Check[]): string {
  const s = scoreOf(checks);
  const lines = [
    `# Health check: ${host}`,
    "",
    `- OS: ${d.os ?? "unknown"}${d.kernel ? ` (kernel ${d.kernel})` : ""}`,
    `- Uptime: ${d.uptimeSec !== null ? fmtUptime(d.uptimeSec) : "unknown"}`,
    d.load ? `- Load: ${d.load.map((x) => x.toFixed(2)).join(" / ")}${d.cpus ? ` on ${d.cpus} CPUs` : ""}` : "",
    d.memTotalKb && d.memAvailKb !== null ? `- Memory: ${fmtKb(d.memTotalKb - d.memAvailKb)} used of ${fmtKb(d.memTotalKb)}` : "",
    d.disks.length ? `- Disks: ${d.disks.map((x) => `${x.mount} ${x.usedPct}%`).join(", ")}` : "",
    `- Score: ${s.ok}/${s.known} checks OK`,
    "",
  ].filter((l, i, arr) => l !== "" || arr[i - 1] !== "");
  for (const cat of CATEGORIES) {
    const items = checks.filter((c) => c.category === cat);
    if (!items.length) continue;
    lines.push(`## ${cat}`);
    for (const c of items) lines.push(`- [${STATUS_MARK[c.status]}] ${c.title}${c.detail ? ` — ${c.detail}` : ""}`);
    lines.push("");
  }
  if (d.lastLogins.length) {
    lines.push("## Recent logins", "```", ...d.lastLogins, "```");
  }
  return lines.join("\n");
}
