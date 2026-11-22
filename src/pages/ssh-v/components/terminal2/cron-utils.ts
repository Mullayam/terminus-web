/* Pure crontab helpers for the Cron panel: parsing, schedule maths, text. */

export type CronLine =
  | { kind: "job"; id: string; enabled: boolean; schedule: string; command: string; raw: string }
  | { kind: "env"; raw: string }
  | { kind: "comment"; raw: string }
  | { kind: "blank"; raw: string };

export type CronJob = Extract<CronLine, { kind: "job" }>;

const MACROS: Record<string, string | null> = {
  "@reboot": null,
  "@yearly": "0 0 1 1 *",
  "@annually": "0 0 1 1 *",
  "@monthly": "0 0 1 * *",
  "@weekly": "0 0 * * 0",
  "@daily": "0 0 * * *",
  "@midnight": "0 0 * * *",
  "@hourly": "0 * * * *",
};

const MONTH_NAMES = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const DOW_NAMES = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
const DOW_LABEL = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_LABEL = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

interface FieldSpec { min: number; max: number; names?: string[]; nameBase?: number }
const FIELDS: FieldSpec[] = [
  { min: 0, max: 59 },                              // minute
  { min: 0, max: 23 },                              // hour
  { min: 1, max: 31 },                              // day of month
  { min: 1, max: 12, names: MONTH_NAMES, nameBase: 1 }, // month
  { min: 0, max: 7, names: DOW_NAMES, nameBase: 0 },    // day of week (7 = Sun)
];
const FIELD_NAMES = ["minute", "hour", "day-of-month", "month", "day-of-week"];

interface ParsedField { values: Set<number>; star: boolean }
export interface ParsedSchedule {
  reboot: boolean;
  fields: ParsedField[]; // empty for @reboot
}

function parseValue(token: string, spec: FieldSpec): number | null {
  if (/^\d+$/.test(token)) return Number(token);
  if (spec.names) {
    const i = spec.names.indexOf(token.toLowerCase());
    if (i >= 0) return i + (spec.nameBase ?? 0);
  }
  return null;
}

function parseField(text: string, spec: FieldSpec): ParsedField | string {
  const values = new Set<number>();
  for (const part of text.split(",")) {
    if (!part) return "empty list item";
    const [rangePart, stepPart, extra] = part.split("/");
    if (extra !== undefined) return `bad step in "${part}"`;
    let step = 1;
    if (stepPart !== undefined) {
      if (!/^\d+$/.test(stepPart) || Number(stepPart) < 1) return `bad step "${stepPart}"`;
      step = Number(stepPart);
    }
    let lo: number, hi: number;
    if (rangePart === "*") {
      lo = spec.min; hi = spec.max;
    } else if (rangePart.includes("-")) {
      const [a, b, more] = rangePart.split("-");
      if (more !== undefined) return `bad range "${rangePart}"`;
      const av = parseValue(a, spec), bv = parseValue(b, spec);
      if (av === null || bv === null) return `bad value in "${rangePart}"`;
      lo = av; hi = bv;
      if (lo > hi) return `range "${rangePart}" is backwards`;
    } else {
      const v = parseValue(rangePart, spec);
      if (v === null) return `bad value "${rangePart}"`;
      lo = v;
      hi = stepPart !== undefined ? spec.max : v; // "5/15" = from 5 to max every 15
    }
    if (lo < spec.min || hi > spec.max) return `${lo === hi ? lo : `${lo}-${hi}`} out of range ${spec.min}-${spec.max}`;
    for (let v = lo; v <= hi; v += step) values.add(v);
  }
  return { values, star: text.startsWith("*") };
}

/** Parse a schedule (5 fields or a macro). Returns an error message on failure. */
export function parseSchedule(expr: string): ParsedSchedule | string {
  const e = expr.trim().replace(/\s+/g, " ");
  if (!e) return "Schedule is empty";
  if (e.startsWith("@")) {
    const key = e.toLowerCase();
    if (!(key in MACROS)) return `Unknown macro ${e}`;
    const expanded = MACROS[key];
    if (expanded === null) return { reboot: true, fields: [] };
    return parseSchedule(expanded);
  }
  const parts = e.split(" ");
  if (parts.length !== 5) return `Expected 5 fields, got ${parts.length}`;
  const fields: ParsedField[] = [];
  for (let i = 0; i < 5; i++) {
    const f = parseField(parts[i], FIELDS[i]);
    if (typeof f === "string") return `${FIELD_NAMES[i]}: ${f}`;
    if (i === 4 && f.values.has(7)) { f.values.delete(7); f.values.add(0); }
    fields.push(f);
  }
  return { reboot: false, fields };
}

