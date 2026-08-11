import type React from "react";
import { useMemo, useState } from "react";
import { X, Copy, Check, Eye, Users, Link2 } from "lucide-react";

interface ShareSessionDialogProps {
  sessionId: string;
  onClose: () => void;
  bg: string;
  fg: string;
  accent: string;
  border: string;
}

function LinkRow({ label, icon, desc, url, fg, accent, border }: { label: string; icon: React.ReactNode; desc: string; url: string; fg: string; accent: string; border: string; }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }).catch(() => {});
  };
  return (
    <div style={{ border: `1px solid ${border}`, borderRadius: 10, padding: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
        <span style={{ color: accent, display: "flex" }}>{icon}</span>
        <span style={{ fontWeight: 600, fontSize: 13, color: fg }}>{label}</span>
      </div>
      <div style={{ fontSize: 11, color: `${fg}88`, marginBottom: 8 }}>{desc}</div>
      <div style={{ display: "flex", gap: 6 }}>
        <input
          readOnly
          value={url}
          onFocus={(e) => e.currentTarget.select()}
          style={{
            flex: 1, minWidth: 0, background: `${fg}0d`, border: `1px solid ${border}`, borderRadius: 6,
            padding: "6px 8px", color: fg, fontSize: 12, fontFamily: "monospace", outline: "none",
          }}
        />
        <button
          onClick={copy}
          style={{
            display: "inline-flex", alignItems: "center", gap: 5, padding: "6px 10px", borderRadius: 6,
            border: `1px solid ${copied ? accent : border}`, background: copied ? `${accent}20` : "transparent",
            color: copied ? accent : fg, cursor: "pointer", fontSize: 12, flexShrink: 0,
          }}
        >
          {copied ? <Check size={13} /> : <Copy size={13} />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
    </div>
  );
}

/**
 * Generates shareable links for the current session: a read-only spectator
 * link and a full collaborative link (both open the collab terminal room).
 */
const ShareSessionDialog: React.FC<ShareSessionDialogProps> = ({ sessionId, onClose, bg, fg, accent, border }) => {
  const { spectatorUrl, collabUrl } = useMemo(() => {
    const base = `${window.location.origin}/collab/terminal/${encodeURIComponent(sessionId)}`;
    return { spectatorUrl: `${base}?spectator=1`, collabUrl: base };
  }, [sessionId]);

  return (
    <div
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: "absolute", inset: 0, zIndex: 60,
        display: "flex", alignItems: "center", justifyContent: "center",
        background: "rgba(0,0,0,0.4)",
      }}
    >
      <div
        style={{
          width: 520, maxWidth: "92%", background: `${bg}f7`, border: `1px solid ${border}`,
          borderRadius: 12, boxShadow: "0 24px 64px rgba(0,0,0,0.5)", overflow: "hidden",
          backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)",
          fontFamily: "'Inter', system-ui, sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "12px 14px", borderBottom: `1px solid ${border}` }}>
          <Link2 size={16} style={{ color: accent }} />
          <span style={{ flex: 1, fontWeight: 600, fontSize: 14, color: fg }}>Share session</span>
          <button onClick={onClose} title="Close (Esc)" style={{ display: "flex", background: "transparent", border: "none", color: `${fg}88`, cursor: "pointer", padding: 2 }}>
            <X size={16} />
          </button>
        </div>

        <div style={{ padding: 14, display: "flex", flexDirection: "column", gap: 12 }}>
          <LinkRow
            label="Read-only spectator link"
            icon={<Eye size={14} />}
            desc="Anyone with this link can watch the live session but cannot type."
            url={spectatorUrl}
            fg={fg} accent={accent} border={border}
          />
          <LinkRow
            label="Collaborative link"
            icon={<Users size={14} />}
            desc="Participants can request control (subject to the session's permission settings)."
            url={collabUrl}
            fg={fg} accent={accent} border={border}
          />
          <div style={{ fontSize: 11, color: `${fg}66`, lineHeight: 1.5 }}>
            Links open the collaborative terminal room for this session. Sharing requires the
            server to broadcast this session to the collab room.
          </div>
        </div>
      </div>
    </div>
  );
};

export default ShareSessionDialog;
