import { useEffect, useState } from "react";
import {
  ArrowLeft,
  Box,
  Boxes,
  Container as ContainerIcon,
  Eye,
  EyeOff,
  LayoutGrid,
  Pencil,
  Plus,
  Save,
  Trash2,
} from "lucide-react";
import { useSessionTheme } from "@/hooks/useSessionTheme";
import { useWidgetStore } from "@/store/widgetStore";
import { useDockerStore } from "@/store/dockerStore";
import { useKubernetesStore } from "@/store/kubernetesStore";
import type { WidgetDef, WidgetRender, WidgetAlert } from "@/lib/widgets/types";
import { REFRESH_OPTIONS, RENDER_OPTIONS, WIDGET_ACCENTS, WIDGET_TEMPLATE } from "@/lib/widgets/types";

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
  stream: boolean;
  valuePattern: string;
  gaugeMax: number;
  unit: string;
  alertEnabled: boolean;
  alertOp: WidgetAlert["op"];
  alertValue: number;
  alertPattern: string;
  alertNotify: boolean;
  alertSound: boolean;
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
    stream: !!d.stream,
    valuePattern: d.valuePattern ?? "",
    gaugeMax: d.gaugeMax ?? 100,
    unit: d.unit ?? "",
    alertEnabled: !!d.alert,
    alertOp: d.alert?.op ?? ">",
    alertValue: d.alert?.value ?? 0,
    alertPattern: d.alert?.pattern ?? "",
    alertNotify: d.alert?.notify ?? false,
    alertSound: d.alert?.sound ?? false,
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
  stream: false,
  valuePattern: "",
  gaugeMax: 100,
  unit: "",
  alertEnabled: false,
  alertOp: ">",
  alertValue: 0,
  alertPattern: "",
  alertNotify: false,
  alertSound: false,
};

