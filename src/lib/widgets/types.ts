import type { WidgetRecord } from "@/lib/idb";
export type { WidgetAlert } from "@/lib/idb";

/** A user-defined (or prebuilt) widget backed by a silent-exec command. */
export type WidgetDef = WidgetRecord;

export type WidgetRender = WidgetRecord["render"];

/** Render modes exposed in the builder, with human labels. */
export const RENDER_OPTIONS: { label: string; value: WidgetRender }[] = [
  { label: "Raw text", value: "raw" },
  { label: "Table", value: "table" },
  { label: "Sparkline", value: "sparkline" },
  { label: "Gauge", value: "gauge" },
];

/** Extract the first numeric value from output; if `pattern` is given, its first capture group (or match). */
export function extractValue(output: string, pattern?: string): number | null {
  const text = output ?? "";
  if (pattern) {
    try {
      const m = new RegExp(pattern).exec(text);
      if (m) {
        const raw = m[1] ?? m[0];
        const n = parseFloat(String(raw).replace(/[^0-9.+-]/g, ""));
        return Number.isFinite(n) ? n : null;
      }
      return null;
    } catch {
      // fall through to default numeric scan on an invalid regex
    }
  }
  const m = text.match(/-?\d+(?:\.\d+)?/);
  if (!m) return null;
  const n = parseFloat(m[0]);
  return Number.isFinite(n) ? n : null;
}

/** Evaluate a widget alert against the current output. Returns true when the alert is tripped. */
export function evalAlert(alert: WidgetRecord["alert"], output: string, value: number | null): boolean {
  if (!alert) return false;
  if (alert.op === "match") {
    if (!alert.pattern) return false;
    try {
      return new RegExp(alert.pattern, "i").test(output ?? "");
    } catch {
      return false;
    }
  }
  if (value == null || alert.value == null) return false;
  switch (alert.op) {
    case ">": return value > alert.value;
    case "<": return value < alert.value;
    case ">=": return value >= alert.value;
    case "<=": return value <= alert.value;
    case "==": return value === alert.value;
    default: return false;
  }
}

/** Theme color keys a widget accent may reference. */
export const WIDGET_ACCENTS = ["green", "cyan", "blue", "magenta", "yellow", "red"] as const;
export type WidgetAccent = (typeof WIDGET_ACCENTS)[number];

export const REFRESH_OPTIONS = [
  { label: "Manual", value: 0 },
  { label: "2s", value: 2000 },
  { label: "5s", value: 5000 },
  { label: "10s", value: 10000 },
  { label: "30s", value: 30000 },
  { label: "60s", value: 60000 },
];

/**
 * Prebuilt widgets seeded into IndexedDB on first run. Each is a normal
 * WidgetDef (builtin: true) so users can open, edit or delete them freely.
 * Commands are defensive (2>/dev/null, fallbacks) and bounded (head).
 */
export const PREBUILT_WIDGETS: Omit<WidgetDef, "createdAt">[] = [
  {
    id: "builtin-processes",
    name: "Top Processes",
    description: "Highest CPU processes",
    command: "ps -eo pid,pcpu,pmem,comm --sort=-pcpu 2>/dev/null | head -n 12",
    refreshMs: 5000,
    render: "table",
    columns: ["PID", "CPU%", "MEM%", "Command"],
    maxRows: 12,
    accent: "cyan",
    builtin: true,
  },
  {
    id: "builtin-services",
    name: "Running Services",
    description: "Active systemd services",
    command: "systemctl list-units --type=service --state=running --no-legend --no-pager 2>/dev/null | awk '{print $1}' | head -n 20",
    refreshMs: 10000,
    render: "raw",
    accent: "green",
    builtin: true,
  },
  {
    id: "builtin-ports",
    name: "Listening Ports",
    description: "Open TCP/UDP listeners",
    command: "ss -tulnH 2>/dev/null | awk '{print $1, $5}' | head -n 20 || netstat -tuln 2>/dev/null | head -n 20",
    refreshMs: 10000,
    render: "raw",
    accent: "blue",
    builtin: true,
  },
  {
    id: "builtin-disk",
    name: "Disk Usage",
    description: "Mounted filesystems",
    command: "df -h 2>/dev/null | grep -vE '^(tmpfs|udev|overlay)' | head -n 12",
    refreshMs: 30000,
    render: "raw",
    accent: "magenta",
    builtin: true,
  },
  {
    id: "builtin-memory",
    name: "Memory",
    description: "free -h snapshot",
    command: "free -h 2>/dev/null",
    refreshMs: 5000,
    render: "raw",
    accent: "yellow",
    builtin: true,
  },
  {
    id: "builtin-uptime",
    name: "Uptime & Load",
    description: "who / uptime",
    command: "uptime 2>/dev/null; echo; who 2>/dev/null | head -n 8",
    refreshMs: 30000,
    render: "raw",
    accent: "green",
    builtin: true,
  },
];

/** Starter shown in the custom-widget builder form. */
export const WIDGET_TEMPLATE: Omit<WidgetDef, "id" | "createdAt"> = {
  name: "",
  description: "",
  command: "",
  refreshMs: 5000,
  render: "raw",
  delimiter: "",
  columns: [],
  maxRows: 20,
  accent: "cyan",
  builtin: false,
  stream: false,
  valuePattern: "",
  gaugeMax: 100,
  unit: "",
  docked: false,
};
