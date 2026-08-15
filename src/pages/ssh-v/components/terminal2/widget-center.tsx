import { useEffect, useState } from "react";
import {
  ArrowLeft,
  Boxes,
  Eye,
  EyeOff,
  Pencil,
  Plus,
  Save,
  Trash2,
} from "lucide-react";
import { useSessionTheme } from "@/hooks/useSessionTheme";
import { useWidgetStore } from "@/store/widgetStore";
import type { WidgetDef, WidgetRender } from "@/lib/widgets/types";
import { REFRESH_OPTIONS, WIDGET_ACCENTS, WIDGET_TEMPLATE } from "@/lib/widgets/types";

interface FormState {
  name: string;
  description: string;
  command: string;
  refreshMs: number;
  render: WidgetRender;
  delimiter: string;
  columns: string;
  maxRows: number;
  accent: string;
}

function defToForm(d: WidgetDef): FormState {
  return {
    name: d.name,
    description: d.description ?? "",
    command: d.command,
    refreshMs: d.refreshMs,
    render: d.render,
    delimiter: d.delimiter ?? "",
    columns: (d.columns ?? []).join(", "),
    maxRows: d.maxRows ?? 20,
    accent: d.accent ?? "cyan",
  };
}

const EMPTY_FORM: FormState = {
  name: WIDGET_TEMPLATE.name,
  description: WIDGET_TEMPLATE.description ?? "",
  command: WIDGET_TEMPLATE.command,
  refreshMs: WIDGET_TEMPLATE.refreshMs,
  render: WIDGET_TEMPLATE.render,
  delimiter: WIDGET_TEMPLATE.delimiter ?? "",
  columns: (WIDGET_TEMPLATE.columns ?? []).join(", "),
  maxRows: WIDGET_TEMPLATE.maxRows ?? 20,
  accent: WIDGET_TEMPLATE.accent ?? "cyan",
};

