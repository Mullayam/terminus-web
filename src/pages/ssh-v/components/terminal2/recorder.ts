import type { Socket } from "socket.io-client";
import { SocketEventConstants } from "@/lib/sockets/event-constants";
import { useSSHStore } from "@/store/sshStore";
import { useRecorderStore } from "@/store/recorderStore";
import { saveRecording, type RecordingMeta } from "./recordings-db";

/**
 * Terminal session recorder (asciicast v2).
 *
 * Listens to the session socket directly — output via SSH_EMIT_DATA, size via
 * the client's own outgoing SSH_EMIT_RESIZE — so the xterm component needs no
 * hooks. Recordings live here at module level, keyed by session id, so they
 * keep running while the panel is closed.
 */

const MAX_BYTES = 20 * 1024 * 1024;
const MAX_EVENTS = 200_000;
const STATUS_EVERY_MS = 500;
const DEFAULT_SIZE = { cols: 120, rows: 32 };

type CastEvent = [number, "o" | "r", string];

interface Active {
  socket: Socket;
  host: string;
  startedAt: number;
  width: number;
  height: number;
  events: CastEvent[];
  bytes: number;
  onData: (data: unknown) => void;
  onOutgoing: (event: string, ...args: unknown[]) => void;
  timer: ReturnType<typeof setInterval>;
  stopping: boolean;
}

const active = new Map<string, Active>();

/* ── Size tracking ─────────────────────────────────────────────
 * The terminal emits SSH_EMIT_RESIZE right after it opens. Watching every
 * session socket from the moment it shows up in the store means the size is
 * already known when a recording starts. */

const lastSize = new Map<string, { cols: number; rows: number }>();
const trackedSockets = new WeakSet<Socket>();

function asSize(arg: unknown): { cols: number; rows: number } | null {
  const s = arg as { cols?: unknown; rows?: unknown } | null;
  if (s && typeof s.cols === "number" && typeof s.rows === "number" && s.cols > 0 && s.rows > 0) {
    return { cols: s.cols, rows: s.rows };
  }
  return null;
}

function trackSocket(sessionId: string, socket: Socket) {
  if (trackedSockets.has(socket)) return;
  trackedSockets.add(socket);
  socket.onAnyOutgoing((event: string, ...args: unknown[]) => {
    if (event !== SocketEventConstants.SSH_EMIT_RESIZE) return;
    const size = asSize(args[0]);
    if (size) lastSize.set(sessionId, size);
  });
}

let trackerBound = false;
function bindTracker() {
  if (trackerBound) return;
  trackerBound = true;
  const scan = (sessions: ReturnType<typeof useSSHStore.getState>["sessions"]) => {
    for (const [id, s] of Object.entries(sessions)) {
      if (s?.socket) trackSocket(id, s.socket);
    }
  };
  scan(useSSHStore.getState().sessions);
  useSSHStore.subscribe((state, prev) => {
    scan(state.sessions);
    // A closed tab ends its recording (and saves what was captured).
    for (const id of Object.keys(prev.sessions)) {
      if (!state.sessions[id] && active.has(id)) {
        void stopRecording(id, "Recording saved — the tab was closed.");
      }
    }
  });
}
bindTracker();

/* ── Recording ────────────────────────────────────────────── */

function publish(sessionId: string) {
  const rec = active.get(sessionId);
  useRecorderStore.getState().setStatus(sessionId, rec
    ? { isRecording: true, startedAt: rec.startedAt, eventCount: rec.events.length, bytes: rec.bytes }
    : { isRecording: false, startedAt: 0, eventCount: 0, bytes: 0 });
}

export function isRecording(sessionId: string): boolean {
  return active.has(sessionId);
}