export default function WidgetCenter() {
  const { colors } = useSessionTheme();
  const { defs, openIds, load, addWidget, updateWidget, removeWidget, toggleOpen, dashboard, toggleDashboard } = useWidgetStore();
  const isDockerOpen = useDockerStore((s) => s.isOpen);
  const toggleDocker = useDockerStore((s) => s.toggle);
  const isK8sOpen = useKubernetesStore((s) => s.isOpen);
  const toggleK8s = useKubernetesStore((s) => s.toggle);

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
  // Theme the native dropdown so the option list matches the terminal theme instead of rendering white.
  const isDarkBg = (() => {
    const hex = (colors.background || "").replace("#", "");
    if (hex.length < 6) return true;
    const r = parseInt(hex.slice(0, 2), 16), g = parseInt(hex.slice(2, 4), 16), b = parseInt(hex.slice(4, 6), 16);
    return 0.299 * r + 0.587 * g + 0.114 * b < 128;
  })();
  const selectStyle: React.CSSProperties = { ...inputStyle, colorScheme: isDarkBg ? "dark" : "light" };
  const optionStyle: React.CSSProperties = { background: colors.background, color: fg };

  const startAdd = () => { setEditingId(null); setForm(EMPTY_FORM); setMode("form"); };
  const startEdit = (d: WidgetDef) => { setEditingId(d.id); setForm(defToForm(d)); setMode("form"); };

  const save = async () => {
    const alert: WidgetAlert | undefined = form.alertEnabled
      ? {
          op: form.alertOp,
          value: form.alertOp === "match" ? undefined : form.alertValue,
          pattern: form.alertOp === "match" ? form.alertPattern.trim() : undefined,
          notify: form.alertNotify,
          sound: form.alertSound,
        }
      : undefined;
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
      stream: form.stream,
      valuePattern: form.valuePattern.trim(),
      gaugeMax: form.gaugeMax,
      unit: form.unit.trim(),
      alert,
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
      <div className="space-y-4 px-4 pt-4 pb-6" style={{ color: `${fg}dd` }}>
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
            <select style={selectStyle} value={form.refreshMs} onChange={(e) => setForm((f) => ({ ...f, refreshMs: Number(e.target.value) }))}>
              {REFRESH_OPTIONS.map((o) => <option key={o.value} value={o.value} style={optionStyle}>{o.label}</option>)}
            </select>
          </div>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>Render</label>
            <select style={selectStyle} value={form.render} onChange={(e) => setForm((f) => ({ ...f, render: e.target.value as WidgetRender }))}>
              {RENDER_OPTIONS.map((o) => <option key={o.value} value={o.value} style={optionStyle}>{o.label}</option>)}
            </select>
          </div>
        </div>

        <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 12, color: `${fg}cc` }}>
          <input type="checkbox" checked={form.stream} onChange={(e) => setForm((f) => ({ ...f, stream: e.target.checked }))} />
          <span>Log / tail mode (auto-scroll to newest)</span>
        </label>
        {form.stream && <p style={{ fontSize: 10, color: `${fg}66`, marginTop: -6 }}>Polls a bounded snapshot each refresh and auto-scrolls. Use <code>--tail</code>/<code>-n</code> (e.g. <code>docker logs --tail 200 web</code>, <code>tail -n 200 /var/log/syslog</code>) — avoid <code>-f</code>, it never returns.</p>}

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

        {(form.render === "sparkline" || form.render === "gauge") && (
          <div className="space-y-3" style={{ borderLeft: `2px solid ${border}`, paddingLeft: 10 }}>
            <div>
              <label style={labelStyle}>Value regex (optional)</label>
              <input style={inputStyle} value={form.valuePattern} onChange={(e) => setForm((f) => ({ ...f, valuePattern: e.target.value }))} placeholder="e.g. (\d+(?:\.\d+)?)%  — blank = first number" />
              <p style={{ fontSize: 10, color: `${fg}66`, marginTop: 4 }}>First capture group (or whole match) is parsed as the number to plot.</p>
            </div>
            <div className="flex gap-2">
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Unit</label>
                <input style={inputStyle} value={form.unit} onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))} placeholder="% , MB, req/s" />
              </div>
              {form.render === "gauge" && (
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Gauge max</label>
                  <input type="number" min={1} style={inputStyle} value={form.gaugeMax} onChange={(e) => setForm((f) => ({ ...f, gaugeMax: Number(e.target.value) || 100 }))} />
                </div>
              )}
            </div>
          </div>
        )}

        <div className="space-y-3" style={{ borderLeft: `2px solid ${border}`, paddingLeft: 10 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 12, color: `${fg}cc`, fontWeight: 600 }}>
            <input type="checkbox" checked={form.alertEnabled} onChange={(e) => setForm((f) => ({ ...f, alertEnabled: e.target.checked }))} />
            Threshold alert
          </label>
          {form.alertEnabled && (
            <>
              <div className="flex gap-2">
                <div style={{ width: 96 }}>
                  <label style={labelStyle}>Condition</label>
                  <select style={selectStyle} value={form.alertOp} onChange={(e) => setForm((f) => ({ ...f, alertOp: e.target.value as WidgetAlert["op"] }))}>
                    <option value=">" style={optionStyle}>value &gt;</option>
                    <option value="<" style={optionStyle}>value &lt;</option>
                    <option value=">=" style={optionStyle}>value ≥</option>
                    <option value="<=" style={optionStyle}>value ≤</option>
                    <option value="==" style={optionStyle}>value =</option>
                    <option value="match" style={optionStyle}>matches</option>
                  </select>
                </div>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>{form.alertOp === "match" ? "Regex" : "Value"}</label>
                  {form.alertOp === "match" ? (
                    <input style={inputStyle} value={form.alertPattern} onChange={(e) => setForm((f) => ({ ...f, alertPattern: e.target.value }))} placeholder="error|fail|denied" />
                  ) : (
                    <input type="number" style={inputStyle} value={form.alertValue} onChange={(e) => setForm((f) => ({ ...f, alertValue: Number(e.target.value) || 0 }))} placeholder="90" />
                  )}
                </div>
              </div>
              <div className="flex gap-4">
                <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 11, color: `${fg}bb` }}>
                  <input type="checkbox" checked={form.alertNotify} onChange={(e) => setForm((f) => ({ ...f, alertNotify: e.target.checked }))} />
                  Desktop notification
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 11, color: `${fg}bb` }}>
                  <input type="checkbox" checked={form.alertSound} onChange={(e) => setForm((f) => ({ ...f, alertSound: e.target.checked }))} />
                  Sound
                </label>
              </div>
              <p style={{ fontSize: 10, color: `${fg}66` }}>Numeric conditions compare the extracted value (see Value regex). The panel flashes red when tripped.</p>
            </>
          )}
        </div>


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
    <div className="space-y-4 px-4 pt-4 pb-6" style={{ color: `${fg}dd` }}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-lg font-semibold" style={{ color: fg }}>Widget Center</h3>
          <p className="text-sm" style={{ color: `${fg}80` }}>Live command panels for this session</p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <button onClick={toggleDashboard} title={dashboard ? "Exit dashboard" : "Dashboard grid"}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border text-xs transition-colors hover:opacity-80"
            style={{ borderColor: dashboard ? `${colors.cyan}66` : `${fg}30`, color: dashboard ? colors.cyan : fg, backgroundColor: dashboard ? `${colors.cyan}18` : `${fg}10` }}>
            <LayoutGrid size={14} /> Grid
          </button>
          <button onClick={startAdd}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border text-xs transition-colors hover:opacity-80"
            style={{ borderColor: `${fg}30`, color: fg, backgroundColor: `${fg}10` }}>
            <Plus size={14} /> Add
          </button>
        </div>
      </div>

      {/* Built-in infrastructure panels */}
      <BuiltInPanelRow
        label="Docker" description="Containers, stats, start/stop/restart"
        icon={<ContainerIcon size={16} />}
        accentColor={colors.blue ?? colors.cyan}
        isOpen={isDockerOpen}
        onToggle={toggleDocker}
        fg={fg} border={border}
      />
      <BuiltInPanelRow
        label="Kubernetes" description="Pods, logs, describe, scale, exec"
        icon={<Box size={16} />}
        accentColor={colors.magenta ?? colors.blue}
        isOpen={isK8sOpen}
        onToggle={toggleK8s}
        fg={fg} border={border}
      />

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