export default function WidgetCenter() {
  const { colors } = useSessionTheme();
  const { defs, openIds, load, addWidget, updateWidget, removeWidget, toggleOpen } = useWidgetStore();

  const [mode, setMode] = useState<"list" | "form">("list");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);

  useEffect(() => { load(); }, [load]);

  const fg = colors.foreground;
  const border = `${fg}22`;
  const inputStyle: React.CSSProperties = {
    width: "100%", background: `${fg}0d`, border: `1px solid ${border}`, borderRadius: 6,
    padding: "6px 8px", color: fg, fontSize: 12, outline: "none",
  };
  const labelStyle: React.CSSProperties = { fontSize: 11, color: `${fg}99`, fontWeight: 500, marginBottom: 4, display: "block" };

  const startAdd = () => { setEditingId(null); setForm(EMPTY_FORM); setMode("form"); };
  const startEdit = (d: WidgetDef) => { setEditingId(d.id); setForm(defToForm(d)); setMode("form"); };

  const save = async () => {
    const payload = {
      name: form.name.trim() || "Untitled",
      description: form.description.trim(),
      command: form.command.trim(),
      refreshMs: form.refreshMs,
      render: form.render,
      delimiter: form.delimiter,
      columns: form.columns.split(",").map((c) => c.trim()).filter(Boolean),
      maxRows: form.maxRows,
      accent: form.accent,
      builtin: false,
    };
    if (editingId) {
      await updateWidget(editingId, payload);
    } else {
      await addWidget(payload);
    }
    setMode("list");
  };

  const del = async (d: WidgetDef) => {
    if (!window.confirm(`Delete widget “${d.name}”?`)) return;
    await removeWidget(d.id);
  };

  if (mode === "form") {
    const canSave = form.name.trim().length > 0 && form.command.trim().length > 0;
    return (
      <div className="space-y-4 px-2" style={{ color: `${fg}dd` }}>
        <div className="flex items-center gap-2">
          <button onClick={() => setMode("list")} style={{ display: "flex", background: "transparent", border: "none", color: `${fg}aa`, cursor: "pointer", padding: 2 }} title="Back">
            <ArrowLeft size={16} />
          </button>
          <h3 className="text-base font-semibold" style={{ color: fg }}>{editingId ? "Edit Widget" : "New Widget"}</h3>
        </div>

        <div>
          <label style={labelStyle}>Name</label>
          <input style={inputStyle} value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="e.g. Nginx status" />
        </div>

        <div>
          <label style={labelStyle}>Description</label>
          <input style={inputStyle} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder="Optional" />
        </div>

        <div>
          <label style={labelStyle}>Command</label>
          <textarea style={{ ...inputStyle, minHeight: 64, fontFamily: "ui-monospace, monospace", resize: "vertical" }} value={form.command} onChange={(e) => setForm((f) => ({ ...f, command: e.target.value }))} placeholder="systemctl status nginx --no-pager" />
          <p style={{ fontSize: 10, color: `${fg}66`, marginTop: 4 }}>Runs silently over SSH. Keep it bounded (e.g. pipe to <code>head</code>).</p>
        </div>

        <div className="flex gap-2">
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>Refresh</label>
            <select style={inputStyle} value={form.refreshMs} onChange={(e) => setForm((f) => ({ ...f, refreshMs: Number(e.target.value) }))}>
              {REFRESH_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>Render</label>
            <select style={inputStyle} value={form.render} onChange={(e) => setForm((f) => ({ ...f, render: e.target.value as WidgetRender }))}>
              <option value="raw">Raw text</option>
              <option value="table">Table</option>
            </select>
          </div>
        </div>

        {form.render === "table" && (
          <div className="space-y-3" style={{ borderLeft: `2px solid ${border}`, paddingLeft: 10 }}>
            <div>
              <label style={labelStyle}>Column headers (comma-separated)</label>
              <input style={inputStyle} value={form.columns} onChange={(e) => setForm((f) => ({ ...f, columns: e.target.value }))} placeholder="PID, CPU%, Command" />
            </div>
            <div className="flex gap-2">
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Delimiter</label>
                <input style={inputStyle} value={form.delimiter} onChange={(e) => setForm((f) => ({ ...f, delimiter: e.target.value }))} placeholder="blank = whitespace" />
              </div>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Max rows</label>
                <input type="number" min={1} style={inputStyle} value={form.maxRows} onChange={(e) => setForm((f) => ({ ...f, maxRows: Number(e.target.value) || 20 }))} />
              </div>
            </div>
          </div>
        )}

        <div>
          <label style={labelStyle}>Accent</label>
          <div className="flex gap-2">
            {WIDGET_ACCENTS.map((a) => {
              const c = (colors as Record<string, string>)[a] ?? colors.cyan;
              const active = form.accent === a;
              return (
                <button key={a} onClick={() => setForm((f) => ({ ...f, accent: a }))} title={a}
                  style={{ width: 22, height: 22, borderRadius: "50%", background: c, border: active ? `2px solid ${fg}` : `2px solid transparent`, cursor: "pointer" }} />
              );
            })}
          </div>
        </div>

        <div className="flex gap-2 pt-1">
          <button onClick={save} disabled={!canSave}
            style={{ flex: 1, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6, fontSize: 12, fontWeight: 600, color: canSave ? "#fff" : `${fg}55`, background: canSave ? (colors.blue ?? colors.cyan) : `${fg}18`, border: "none", borderRadius: 7, padding: "8px", cursor: canSave ? "pointer" : "default" }}>
            <Save size={14} /> {editingId ? "Update" : "Create"}
          </button>
          <button onClick={() => setMode("list")}
            style={{ fontSize: 12, color: `${fg}aa`, background: "transparent", border: `1px solid ${border}`, borderRadius: 7, padding: "8px 14px", cursor: "pointer" }}>
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 px-2" style={{ color: `${fg}dd` }}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-lg font-semibold" style={{ color: fg }}>Widget Center</h3>
          <p className="text-sm" style={{ color: `${fg}80` }}>Live command panels for this session</p>
        </div>
        <button onClick={startAdd}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border text-xs transition-colors shrink-0 hover:opacity-80"
          style={{ borderColor: `${fg}30`, color: fg, backgroundColor: `${fg}10` }}>
          <Plus size={14} /> Add
        </button>
      </div>

      <div className="space-y-2">
        {defs.length === 0 && (
          <div style={{ fontSize: 12, color: `${fg}88`, textAlign: "center", padding: "20px 0" }}>No widgets yet.</div>
        )}
        {defs.map((d) => {
          const isOpen = openIds.includes(d.id);
          const accent = (colors as Record<string, string>)[d.accent ?? "cyan"] ?? colors.cyan;
          return (
            <div key={d.id} className="flex items-center gap-2.5 rounded-md p-2.5" style={{ backgroundColor: `${fg}0d`, border: `1px solid ${isOpen ? accent + "66" : border}` }}>
              <span className="shrink-0" style={{ color: accent }}><Boxes size={16} /></span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <p className="text-xs font-medium truncate" style={{ color: fg }}>{d.name}</p>
                  {d.builtin && <span style={{ fontSize: 8.5, color: `${fg}77`, border: `1px solid ${border}`, borderRadius: 4, padding: "0 4px" }}>prebuilt</span>}
                </div>
                <p className="truncate text-[11px]" style={{ color: `${fg}80` }}>{d.description || d.command}</p>
              </div>
              <button onClick={() => toggleOpen(d.id)} title={isOpen ? "Close panel" : "Open panel"}
                style={{ display: "flex", background: "transparent", border: "none", color: isOpen ? accent : `${fg}88`, cursor: "pointer", padding: 3 }}>
                {isOpen ? <Eye size={15} /> : <EyeOff size={15} />}
              </button>
              <button onClick={() => startEdit(d)} title="Edit"
                style={{ display: "flex", background: "transparent", border: "none", color: `${fg}88`, cursor: "pointer", padding: 3 }}>
                <Pencil size={14} />
              </button>
              <button onClick={() => del(d)} title="Delete"
                style={{ display: "flex", background: "transparent", border: "none", color: colors.red, cursor: "pointer", padding: 3 }}>
                <Trash2 size={14} />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
