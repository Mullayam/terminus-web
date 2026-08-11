import type React from "react";
import { memo, useState } from "react";
import { X, Copy, RotateCw, Share2, Check, ChevronDown, ChevronRight, Trash2, Terminal as TerminalIcon, Sparkles, CornerDownLeft } from "lucide-react";
import { useCommandBlocksStore, type CommandBlock } from "@/store/commandBlocksStore";

interface CommandBlocksProps {
  sessionId: string;
  /** Re-run a command in the live terminal. */
  onRerun: (command: string) => void;
  /** Ask AI to fix a failed command; resolves with the suggested command. */
  onFix: (block: CommandBlock) => Promise<string>;
  /** Insert a suggested command into the live input. */
  onApplyFix: (command: string) => void;
  bg: string;
  fg: string;
  accent: string;
  border: string;
}

const EMPTY: CommandBlock[] = [];

async function copyText(text: string) {
  try { await navigator.clipboard.writeText(text); } catch { /* clipboard blocked */ }
}

const BlockItem = memo(function BlockItem({
  block,
  onRerun,
  onFix,
  onApplyFix,
  bg,
  fg,
  accent,
  border,
}: {
  block: CommandBlock;
  onRerun: (command: string) => void;
  onFix: (block: CommandBlock) => Promise<string>;
  onApplyFix: (command: string) => void;
  bg: string;
  fg: string;
  accent: string;
  border: string;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [copied, setCopied] = useState<null | "cmd" | "all">(null);
  const [fixing, setFixing] = useState(false);
  const [fix, setFix] = useState<string | null>(null);
  const [fixErr, setFixErr] = useState(false);

  const flash = (which: "cmd" | "all") => {
    setCopied(which);
    setTimeout(() => setCopied(null), 1200);
  };

  const runFix = () => {
    setFixing(true);
    setFixErr(false);
    onFix(block)
      .then((cmd) => setFix(cmd || null))
      .catch(() => setFixErr(true))
      .finally(() => setFixing(false));
  };

  const output = block.output.trimEnd();

  return (
    <div style={{ border: `1px solid ${border}`, borderRadius: 8, marginBottom: 8, overflow: "hidden", background: `${fg}06` }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 8px", borderBottom: collapsed ? "none" : `1px solid ${border}` }}>
        <button
          onClick={() => setCollapsed((c) => !c)}
          style={{ display: "flex", alignItems: "center", background: "transparent", border: "none", color: `${fg}99`, cursor: "pointer", padding: 0 }}
          title={collapsed ? "Expand" : "Collapse"}
        >
          {collapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
        </button>
        <span
          style={{
            width: 7, height: 7, borderRadius: "50%", flexShrink: 0,
            background: block.running ? accent : `${fg}44`,
          }}
          title={block.running ? "Running" : "Done"}
        />
        <span
          style={{
            flex: 1, minWidth: 0, fontFamily: "'JetBrains Mono', monospace", fontSize: 12,
            color: fg, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
          }}
          title={block.command}
        >
          {block.command}
        </span>
        <div style={{ display: "flex", gap: 2, flexShrink: 0 }}>
          <IconBtn title={fixing ? "Asking AI…" : "Fix with AI"} fg={fg} accent={accent} onClick={runFix} disabled={fixing}>
            {fixing
              ? <span style={{ width: 12, height: 12, border: `2px solid ${accent}40`, borderTopColor: accent, borderRadius: "50%", animation: "blocksSpin 0.6s linear infinite" }} />
              : <Sparkles size={13} />}
          </IconBtn>
          <IconBtn title="Re-run" fg={fg} accent={accent} onClick={() => onRerun(block.command)}>
            <RotateCw size={13} />
          </IconBtn>
          <IconBtn title="Copy command" fg={fg} accent={accent} onClick={() => { copyText(block.command); flash("cmd"); }}>
            {copied === "cmd" ? <Check size={13} /> : <Copy size={13} />}
          </IconBtn>
          <IconBtn title="Copy command + output" fg={fg} accent={accent} onClick={() => { copyText(`$ ${block.command}\n${output}`); flash("all"); }}>
            {copied === "all" ? <Check size={13} /> : <Share2 size={13} />}
          </IconBtn>
        </div>
      </div>

      {/* AI fix suggestion */}
      {fixErr && (
        <div style={{ padding: "6px 10px", fontSize: 11, color: "#f43f5e", borderBottom: `1px solid ${border}` }}>
          AI unavailable
        </div>
      )}
      {fix && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 10px", background: `${accent}12`, borderBottom: `1px solid ${border}` }}>
          <Sparkles size={12} style={{ color: accent, flexShrink: 0 }} />
          <code style={{ flex: 1, minWidth: 0, fontFamily: "'JetBrains Mono', monospace", fontSize: 11.5, color: fg, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={fix}>
            {fix}
          </code>
          <IconBtn title="Insert into terminal" fg={fg} accent={accent} onClick={() => onApplyFix(fix)}>
            <CornerDownLeft size={13} />
          </IconBtn>
          <IconBtn title="Copy fix" fg={fg} accent={accent} onClick={() => copyText(fix)}>
            <Copy size={13} />
          </IconBtn>
        </div>
      )}

      {/* Output */}
      {!collapsed && output && (
        <pre
          style={{
            margin: 0, padding: "6px 10px", maxHeight: 200, overflow: "auto",
            fontFamily: "'JetBrains Mono', monospace", fontSize: 11.5, lineHeight: 1.5,
            color: `${fg}cc`, background: bg, whiteSpace: "pre-wrap", wordBreak: "break-word",
          }}
        >
          {output}
        </pre>
      )}
    </div>
  );
});

function IconBtn({ children, title, onClick, fg, accent, disabled }: { children: React.ReactNode; title: string; onClick: () => void; fg: string; accent: string; disabled?: boolean; }) {
  return (
    <button
      onClick={onClick}
      title={title}
      disabled={disabled}
      style={{
        display: "flex", alignItems: "center", justifyContent: "center",
        width: 24, height: 24, borderRadius: 5, border: "none", background: "transparent",
        color: `${fg}99`, cursor: disabled ? "default" : "pointer", transition: "background 0.12s, color 0.12s",
      }}
      onMouseEnter={(e) => { if (disabled) return; (e.currentTarget as HTMLElement).style.background = `${accent}22`; (e.currentTarget as HTMLElement).style.color = accent; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; (e.currentTarget as HTMLElement).style.color = `${fg}99`; }}
    >
      {children}
    </button>
  );
}

/**
 * Warp-style command blocks: a launcher button plus a slide-in panel that
 * groups each executed command with its captured output and Copy / Re-run /
 * Share actions. Self-contained so it never re-renders the xterm parent.
 */
const CommandBlocks: React.FC<CommandBlocksProps> = ({ sessionId, onRerun, onFix, onApplyFix, bg, fg, accent, border }) => {
  const blocks = useCommandBlocksStore((s) => s.blocks[sessionId]) ?? EMPTY;
  const open = useCommandBlocksStore((s) => s.open[sessionId] ?? false);
  const togglePanel = useCommandBlocksStore((s) => s.togglePanel);
  const clear = useCommandBlocksStore((s) => s.clear);

  return (
    <>
      {/* Launcher */}
      {!open && (
        <button
          onClick={() => togglePanel(sessionId, true)}
          title="Command blocks"
          style={{
            position: "absolute", right: 12, bottom: 12, zIndex: 25,
            display: "flex", alignItems: "center", gap: 6, padding: "6px 10px",
            borderRadius: 20, border: `1px solid ${border}`, background: `${bg}f2`,
            color: fg, cursor: "pointer", fontSize: 12, boxShadow: "0 4px 16px rgba(0,0,0,0.35)",
            backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)",
          }}
        >
          <TerminalIcon size={14} style={{ color: accent }} />
          Blocks
          {blocks.length > 0 && (
            <span style={{ background: accent, color: bg, borderRadius: 10, padding: "0 6px", fontSize: 10, fontWeight: 700 }}>
              {blocks.length}
            </span>
          )}
        </button>
      )}

      {/* Panel */}
      {open && (
        <div
          style={{
            position: "absolute", top: 0, right: 0, bottom: 0, width: 380, maxWidth: "90%",
            zIndex: 40, display: "flex", flexDirection: "column",
            background: `${bg}f7`, borderLeft: `1px solid ${border}`,
            backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)",
            boxShadow: "-8px 0 32px rgba(0,0,0,0.4)",
            animation: "blocksSlideIn 0.18s ease-out",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", borderBottom: `1px solid ${border}` }}>
            <TerminalIcon size={15} style={{ color: accent }} />
            <span style={{ fontWeight: 600, fontSize: 13, color: fg, flex: 1 }}>Command Blocks</span>
            <span style={{ fontSize: 11, color: `${fg}88` }}>{blocks.length}</span>
            <IconBtn title="Clear all" fg={fg} accent={accent} onClick={() => clear(sessionId)}>
              <Trash2 size={14} />
            </IconBtn>
            <IconBtn title="Close" fg={fg} accent={accent} onClick={() => togglePanel(sessionId, false)}>
              <X size={15} />
            </IconBtn>
          </div>

          <div style={{ flex: 1, overflowY: "auto", padding: 10 }}>
            {blocks.length === 0 ? (
              <div style={{ textAlign: "center", color: `${fg}66`, fontSize: 12, paddingTop: 40 }}>
                No commands yet.<br />Run a command to capture it here.
              </div>
            ) : (
              [...blocks].reverse().map((b) => (
                <BlockItem key={b.id} block={b} onRerun={onRerun} onFix={onFix} onApplyFix={onApplyFix} bg={bg} fg={fg} accent={accent} border={border} />
              ))
            )}
          </div>

          <style>{`@keyframes blocksSlideIn { from { transform: translateX(20px); opacity: 0; } to { transform: translateX(0); opacity: 1; } } @keyframes blocksSpin { to { transform: rotate(360deg); } }`}</style>
        </div>
      )}
    </>
  );
};

export default memo(CommandBlocks);