export function validateSchedule(expr: string): string | null {
  const p = parseSchedule(expr);
  return typeof p === "string" ? p : null;
}

function dayMatches(p: ParsedSchedule, d: Date): boolean {
  const dom = p.fields[2], dow = p.fields[4];
  const domOk = dom.values.has(d.getDate());
  const dowOk = dow.values.has(d.getDay());
  // Vixie cron: when both day fields are restricted, either may match.
  return dom.star || dow.star ? domOk && dowOk : domOk || dowOk;
}

/**
 * Next `count` run times after `from`, in the browser's local time zone
 * (the server's zone may differ). @reboot and impossible schedules → [].
 */
export function nextRuns(expr: string, count = 3, from: Date = new Date()): Date[] {
  const p = parseSchedule(expr);
  if (typeof p === "string" || p.reboot) return [];
  const [min, hour, , month] = p.fields;
  const out: Date[] = [];
  const t = new Date(from.getTime());
  t.setSeconds(0, 0);
  t.setMinutes(t.getMinutes() + 1);
  const limit = from.getTime() + 5 * 366 * 24 * 3600 * 1000; // give up after ~5 years (e.g. Feb 30)
  while (out.length < count && t.getTime() <= limit) {
    if (!month.values.has(t.getMonth() + 1)) {
      t.setMonth(t.getMonth() + 1, 1);
      t.setHours(0, 0, 0, 0);
      continue;
    }
    if (!dayMatches(p, t)) {
      t.setDate(t.getDate() + 1);
      t.setHours(0, 0, 0, 0);
      continue;
    }
    if (!hour.values.has(t.getHours())) {
      t.setHours(t.getHours() + 1, 0, 0, 0);
      continue;
    }
    if (!min.values.has(t.getMinutes())) {
      t.setMinutes(t.getMinutes() + 1, 0, 0);
      continue;
    }
    out.push(new Date(t.getTime()));
    t.setMinutes(t.getMinutes() + 1, 0, 0);
  }
  return out;
}

const pad = (n: number) => String(n).padStart(2, "0");
const isNum = (s: string) => /^\d+$/.test(s);

function dowText(field: string): string | null {
  const p = parseField(field, FIELDS[4]);
  if (typeof p === "string") return null;
  const days = [...p.values].map((d) => (d === 7 ? 0 : d));
  const set = new Set(days);
  const sorted = [...set].sort((a, b) => a - b);
  if (sorted.join() === "1,2,3,4,5") return "weekdays";
  if (sorted.join() === "0,6") return "weekends";
  return sorted.map((d) => DOW_LABEL[d]).join(", ");
}

/** Short human description, e.g. "every 5 min", "daily at 03:00". */
export function describeSchedule(expr: string): string {
  const e = expr.trim().replace(/\s+/g, " ");
  const macro = e.toLowerCase();
  if (macro === "@reboot") return "at boot";
  if (macro in MACROS) {
    const named: Record<string, string> = {
      "@hourly": "hourly", "@daily": "daily at 00:00", "@midnight": "daily at 00:00",
      "@weekly": "weekly on Sun at 00:00", "@monthly": "monthly on day 1 at 00:00",
      "@yearly": "yearly on Jan 1 at 00:00", "@annually": "yearly on Jan 1 at 00:00",
    };
    return named[macro] ?? e;
  }
  if (validateSchedule(e)) return "invalid schedule";
  const [mi, h, dom, mon, dow] = e.split(" ");

  if (mi === "*" && h === "*" && dom === "*" && mon === "*" && dow === "*") return "every minute";
  const minStep = mi.match(/^\*\/(\d+)$/);
  if (minStep && h === "*" && dom === "*" && mon === "*" && dow === "*") return `every ${minStep[1]} min`;
  if (isNum(mi) && h === "*" && dom === "*" && mon === "*" && dow === "*") return `hourly at :${pad(+mi)}`;
  const hourStep = h.match(/^\*\/(\d+)$/);
  if (isNum(mi) && hourStep && dom === "*" && mon === "*" && dow === "*") return `every ${hourStep[1]} h at :${pad(+mi)}`;

  if (isNum(mi) && /^\d+(,\d+)*$/.test(h)) {
    const hours = h.split(",").map(Number);
    const times = hours.length <= 3 ? hours.map((x) => `${pad(x)}:${pad(+mi)}`).join(", ") : `${hours.length} times a day`;
    if (dom === "*" && mon === "*" && dow === "*") return `daily at ${times}`;
    if (dom === "*" && mon === "*") {
      const days = dowText(dow);
      if (days) return `${days === "weekdays" || days === "weekends" ? days : `on ${days}`} at ${times}`;
    }
    if (isNum(dom) && mon === "*" && dow === "*") return `monthly on day ${dom} at ${times}`;
    const monNum = parseValue(mon, FIELDS[3]);
    if (isNum(dom) && monNum !== null && monNum >= 1 && monNum <= 12 && dow === "*") return `yearly on ${MONTH_LABEL[monNum - 1]} ${dom} at ${times}`;
  }
  return "custom schedule";
}