export function startRecording(sessionId: string): boolean {
  if (active.has(sessionId)) return true;
  const session = useSSHStore.getState().sessions[sessionId];
  const socket = session?.socket;
  if (!socket) return false;
  trackSocket(sessionId, socket);

  const size = lastSize.get(sessionId) ?? DEFAULT_SIZE;
  const startedAt = Date.now();
  const elapsed = () => Math.round((Date.now() - startedAt)) / 1000;

  const rec: Active = {
    socket,
    host: session.host ?? "",
    startedAt,
    width: size.cols,
    height: size.rows,
    events: [],
    bytes: 0,
    stopping: false,
    timer: setInterval(() => publish(sessionId), STATUS_EVERY_MS),
    onData: (data: unknown) => {
      if (rec.stopping) return;
      const text = typeof data === "string" ? data : data instanceof ArrayBuffer ? new TextDecoder().decode(data) : String(data ?? "");
      if (!text) return;
      rec.events.push([elapsed(), "o", text]);
      rec.bytes += text.length;
      if (rec.bytes >= MAX_BYTES || rec.events.length >= MAX_EVENTS) {
        void stopRecording(sessionId, "Recording stopped and saved — it reached the 20 MB / 200k events limit.");
      }
    },
    onOutgoing: (event: string, ...args: unknown[]) => {
      if (rec.stopping || event !== SocketEventConstants.SSH_EMIT_RESIZE) return;
      const s = asSize(args[0]);
      if (s) rec.events.push([elapsed(), "r", `${s.cols}x${s.rows}`]);
    },
  };

  socket.on(SocketEventConstants.SSH_EMIT_DATA, rec.onData);
  socket.onAnyOutgoing(rec.onOutgoing);
  active.set(sessionId, rec);
  useRecorderStore.getState().setNotice(sessionId, null);
  publish(sessionId);
  return true;
}

function toCast(rec: Active, title: string): string {
  const header = {
    version: 2,
    width: rec.width,
    height: rec.height,
    timestamp: Math.floor(rec.startedAt / 1000),
    title,
    env: { TERM: "xterm-256color", SHELL: "/bin/bash" },
  };
  const lines = [JSON.stringify(header)];
  for (const e of rec.events) lines.push(JSON.stringify(e));
  return lines.join("\n") + "\n";
}

/** Stop and save. Resolves with the saved metadata (null if nothing was recording). */
export async function stopRecording(sessionId: string, notice?: string): Promise<RecordingMeta | null> {
  const rec = active.get(sessionId);
  if (!rec || rec.stopping) return null;
  rec.stopping = true;
  clearInterval(rec.timer);
  rec.socket.off(SocketEventConstants.SSH_EMIT_DATA, rec.onData);
  rec.socket.offAnyOutgoing(rec.onOutgoing);
  active.delete(sessionId);
  publish(sessionId);

  const created = new Date(rec.startedAt);
  const name = `${rec.host || "session"} · ${created.toLocaleString()}`;
  const cast = toCast(rec, name);
  const last = rec.events[rec.events.length - 1];
  const meta: RecordingMeta = {
    id: `rec-${rec.startedAt}-${Math.random().toString(36).slice(2, 8)}`,
    name,
    host: rec.host,
    sessionId,
    createdAt: rec.startedAt,
    duration: last ? last[0] : (Date.now() - rec.startedAt) / 1000,
    bytes: cast.length,
    width: rec.width,
    height: rec.height,
    events: rec.events.length,
  };

  const store = useRecorderStore.getState();
  try {
    await saveRecording(meta, cast);
    if (notice) store.setNotice(sessionId, notice);
  } catch (err) {
    store.setNotice(sessionId, `Couldn't save the recording: ${(err as Error)?.message ?? err}`);
  }
  store.bumpSaved();
  return meta;
}

/* ── asciicast parsing (player / import) ──────────────────── */

export interface ParsedCast {
  width: number;
  height: number;
  title?: string;
  /** Output and resize events, time in seconds from start. */
  events: CastEvent[];
  duration: number;
}

export function parseCast(text: string): ParsedCast {
  const lines = text.split("\n").filter((l) => l.trim());
  if (!lines.length) throw new Error("Empty recording");
  const header = JSON.parse(lines[0]) as { version?: number; width?: number; height?: number; title?: string };
  if (header.version !== 2) throw new Error("Only asciicast v2 recordings are supported");
  const events: CastEvent[] = [];
  for (let i = 1; i < lines.length; i++) {
    try {
      const e = JSON.parse(lines[i]) as [number, string, string];
      if (Array.isArray(e) && typeof e[0] === "number" && (e[1] === "o" || e[1] === "r") && typeof e[2] === "string") {
        events.push([e[0], e[1], e[2]]);
      }
    } catch { /* skip a malformed line */ }
  }
  return {
    width: header.width && header.width > 0 ? header.width : DEFAULT_SIZE.cols,
    height: header.height && header.height > 0 ? header.height : DEFAULT_SIZE.rows,
    title: header.title,
    events,
    duration: events.length ? events[events.length - 1][0] : 0,
  };
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export function formatDuration(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  const mm = String(m).padStart(h ? 2 : 1, "0");
  return h ? `${h}:${mm}:${String(r).padStart(2, "0")}` : `${mm}:${String(r).padStart(2, "0")}`;
}
