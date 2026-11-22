import { useRef, useState } from "react";
import { X } from "lucide-react";
import { useSessionTheme } from "@/hooks/useSessionTheme";
import { IconBtn } from "./widget-parts";

/**
 * Draggable floating shell shared by the terminal's infrastructure widgets
 * (logs, services, ports, cron, …): themed card, drag-by-header, close button,
 * optional footer. Children fill a flex column — give the scrolling part
 * `flex: 1; minHeight: 0; overflow: auto` yourself.
 */
export interface FloatingPanelProps {
  title: string;
  icon: React.ReactNode;
  /** Small muted text next to the title (host, counts, …). */
  subtitle?: React.ReactNode;
  /** Extra header buttons, rendered before the close button. */
  actions?: React.ReactNode;
  footer?: React.ReactNode;
  onClose: () => void;
  width?: number;
  maxHeight?: string;
  /** Initial distance from the right / top edge, so panels don't stack exactly. */
  offset?: { right: number; top: number };
  children: React.ReactNode;
}

export function FloatingPanel({
  title, icon, subtitle, actions, footer, onClose,
  width = 400, maxHeight = "80vh", offset = { right: 20, top: 72 }, children,
}: FloatingPanelProps) {
  const { colors } = useSessionTheme();
  const [pos, setPos] = useState(() => ({ x: Math.max(12, window.innerWidth - width - offset.right), y: offset.top }));
  const dragRef = useRef<{ dx: number; dy: number } | null>(null);

  const fg = colors.foreground;
  const border = `${fg}22`;
  const w = Math.min(width, window.innerWidth - 16);
  const left = Math.max(0, Math.min(pos.x, window.innerWidth - w - 8));

  const onPointerDown = (e: React.PointerEvent) => {
    dragRef.current = { dx: e.clientX - pos.x, dy: e.clientY - pos.y };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current) return;
    setPos({
      x: Math.min(window.innerWidth - 60, Math.max(0, e.clientX - dragRef.current.dx)),
      y: Math.min(window.innerHeight - 40, Math.max(0, e.clientY - dragRef.current.dy)),
    });
  };
  const onPointerUp = (e: React.PointerEvent) => {
    dragRef.current = null;
    try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId); } catch { /* ignore */ }
  };

  return (
    <div
      style={{
        position: "fixed", left, top: pos.y, zIndex: 50,
        width: w, maxHeight, borderRadius: 12,
        background: `${colors.background}f2`, border: `1px solid ${border}`,
        boxShadow: "0 18px 48px rgba(0,0,0,0.45)",
        backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)",
        fontFamily: "'Inter', system-ui, sans-serif",
        overflow: "hidden", display: "flex", flexDirection: "column",
        transition: "width 0.18s ease",
      }}
    >
      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 12px", borderBottom: `1px solid ${border}`, cursor: "move", userSelect: "none", flexShrink: 0 }}
      >
        <span style={{ display: "flex", color: colors.blue }}>{icon}</span>
        <span style={{ fontSize: 12.5, fontWeight: 600, color: fg, whiteSpace: "nowrap" }}>{title}</span>
        {subtitle && (
          <span style={{ fontSize: 10, color: `${fg}66`, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 }}>{subtitle}</span>
        )}
        <div style={{ flex: 1 }} />
        {actions}
        <IconBtn fg={fg} title="Close" onClick={onClose}><X size={15} /></IconBtn>
      </div>

      {children}

      {footer && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 10, color: `${fg}55`, padding: "6px 12px", borderTop: `1px solid ${border}`, flexShrink: 0 }}>
          {footer}
        </div>
      )}

      <style>{`
        @keyframes fpSpin { to { transform: rotate(360deg); } }
        @keyframes fpPulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.35; } }
      `}</style>
    </div>
  );
}

/** Centered muted message for empty / loading / unsupported states. */
export function PanelMessage({ icon, children, tone }: { icon?: React.ReactNode; children: React.ReactNode; tone?: "error" }) {
  const { colors } = useSessionTheme();
  const fg = colors.foreground;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, fontSize: 11.5, color: tone === "error" ? colors.red : `${fg}88`, padding: "18px 12px", textAlign: "center" }}>
      {icon}
      <div style={{ color: tone === "error" ? `${fg}aa` : undefined }}>{children}</div>
    </div>
  );
}
