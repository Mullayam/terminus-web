import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, MoreHorizontal } from "lucide-react";

/* Small building blocks shared by the floating infrastructure widgets. */

export function IconBtn({ fg, title, onClick, disabled, children }: { fg: string; title: string; onClick: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button
      onPointerDown={(e) => e.stopPropagation()}
      onClick={onClick}
      title={title}
      disabled={disabled}
      style={{ display: "flex", background: "transparent", border: "none", color: disabled ? `${fg}44` : `${fg}99`, cursor: disabled ? "default" : "pointer", padding: 3, borderRadius: 4 }}
      onMouseEnter={(e) => { if (!disabled) e.currentTarget.style.background = `${fg}14`; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
    >
      {children}
    </button>
  );
}

export function Chip({ fg, border, accent, active, onClick, title, children }: {
  fg: string; border: string; accent: string; active: boolean; onClick: () => void; title?: string; children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        display: "inline-flex", alignItems: "center", gap: 4, whiteSpace: "nowrap",
        fontSize: 10, color: active ? fg : `${fg}88`,
        background: active ? `${accent}22` : "transparent",
        border: `1px solid ${active ? `${accent}77` : border}`, borderRadius: 5,
        padding: "3px 7px", cursor: "pointer",
      }}
    >
      {children}
    </button>
  );
}

/** Themed text input with a leading icon (search boxes, path fields). */
export function SearchInput({ value, onChange, placeholder, fg, border, icon, onEnter, autoFocus }: {
  value: string; onChange: (v: string) => void; placeholder: string; fg: string; border: string;
  icon?: React.ReactNode; onEnter?: () => void; autoFocus?: boolean;
}) {
  return (
    <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 6, border: `1px solid ${border}`, borderRadius: 6, padding: "3px 7px", minWidth: 0 }}>
      {icon && <span style={{ display: "flex", color: `${fg}66`, flexShrink: 0 }}>{icon}</span>}
      <input
        value={value}
        autoFocus={autoFocus}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") onEnter?.(); }}
        placeholder={placeholder}
        spellCheck={false}
        style={{ flex: 1, minWidth: 0, fontSize: 11, color: fg, background: "transparent", border: "none", outline: "none" }}
      />
    </div>
  );
}

export function ConfirmBar({
  text, fg, border, red, inline, onYes, onNo,
}: {
  text: string; fg: string; border: string; red: string; inline?: boolean;
  onYes: () => void; onNo: () => void;
}) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: fg,
      background: `${red}18`, borderRadius: 6,
      padding: inline ? "5px 7px" : "6px 12px",
      margin: inline ? undefined : "8px 12px",
    }}>
      <AlertTriangle size={13} style={{ color: red, flexShrink: 0 }} />
      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{text}</span>
      <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
        <button onClick={onYes} style={{ fontSize: 10.5, fontWeight: 600, color: "#fff", background: red, border: "none", borderRadius: 5, padding: "3px 8px", cursor: "pointer" }}>Yes</button>
        <button onClick={onNo} style={{ fontSize: 10.5, color: `${fg}aa`, background: "transparent", border: `1px solid ${border}`, borderRadius: 5, padding: "3px 8px", cursor: "pointer" }}>No</button>
      </div>
    </div>
  );
}

export interface ActionBtnProps {
  label: string;
  icon: React.ReactNode;
  accent: string;
  fg: string;
  border: string;
  disabled?: boolean;
  active?: boolean;
  onClick: () => void;
}

export function ActionBtn({ label, icon, accent, fg, border, disabled, active, onClick }: ActionBtnProps) {
  const restBg = active ? `${accent}18` : "transparent";
  const restBorder = active ? `${accent}66` : border;
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        flex: 1, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 4,
        fontSize: 10.5, fontWeight: 500, color: disabled ? `${fg}55` : fg,
        background: restBg, border: `1px solid ${restBorder}`, borderRadius: 6,
        padding: "4px 6px", cursor: disabled ? "default" : "pointer",
        transition: "background 0.15s, border-color 0.15s",
      }}
      onMouseEnter={(e) => { if (!disabled) { e.currentTarget.style.background = `${accent}18`; e.currentTarget.style.borderColor = `${accent}66`; } }}
      onMouseLeave={(e) => { e.currentTarget.style.background = restBg; e.currentTarget.style.borderColor = restBorder; }}
    >
      <span style={{ color: accent, display: "flex" }}>{icon}</span>{label}
    </button>
  );
}

export interface MenuItem {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
}

/**
 * Rendered through a portal: the widget's `backdrop-filter` makes it a containing
 * block for fixed children, so an inline popup would be positioned against the
 * widget and clipped by its `overflow: hidden`.
 */
export function MoreMenu({ items, fg, bg, border, disabled }: { items: MenuItem[]; fg: string; bg: string; border: string; disabled?: boolean }) {
  const [anchor, setAnchor] = useState<{ x: number; y: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!anchor) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (menuRef.current?.contains(t) || btnRef.current?.contains(t)) return;
      setAnchor(null);
    };
    const close = () => setAnchor(null);
    window.addEventListener("mousedown", onDown);
    window.addEventListener("resize", close);
    window.addEventListener("scroll", close, true);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("resize", close);
      window.removeEventListener("scroll", close, true);
    };
  }, [anchor]);

  const open = () => {
    const r = btnRef.current?.getBoundingClientRect();
    if (!r) return;
    const height = Math.min(items.length * 27 + 8, 320);
    const y = r.bottom + height > window.innerHeight ? Math.max(8, r.top - height - 4) : r.bottom + 4;
    setAnchor({ x: Math.max(8, Math.min(r.right - 190, window.innerWidth - 198)), y });
  };

  return (
    <>
      <button
        ref={btnRef}
        disabled={disabled}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={() => (anchor ? setAnchor(null) : open())}
        title="More actions"
        style={{
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          width: 26, flexShrink: 0, color: disabled ? `${fg}55` : `${fg}aa`,
          background: "transparent", border: `1px solid ${border}`, borderRadius: 6,
          padding: "4px 0", cursor: disabled ? "default" : "pointer",
        }}
      >
        <MoreHorizontal size={13} />
      </button>
      {anchor && createPortal(
        <div
          ref={menuRef}
          style={{
            position: "fixed", left: anchor.x, top: anchor.y, zIndex: 2000, width: 190,
            background: `${bg}fa`, border: `1px solid ${border}`, borderRadius: 8,
            boxShadow: "0 12px 32px rgba(0,0,0,0.45)", padding: 4,
            backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)",
            maxHeight: 320, overflowY: "auto",
            fontFamily: "'Inter', system-ui, sans-serif",
          }}
          className="scrollbar-green"
        >
          {items.map((item) => (
            <button
              key={item.label}
              disabled={item.disabled}
              onClick={() => { setAnchor(null); item.onClick(); }}
              style={{
                display: "flex", alignItems: "center", gap: 7, width: "100%",
                fontSize: 11, textAlign: "left", color: item.disabled ? `${fg}44` : item.danger ? "#f87171" : fg,
                background: "transparent", border: "none", borderRadius: 5,
                padding: "5px 7px", cursor: item.disabled ? "default" : "pointer",
              }}
              onMouseEnter={(e) => { if (!item.disabled) e.currentTarget.style.background = `${fg}12`; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
            >
              <span style={{ display: "flex", opacity: 0.8 }}>{item.icon}</span>{item.label}
            </button>
          ))}
        </div>,
        document.body,
      )}
    </>
  );
}
