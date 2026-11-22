/* Safety checks for broadcasting one command to several SSH sessions. */

interface DangerRule {
  re: RegExp;
  reason: string;
}

const RULES: DangerRule[] = [
  { re: /\brm\s+(-[a-zA-Z]*[rR][a-zA-Z]*\s+)*(-[a-zA-Z]*f[a-zA-Z]*\s+)*(-[a-zA-Z]*[rR][a-zA-Z]*)/, reason: "recursive delete (rm -r)" },
  { re: /\brm\s+(-\S+\s+)*\/(\s|$|\*)/, reason: "deletes from /" },
  { re: /\bmkfs(\.\w+)?\b/, reason: "formats a filesystem (mkfs)" },
  { re: /\bdd\b[^|;&]*\bof=/, reason: "raw disk write (dd of=)" },
  { re: /\bwipefs\b|\bshred\b|\bfdisk\b|\bparted\b|\bsgdisk\b/, reason: "disk partitioning / wiping" },
  { re: />\s*\/dev\/(sd|nvme|vd|xvd|hd|mmcblk)/, reason: "writes to a block device" },
  { re: /\b(shutdown|reboot|halt|poweroff)\b/, reason: "shuts down or reboots the host" },
  { re: /\binit\s+[06]\b|\btelinit\s+[06]\b|\bsystemctl\s+(reboot|poweroff|halt|kexec)\b/, reason: "changes runlevel / reboots" },
  { re: /:\s*\(\s*\)\s*\{.*:\s*\|\s*:/, reason: "fork bomb" },
  { re: /\bchmod\s+(-\S+\s+)*-?R\S*\s+(-\S+\s+)*[0-7]*7{3}\s+\/(\s|$)|\bchmod\s+(-\S+\s+)*777\s+-R\s+\//, reason: "chmod -R 777 on /" },
  { re: /\bchmod\s+-R\b[^;&|]*\s\/(\s|$)|\bchown\s+-R\b[^;&|]*\s\/(\s|$)/, reason: "recursive chmod/chown on /" },
  { re: /\biptables\s+(-\S+\s+)*-F\b|\bip6tables\s+(-\S+\s+)*-F\b|\bnft\s+flush\s+ruleset\b/, reason: "flushes firewall rules" },
  { re: /\bufw\s+(disable|reset)\b|\bsystemctl\s+(stop|disable)\s+(firewalld|ufw)\b/, reason: "disables the firewall" },
  { re: /\bsystemctl\s+(stop|disable|mask|restart)\s+(sshd?|ssh\.service|sshd\.service)\b|\bservice\s+sshd?\s+stop\b/, reason: "stops SSH (you may lose access)" },
  { re: /\b(userdel|deluser|groupdel)\b/, reason: "deletes users or groups" },
  { re: /\bpasswd\b|\bchpasswd\b/, reason: "changes passwords" },
  { re: /\bkill\s+(-9\s+|-KILL\s+|-SIGKILL\s+)?-1\b|\bkillall5\b|\bpkill\s+-9\s+-u\b/, reason: "kills every process" },
  { re: /\bdrop\s+(database|table|schema)\b|\btruncate\s+table\b/i, reason: "drops database objects" },
  { re: /\bgit\s+push\b[^;&|]*(--force\b|-f\b|--force-with-lease\b)/, reason: "force-pushes git history" },
  { re: /\bgit\s+(reset\s+--hard|clean\s+-[a-zA-Z]*f)/, reason: "discards git changes" },
  { re: /\bdocker\s+(system\s+prune|volume\s+prune|rm\s+-f\s+\$\()|\bdocker\s+(compose\s+)?down\s+[^;&|]*-v\b/, reason: "removes Docker data" },
  { re: /\bkubectl\s+delete\b/, reason: "deletes Kubernetes resources" },
  { re: /\b(apt(-get)?|yum|dnf|zypper|pacman)\s+(-\S+\s+)*(remove|purge|autoremove|erase|-R)\b/, reason: "uninstalls packages" },
  { re: /\bcrontab\s+-r\b/, reason: "deletes the crontab" },
  { re: /\bmv\s+[^;&|]*\s\/(etc|bin|usr|lib|boot|var)\b\S*\s+/, reason: "moves system directories" },
  { re: />\s*\/etc\/(passwd|shadow|sudoers|fstab|hosts)\b/, reason: "overwrites a system file" },
];

/** Reasons the command looks destructive; empty when it looks safe. */
export function detectDanger(command: string): string[] {
  const reasons = new Set<string>();
  for (const line of command.split("\n")) {
    const l = line.trim();
    if (!l || l.startsWith("#")) continue;
    for (const r of RULES) if (r.re.test(l)) reasons.add(r.reason);
  }
  return [...reasons];
}

/** Non-empty lines, each sent as its own command. */
export function commandLines(command: string): string[] {
  return command.split("\n").map((l) => l.replace(/\s+$/, "")).filter((l) => l.trim().length > 0);
}
