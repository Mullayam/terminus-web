import { useMemo, useState } from "react";
import {
  Check,
  Copy,
  Pencil,
  Play,
  Plus,
  Search,
  TextCursorInput,
  Trash2,
  Bookmark,
} from "lucide-react";
import { useSessionTheme } from "@/hooks/useSessionTheme";
import { useSSHStore } from "@/store/sshStore";
import { useSnippetStore, type Snippet, type SnippetInput } from "@/store/snippetStore";
import { FloatingPanel, PanelMessage } from "./floating-panel";
import { ActionBtn, Chip, ConfirmBar, IconBtn, MoreMenu, SearchInput } from "./widget-parts";
import { sendToTerminal } from "./widget-utils";
import { fillPlaceholders, hostKeyOf, parsePlaceholders, parseTags } from "./snippet-utils";
import type { PanelProps } from "./panels";

type Mode = "run" | "insert";

function byUsage(a: Snippet, b: Snippet) {
  return b.uses - a.uses || (b.lastUsedAt ?? 0) - (a.lastUsedAt ?? 0) || a.name.localeCompare(b.name);
}

export default function SnippetsPanel({ sessionId, onClose }: PanelProps) {
  const { colors } = useSessionTheme();
  const fg = colors.foreground;
  const border = `${fg}22`;

  const session = useSSHStore((s) => s.sessions[sessionId]);
  const socket = session?.socket;
  const hostKey = hostKeyOf(session);

  const snippets = useSnippetStore((s) => s.snippets);
  const { add, update, remove, markUsed } = useSnippetStore.getState();

  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<Snippet | "new" | null>(null);
  const [filling, setFilling] = useState<{ id: string; mode: Mode } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const { thisHost, allHosts } = useMemo(() => {
    const q = query.trim().toLowerCase();
    const match = (s: Snippet) =>
      !q || s.name.toLowerCase().includes(q) || s.command.toLowerCase().includes(q) || (s.tags ?? []).some((t) => t.includes(q));
    return {
      thisHost: snippets.filter((s) => hostKey && s.hostKey === hostKey && match(s)).sort(byUsage),
      allHosts: snippets.filter((s) => s.hostKey === null && match(s)).sort(byUsage),
    };
  }, [snippets, hostKey, query]);

  const send = (sn: Snippet, command: string, mode: Mode) => {
    sendToTerminal(socket, command, mode === "run");
    markUsed(sn.id);
    setFilling(null);
  };

  const start = (sn: Snippet, mode: Mode) => {
    if (parsePlaceholders(sn.command).length) setFilling({ id: sn.id, mode });
    else send(sn, sn.command, mode);
  };

  const copy = (sn: Snippet) => {
    void navigator.clipboard?.writeText(sn.command).catch(() => { });
    setCopiedId(sn.id);
    setTimeout(() => setCopiedId((c) => (c === sn.id ? null : c)), 1200);
  };

  const save = (input: SnippetInput) => {
    if (editing && editing !== "new") update(editing.id, input);
    else add(input);
    setEditing(null);
  };

  const renderRow = (sn: Snippet) => {
    if (editing && editing !== "new" && editing.id === sn.id) {
      return <SnippetForm key={sn.id} initial={sn} hostKey={hostKey} onSave={save} onCancel={() => setEditing(null)} />;
    }
    return (
      <div key={sn.id} style={{ border: `1px solid ${border}`, borderRadius: 9, padding: "7px 9px", display: "flex", flexDirection: "column", gap: 5, background: `${fg}08` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: fg, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={sn.name}>{sn.name}</span>
          {(sn.tags ?? []).slice(0, 3).map((t) => (
            <span key={t} style={{ fontSize: 9, color: `${fg}88`, border: `1px solid ${border}`, borderRadius: 4, padding: "0 4px" }}>{t}</span>
          ))}
          <span style={{ marginLeft: "auto", fontSize: 9.5, color: `${fg}55`, whiteSpace: "nowrap" }}>{sn.uses ? `${sn.uses}×` : ""}</span>
        </div>
        <code
          title={sn.command}
          style={{ fontSize: 10.5, color: `${fg}bb`, fontFamily: "ui-monospace, monospace", whiteSpace: "pre-wrap", wordBreak: "break-all", maxHeight: 54, overflow: "hidden" }}
        >
          {sn.command}
        </code>

        {confirmDelete === sn.id ? (
          <ConfirmBar
            inline text={`Delete “${sn.name}”?`} fg={fg} border={border} red={colors.red}
            onYes={() => { remove(sn.id); setConfirmDelete(null); }}
            onNo={() => setConfirmDelete(null)}
          />
        ) : filling?.id === sn.id ? (
          <PlaceholderForm
            command={sn.command}
            mode={filling.mode}
            onSend={(cmd, mode) => send(sn, cmd, mode)}
            onCancel={() => setFilling(null)}
          />
        ) : (
          <div style={{ display: "flex", gap: 6 }}>
            <ActionBtn label="Run" icon={<Play size={12} />} disabled={!socket} onClick={() => start(sn, "run")} fg={fg} border={border} accent={colors.green} />
            <ActionBtn label="Insert" icon={<TextCursorInput size={12} />} disabled={!socket} onClick={() => start(sn, "insert")} fg={fg} border={border} accent={colors.blue} />
            <ActionBtn
              label={copiedId === sn.id ? "Copied" : "Copy"}
              icon={copiedId === sn.id ? <Check size={12} /> : <Copy size={12} />}
              onClick={() => copy(sn)} fg={fg} border={border} accent={colors.cyan}
            />
            <MoreMenu
              fg={fg} bg={colors.background} border={border}
              items={[
                { label: "Edit", icon: <Pencil size={12} />, onClick: () => { setFilling(null); setEditing(sn); } },
                { label: "Delete", icon: <Trash2 size={12} />, danger: true, onClick: () => setConfirmDelete(sn.id) },
              ]}
            />
          </div>
        )}
      </div>
    );
  };

  const section = (title: string, list: Snippet[]) => (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: 0.4, textTransform: "uppercase", color: `${fg}66` }}>
        {title} <span style={{ fontWeight: 400 }}>· {list.length}</span>
      </div>
      {list.length ? list.map(renderRow) : (
        <div style={{ fontSize: 11, color: `${fg}55`, padding: "2px 0 4px" }}>{query ? "No matches." : "None yet."}</div>
      )}
    </div>
  );

  return (
    <FloatingPanel
      title="Snippets"
      icon={<Bookmark size={15} />}
      subtitle={hostKey ?? undefined}
      width={420}
      offset={{ right: 120, top: 90 }}
      onClose={onClose}
      actions={<IconBtn fg={fg} title="New snippet" onClick={() => { setFilling(null); setEditing("new"); }}><Plus size={15} /></IconBtn>}
      footer={<span>{snippets.length} saved · Run sends to this tab's terminal</span>}
    >
      <div style={{ display: "flex", gap: 6, padding: "7px 10px", borderBottom: `1px solid ${border}`, flexShrink: 0 }}>
        <SearchInput value={query} onChange={setQuery} placeholder="Search name, command or tag" fg={fg} border={border} icon={<Search size={12} />} />
      </div>
      <div style={{ padding: 10, display: "flex", flexDirection: "column", gap: 12, overflowY: "auto", flex: 1, minHeight: 0 }} className="scrollbar-green">
        {editing === "new" && <SnippetForm hostKey={hostKey} onSave={save} onCancel={() => setEditing(null)} />}
        {!socket && <PanelMessage tone="error">Session not connected — snippets can't be sent.</PanelMessage>}
        {snippets.length === 0 && editing !== "new" ? (
          <PanelMessage icon={<Bookmark size={22} style={{ color: `${fg}55` }} />}>
            Save commands you run on this server — deploy scripts, log paths, service restarts.
            <div style={{ marginTop: 8 }}>
              <ActionBtn label="New snippet" icon={<Plus size={12} />} onClick={() => setEditing("new")} fg={fg} border={border} accent={colors.green} />
            </div>
          </PanelMessage>
        ) : (
          <>
            {hostKey && section("This host", thisHost)}
            {section("All hosts", allHosts)}
          </>
        )}
      </div>
    </FloatingPanel>
  );
}

/* ── Add / edit form ───────────────────────────────────────── */

function SnippetForm({ initial, hostKey, onSave, onCancel }: {
  initial?: Snippet; hostKey: string | null; onSave: (s: SnippetInput) => void; onCancel: () => void;
}) {
  const { colors } = useSessionTheme();
  const fg = colors.foreground;
  const border = `${fg}22`;
  const [name, setName] = useState(initial?.name ?? "");
  const [command, setCommand] = useState(initial?.command ?? "");
  const [tags, setTags] = useState((initial?.tags ?? []).join(", "));
  const [scopeHost, setScopeHost] = useState(initial ? initial.hostKey !== null : !!hostKey);

  const valid = name.trim() && command.trim();
  const inputStyle: React.CSSProperties = {
    width: "100%", fontSize: 11, color: fg, background: `${fg}0a`, border: `1px solid ${border}`,
    borderRadius: 6, padding: "5px 7px", outline: "none",
  };

  const submit = () => {
    if (!valid) return;
    onSave({
      name: name.trim(),
      command: command.replace(/\s+$/, ""),
      // Editing keeps the snippet's original host when it was host-scoped.
      hostKey: scopeHost ? (initial?.hostKey ?? hostKey) : null,
      tags: parseTags(tags),
    });
  };

  return (
    <div style={{ border: `1px solid ${colors.blue}55`, borderRadius: 9, padding: 9, display: "flex", flexDirection: "column", gap: 7, background: `${colors.blue}0c` }}>
      <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Name (e.g. Restart app)" style={inputStyle} />
      <textarea
        value={command}
        onChange={(e) => setCommand(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) submit(); }}
        placeholder={"Command — use {{name}} or {{name:default}} for values to fill in\ne.g. journalctl -u {{service:nginx}} -n 100"}
        rows={3}
        spellCheck={false}
        style={{ ...inputStyle, fontFamily: "ui-monospace, monospace", resize: "vertical" }}
      />
      <input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="Tags (comma separated, optional)" style={inputStyle} />
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ fontSize: 10, color: `${fg}88` }}>Show on</span>
        <Chip fg={fg} border={border} accent={colors.blue} active={scopeHost} onClick={() => setScopeHost(true)} title={hostKey ?? "No host"}>
          This host
        </Chip>
        <Chip fg={fg} border={border} accent={colors.blue} active={!scopeHost} onClick={() => setScopeHost(false)}>
          All hosts
        </Chip>
      </div>
      <div style={{ fontSize: 9.5, color: `${fg}66` }}>
        Snippets are stored in this browser as plain text — don't put passwords or tokens in them.
      </div>
      <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
        <button onClick={onCancel} style={{ fontSize: 10.5, color: `${fg}aa`, background: "transparent", border: `1px solid ${border}`, borderRadius: 5, padding: "3px 10px", cursor: "pointer" }}>Cancel</button>
        <button
          onClick={submit}
          disabled={!valid || (scopeHost && !hostKey && !initial?.hostKey)}
          style={{ fontSize: 10.5, fontWeight: 600, color: "#fff", background: valid ? colors.green : `${fg}33`, border: "none", borderRadius: 5, padding: "3px 10px", cursor: valid ? "pointer" : "default" }}
        >
          {initial ? "Save" : "Add"}
        </button>
      </div>
    </div>
  );
}