/** "in 3h 12m", "in 2d 4h", "in <1m". */
export function formatRelative(date: Date, now: Date = new Date()): string {
  const mins = Math.round((date.getTime() - now.getTime()) / 60000);
  if (mins < 1) return "in <1m";
  if (mins < 60) return `in ${mins}m`;
  const h = Math.floor(mins / 60), m = mins % 60;
  if (h < 24) return m ? `in ${h}h ${m}m` : `in ${h}h`;
  const d = Math.floor(h / 24), rh = h % 24;
  return rh ? `in ${d}d ${rh}h` : `in ${d}d`;
}

export function formatRunTime(date: Date): string {
  return date.toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

const JOB_RE = /^(\S+)\s+(\S+)\s+(\S+)\s+(\S+)\s+(\S+)\s+(.+)$/;
const MACRO_RE = /^(@\w+)\s+(.+)$/;
const ENV_RE = /^[A-Za-z_][A-Za-z0-9_]*\s*=/;

function tryJob(body: string): { schedule: string; command: string } | null {
  const m = body.match(MACRO_RE);
  if (m && m[1].toLowerCase() in MACROS) return { schedule: m[1], command: m[2] };
  const j = body.match(JOB_RE);
  if (!j) return null;
  const schedule = j.slice(1, 6).join(" ");
  if (validateSchedule(schedule)) return null;
  return { schedule, command: j[6] };
}

/**
 * Split crontab text into lines. Jobs keep their raw text so untouched lines
 * round-trip byte-for-byte; `# <valid job>` lines become disabled jobs.
 */
export function parseCrontab(text: string): CronLine[] {
  const rows = text.split("\n");
  if (rows.length && rows[rows.length - 1] === "") rows.pop(); // trailing newline
  return rows.map((raw, i): CronLine => {
    const t = raw.trim();
    if (!t) return { kind: "blank", raw };
    if (t.startsWith("#")) {
      const job = tryJob(t.replace(/^#+\s*/, ""));
      return job ? { kind: "job", id: `j${i}`, enabled: false, ...job, raw } : { kind: "comment", raw };
    }
    if (ENV_RE.test(t)) return { kind: "env", raw };
    const job = tryJob(t);
    return job ? { kind: "job", id: `j${i}`, enabled: true, ...job, raw } : { kind: "comment", raw };
  });
}

export function jobLine(enabled: boolean, schedule: string, command: string): string {
  return `${enabled ? "" : "# "}${schedule.trim().replace(/\s+/g, " ")} ${command.trim()}`;
}

/** Rebuild the full crontab text (always newline-terminated, as cron requires). */
export function serializeCrontab(lines: CronLine[]): string {
  if (!lines.length) return "";
  return lines.map((l) => l.raw).join("\n") + "\n";
}

/** base64 of the UTF-8 bytes — safe to embed in a single-quoted shell string. */
export function toBase64Utf8(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(bin);
}

export const CRON_PRESETS: { label: string; schedule: string }[] = [
  { label: "Every 5 min", schedule: "*/5 * * * *" },
  { label: "Hourly", schedule: "0 * * * *" },
  { label: "Daily 03:00", schedule: "0 3 * * *" },
  { label: "Weekly Sun 00:00", schedule: "0 0 * * 0" },
  { label: "At boot", schedule: "@reboot" },
];