/* ── Built-in infrastructure panel toggle row ────────────────────── */

function BuiltInPanelRow({
  label, description, icon, accentColor, isOpen, onToggle, fg, border,
}: {
  label: string; description: string; icon: React.ReactNode;
  accentColor: string; isOpen: boolean; onToggle: () => void;
  fg: string; border: string;
}) {
  return (
    <div
      className="flex items-center gap-2.5 rounded-md p-2.5 cursor-pointer"
      style={{
        backgroundColor: `${fg}0d`,
        border: `1px solid ${isOpen ? accentColor + "66" : border}`,
      }}
      onClick={onToggle}
    >
      <span className="shrink-0" style={{ color: accentColor }}>{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium truncate" style={{ color: fg }}>{label}</p>
        <p className="truncate text-[11px]" style={{ color: `${fg}80` }}>{description}</p>
      </div>
      <span
        style={{
          fontSize: 9, fontWeight: 600, padding: "2px 6px", borderRadius: 4,
          color: isOpen ? accentColor : `${fg}66`,
          background: isOpen ? `${accentColor}18` : `${fg}0a`,
          border: `1px solid ${isOpen ? accentColor + "44" : border}`,
        }}
      >
        {isOpen ? "ON" : "OFF"}
      </span>
    </div>
  );
}
