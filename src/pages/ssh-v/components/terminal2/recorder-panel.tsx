import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Clapperboard, Circle, Download, Info, Pencil, Play, Square, Trash2, Upload, X } from "lucide-react";
import { useSessionTheme } from "@/hooks/useSessionTheme";
import { useSSHStore } from "@/store/sshStore";
import { useRecorderStore } from "@/store/recorderStore";
import { FloatingPanel, PanelMessage } from "./floating-panel";
import { ActionBtn, ConfirmBar, IconBtn } from "./widget-parts";
import type { PanelProps } from "./panels";
import { formatBytes, formatDuration, startRecording, stopRecording } from "./recorder";
import { deleteRecording, getCast, listRecordings, renameRecording, type RecordingMeta } from "./recordings-db";
import RecorderPlayer from "./recorder-player";

/** Record this terminal session (asciicast v2), then replay, download or import recordings. */
export default function RecorderPanel({ sessionId, onClose }: PanelProps) {
  const { colors } = useSessionTheme();
  const fg = colors.foreground;
  const border = `${fg}22`;

  const connected = useSSHStore((s) => s.sessions[sessionId]?.status === "connected" && !!s.sessions[sessionId]?.socket);
  const host = useSSHStore((s) => s.sessions[sessionId]?.host ?? "");
  const status = useRecorderStore((s) => s.status[sessionId]);
  const notice = useRecorderStore((s) => s.notice[sessionId]);
  const savedVersion = useRecorderStore((s) => s.savedVersion);
  const setNotice = useRecorderStore((s) => s.setNotice);
  const recording = !!status?.isRecording;

  const [items, setItems] = useState<RecordingMeta[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ id: string; name: string } | null>(null);
  const [player, setPlayer] = useState<{ title: string; cast: string } | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const reload = useCallback(() => {
    listRecordings()
      .then((list) => { setItems(list); setLoadError(null); })
      .catch((e) => { setItems([]); setLoadError((e as Error)?.message ?? "Couldn't read saved recordings"); });
  }, []);
  useEffect(() => { reload(); }, [reload, savedVersion]);

  // Tick the elapsed timer while recording.
  useEffect(() => {
    if (!recording) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [recording]);

  const toggleRecording = async () => {
    if (recording) {
      setBusy(true);
      await stopRecording(sessionId);
      setBusy(false);
    } else if (!startRecording(sessionId)) {
      setNotice(sessionId, "Couldn't start — the session isn't connected.");
    }
  };

  const play = async (m: RecordingMeta) => {
    const cast = await getCast(m.id);
    if (cast) setPlayer({ title: m.name, cast });
  };

  const download = async (m: RecordingMeta) => {
    const cast = await getCast(m.id);
    if (!cast) return;
    const url = URL.createObjectURL(new Blob([cast], { type: "application/x-asciicast" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `${m.name.replace(/[^\w.-]+/g, "_").slice(0, 80) || "recording"}.cast`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const remove = async (id: string) => {
    setConfirmId(null);
    await deleteRecording(id).catch(() => { });
    reload();
  };

  const saveName = async () => {
    if (!editing) return;
    const name = editing.name.trim();
    if (name) await renameRecording(editing.id, name).catch(() => { });
    setEditing(null);
    reload();
  };

  const importFile = async (file: File | undefined) => {
    if (!file) return;
    const text = await file.text();
    setPlayer({ title: file.name, cast: text });
  };

  const elapsed = recording && status ? (now - status.startedAt) / 1000 : 0;

  return (
    <FloatingPanel
      title="Recorder"
      icon={<Clapperboard size={15} />}
      subtitle={host}
      width={420}
      offset={{ right: 160, top: 160 }}
      onClose={onClose}
      actions={
        <IconBtn fg={fg} title="Play a .cast file" onClick={() => fileRef.current?.click()}><Upload size={13} /></IconBtn>
      }
      footer={<span>{items ? `${items.length} saved recording${items.length === 1 ? "" : "s"}` : "Loading…"}</span>}
    >
      <input
        ref={fileRef}
        type="file"
        accept=".cast,application/x-asciicast,application/json,text/plain"
        style={{ display: "none" }}
        onChange={(e) => { void importFile(e.target.files?.[0]); e.target.value = ""; }}
      />

      {/* Record control */}
      <div style={{ padding: "10px 12px", borderBottom: `1px solid ${border}`, display: "flex", flexDirection: "column", gap: 8, flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {recording ? (
            <>
              <span style={{ width: 9, height: 9, borderRadius: "50%", background: colors.red, boxShadow: `0 0 8px ${colors.red}`, animation: "fpPulse 1.2s ease-in-out infinite", flexShrink: 0 }} />
              <span style={{ fontSize: 12, fontWeight: 600, color: fg, fontVariantNumeric: "tabular-nums" }}>REC {formatDuration(elapsed)}</span>
              <span style={{ fontSize: 10.5, color: `${fg}88`, fontVariantNumeric: "tabular-nums" }}>
                {formatBytes(status?.bytes ?? 0)} · {status?.eventCount ?? 0} events
              </span>
            </>
          ) : (
            <span style={{ fontSize: 11.5, color: `${fg}aa` }}>Record everything this terminal prints.</span>
          )}
          <div style={{ marginLeft: "auto", display: "flex", minWidth: 96 }}>
            {recording ? (
              <ActionBtn label={busy ? "Saving…" : "Stop"} icon={<Square size={12} />} disabled={busy} onClick={() => void toggleRecording()} fg={fg} border={border} accent={colors.red} />
            ) : (
              <ActionBtn label="Record" icon={<Circle size={12} fill={colors.red} />} disabled={!connected} onClick={() => void toggleRecording()} fg={fg} border={border} accent={colors.red} />
            )}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 6, fontSize: 10, color: `${fg}77`, lineHeight: 1.45 }}>
          <Info size={12} style={{ flexShrink: 0, marginTop: 1 }} />
          <span>Recordings contain everything shown on screen (tokens, keys, file contents). Typed passwords aren't echoed, so they aren't captured. Recording keeps going if you close this panel; it's saved to this browser only.</span>
        </div>
        {notice && (
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 10.5, color: colors.yellow, background: `${colors.yellow}14`, borderRadius: 6, padding: "5px 8px" }}>
            <span style={{ flex: 1 }}>{notice}</span>
            <IconBtn fg={fg} title="Dismiss" onClick={() => setNotice(sessionId, null)}><X size={12} /></IconBtn>
          </div>
        )}
      </div>

      {/* Saved recordings */}
      <div className="scrollbar-green" style={{ padding: 10, display: "flex", flexDirection: "column", gap: 7, overflowY: "auto", flex: "1 1 auto", minHeight: 0 }}>
        {items === null ? (
          <PanelMessage>Loading recordings…</PanelMessage>
        ) : loadError ? (
          <PanelMessage tone="error">{loadError}</PanelMessage>
        ) : items.length === 0 ? (
          <PanelMessage icon={<Clapperboard size={22} style={{ color: `${fg}55` }} />}>No recordings yet.</PanelMessage>
        ) : (
          items.map((m) => (
            <div key={m.id} style={{ border: `1px solid ${border}`, borderRadius: 9, padding: "8px 9px", display: "flex", flexDirection: "column", gap: 6, background: `${fg}08` }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                {editing?.id === m.id ? (
                  <>
                    <input
                      autoFocus
                      value={editing.name}
                      onChange={(e) => setEditing({ id: m.id, name: e.target.value })}
                      onKeyDown={(e) => { if (e.key === "Enter") void saveName(); if (e.key === "Escape") setEditing(null); }}
                      style={{ flex: 1, minWidth: 0, fontSize: 11.5, color: fg, background: `${fg}0d`, border: `1px solid ${border}`, borderRadius: 5, padding: "2px 6px", outline: "none" }}
                    />
                    <IconBtn fg={fg} title="Save name" onClick={() => void saveName()}><Check size={13} /></IconBtn>
                    <IconBtn fg={fg} title="Cancel" onClick={() => setEditing(null)}><X size={13} /></IconBtn>
                  </>
                ) : (
                  <>
                    <span style={{ fontSize: 12, fontWeight: 600, color: fg, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }} title={m.name}>{m.name}</span>
                    <IconBtn fg={fg} title="Rename" onClick={() => setEditing({ id: m.id, name: m.name })}><Pencil size={12} /></IconBtn>
                  </>
                )}
              </div>
              <div style={{ display: "flex", gap: 8, fontSize: 10, color: `${fg}88`, flexWrap: "wrap" }}>
                <span>{m.host || "unknown host"}</span>
                <span>{new Date(m.createdAt).toLocaleString()}</span>
                <span style={{ marginLeft: "auto", fontVariantNumeric: "tabular-nums" }}>{formatDuration(m.duration)} · {formatBytes(m.bytes)}</span>
              </div>
              {confirmId === m.id ? (
                <ConfirmBar inline text={`Delete “${m.name}”?`} fg={fg} border={border} red={colors.red} onYes={() => void remove(m.id)} onNo={() => setConfirmId(null)} />
              ) : (
                <div style={{ display: "flex", gap: 6 }}>
                  <ActionBtn label="Play" icon={<Play size={12} />} onClick={() => void play(m)} fg={fg} border={border} accent={colors.green} />
                  <ActionBtn label="Download" icon={<Download size={12} />} onClick={() => void download(m)} fg={fg} border={border} accent={colors.blue} />
                  <ActionBtn label="Delete" icon={<Trash2 size={12} />} onClick={() => setConfirmId(m.id)} fg={fg} border={border} accent={colors.red} />
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {player && <RecorderPlayer cast={player.cast} title={player.title} onClose={() => setPlayer(null)} />}
    </FloatingPanel>
  );
}