/* ── Placeholder fill-in ───────────────────────────────────── */

function PlaceholderForm({ command, mode, onSend, onCancel }: {
  command: string; mode: Mode; onSend: (cmd: string, mode: Mode) => void; onCancel: () => void;
}) {
  const { colors } = useSessionTheme();
  const fg = colors.foreground;
  const border = `${fg}22`;
  const placeholders = useMemo(() => parsePlaceholders(command), [command]);
  const [values, setValues] = useState<Record<string, string>>(
    () => Object.fromEntries(placeholders.map((p) => [p.name, p.defaultValue])),
  );
  const preview = fillPlaceholders(command, values);
  const ready = placeholders.every((p) => (values[p.name] ?? "").length > 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, borderTop: `1px dashed ${border}`, paddingTop: 6 }}>
      {placeholders.map((p, i) => (
        <label key={p.name} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 10.5, color: `${fg}aa` }}>
          <span style={{ width: 90, flexShrink: 0, fontFamily: "ui-monospace, monospace", overflow: "hidden", textOverflow: "ellipsis" }} title={p.name}>{p.name}</span>
          <input
            autoFocus={i === 0}
            value={values[p.name] ?? ""}
            onChange={(e) => setValues((v) => ({ ...v, [p.name]: e.target.value }))}
            onKeyDown={(e) => { if (e.key === "Enter" && ready) onSend(preview, mode); }}
            placeholder={p.defaultValue || "value"}
            spellCheck={false}
            style={{ flex: 1, minWidth: 0, fontSize: 11, color: fg, background: `${fg}0a`, border: `1px solid ${border}`, borderRadius: 5, padding: "3px 6px", outline: "none", fontFamily: "ui-monospace, monospace" }}
          />
        </label>
      ))}
      <code style={{ fontSize: 10.5, color: colors.green, fontFamily: "ui-monospace, monospace", whiteSpace: "pre-wrap", wordBreak: "break-all", background: `${fg}0a`, borderRadius: 5, padding: "4px 6px" }}>
        $ {preview}
      </code>
      <div style={{ display: "flex", gap: 6 }}>
        <ActionBtn label="Run" icon={<Play size={12} />} disabled={!ready} onClick={() => onSend(preview, "run")} fg={fg} border={border} accent={colors.green} active={mode === "run"} />
        <ActionBtn label="Insert" icon={<TextCursorInput size={12} />} disabled={!ready} onClick={() => onSend(preview, "insert")} fg={fg} border={border} accent={colors.blue} active={mode === "insert"} />
        <ActionBtn label="Cancel" icon={<span />} onClick={onCancel} fg={fg} border={border} accent={fg} />
      </div>
    </div>
  );
}
