import { useEffect, useRef, useState, useCallback } from "react";
import {
  AlertTriangle,
  Box,
  ChevronDown,
  FileText,
  Image as ImageIcon,
  Pause,
  Play,
  RefreshCw,
  RotateCcw,
  Scale,
  Search,
  Square,
  Terminal,
  Trash2,
  X,
} from "lucide-react";
import { useSSHStore } from "@/store/sshStore";
import { useSessionTheme } from "@/hooks/useSessionTheme";
import { useKubernetesStore } from "@/store/kubernetesStore";
import { SocketEventConstants } from "@/lib/sockets/event-constants";

/* ── kubectl commands ─────────────────────────────────────────────── */

const LIST_CMD = (ns: string) =>
  `if ! command -v kubectl >/dev/null 2>&1; then echo __NOKUBECTL__; else ` +
  `echo __PODS__; kubectl get pods -n ${ns} --no-headers -o custom-columns='NAME:.metadata.name,READY:.status.containerStatuses[*].ready,STATUS:.status.phase,RESTARTS:.status.containerStatuses[*].restartCount,AGE:.metadata.creationTimestamp,IMAGE:.spec.containers[*].image,NODE:.spec.nodeName,NAMESPACE:.metadata.namespace' 2>&1; ` +
  `echo __NAMESPACES__; kubectl get namespaces --no-headers -o custom-columns='NAME:.metadata.name' 2>&1; ` +
  `fi`;

const POLL_MS = 5000;

const PERM_RE = /forbidden|unauthorized|cannot connect|connection refused|no configuration|does not have a resource|unable to connect/i;

/* ── Pod model ────────────────────────────────────────────────────── */

interface Pod {
  name: string;
  ready: string;
  status: string;
  restarts: string;
  age: string;
  image: string;
  node: string;
  namespace: string;
}

interface ParseResult {
  available: boolean;
  error: string | null;
  pods: Pod[];
  namespaces: string[];
}

function relativeAge(ts: string): string {
  const d = Date.parse(ts);
  if (Number.isNaN(d)) return ts;
  const sec = Math.floor((Date.now() - d) / 1000);
  if (sec < 60) return `${sec}s`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h`;
  return `${Math.floor(sec / 86400)}d`;
}

function parseList(output: string): ParseResult {
  if (output.includes("__NOKUBECTL__")) {
    return { available: false, error: null, pods: [], namespaces: [] };
  }

  const buckets: Record<string, string[]> = {};
  let section = "";
  for (const raw of output.split("\n")) {
    const line = raw.replace(/\r/g, "");
    const marker = line.match(/^__([A-Z]+)__$/);
    if (marker) { section = marker[1]; buckets[section] = []; continue; }
    if (section) (buckets[section] ||= []).push(line);
  }

  const podLines = (buckets.PODS ?? []).filter((l) => l.trim().length > 0);
  const permLine = podLines.find((l) => PERM_RE.test(l));
  if (permLine) {
    return { available: true, error: permLine.trim(), pods: [], namespaces: [] };
  }

  const pods: Pod[] = [];
  for (const l of podLines) {
    const parts = l.trim().split(/\s{2,}/);
    if (parts.length < 4) continue;
    pods.push({
      name: parts[0] ?? "",
      ready: parts[1] ?? "",
      status: parts[2] ?? "",
      restarts: parts[3] ?? "0",
      age: relativeAge(parts[4] ?? ""),
      image: parts[5] ?? "",
      node: parts[6] ?? "",
      namespace: parts[7] ?? "",
    });
  }

  const namespaces = (buckets.NAMESPACES ?? [])
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  return { available: true, error: null, pods, namespaces };
}

function statusColor(status: string, sc: { green: string; yellow: string; red: string; gray: string }): string {
  const s = status.toLowerCase();
  if (s === "running") return sc.green;
  if (s === "succeeded" || s === "completed") return sc.green;
  if (s === "pending" || s === "containercreating" || s === "init:0/1") return sc.yellow;
  if (s === "failed" || s === "crashloopbackoff" || s === "error" || s === "imagepullbackoff" || s === "errimagepull") return sc.red;
  if (s === "terminating") return sc.yellow;
  return sc.gray;
}

/* ── Pod action types ─────────────────────────────────────────────── */

type PodAction =
  | "delete"
  | "restart"
  | "logs"
  | "describe"
  | "exec"
  | "scale"
  | "set-image";

interface PodActionDef {
  action: PodAction;
  label: string;
  icon: React.ReactNode;
  confirm?: boolean;
  needsInput?: boolean;
  inputLabel?: string;
  inputPlaceholder?: string;
}

/* ── Widget ────────────────────────────────────────────────────────── */

interface KubernetesWidgetProps {
  sessionId: string;
  onClose: () => void;
}

export default function KubernetesWidget({ sessionId, onClose }: KubernetesWidgetProps) {
  const socket = useSSHStore((s) => s.sessions[sessionId]?.socket);
  const status = useSSHStore((s) => s.sessions[sessionId]?.status);
  const host = useSSHStore((s) => s.sessions[sessionId]?.host);
  const { colors } = useSessionTheme();

  const namespace = useKubernetesStore((s) => s.namespace);
  const setNamespace = useKubernetesStore((s) => s.setNamespace);

  const [result, setResult] = useState<ParseResult | null>(null);
  const [paused, setPaused] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<number | null>(null);
  const [busyPod, setBusyPod] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<{ pod: string; action: PodAction } | null>(null);
  const [actionErr, setActionErr] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  const [showNsDropdown, setShowNsDropdown] = useState(false);

  // Logs / describe output overlay
  const [outputOverlay, setOutputOverlay] = useState<{ title: string; content: string } | null>(null);

  // Input dialog (for scale / set-image)
  const [inputDialog, setInputDialog] = useState<{
    pod: string; action: PodAction; label: string; placeholder: string;
  } | null>(null);
  const [inputValue, setInputValue] = useState("");

  const inFlightRef = useRef(false);
  const pollRef = useRef<() => void>(() => {});

  const [pos, setPos] = useState(() => ({ x: Math.max(12, window.innerWidth - 420), y: 72 }));
  const dragRef = useRef<{ dx: number; dy: number } | null>(null);

  const connected = status === "connected" && !!socket;

  /* ── Polling ──────────────────────────────────────────────────── */

  useEffect(() => {
    if (!socket || !connected || paused) return;

    const listPrefix = `k8-${sessionId}-`;
    let seq = 0;

    const onOutput = (payload: { requestId: string; output: string }) => {
      if (!payload || typeof payload.requestId !== "string") return;
      if (payload.requestId.startsWith(listPrefix)) {
        inFlightRef.current = false;
        setResult(parseList(payload.output ?? ""));
        setLastUpdate(Date.now());
      }
    };

    const poll = () => {
      if (inFlightRef.current) return;
      inFlightRef.current = true;
      seq += 1;
      socket.emit(SocketEventConstants.SSH_EXEC_SILENT, {
        requestId: `${listPrefix}${seq}`,
        cmd: LIST_CMD(namespace),
      });
    };
    pollRef.current = poll;

    socket.on(SocketEventConstants.SSH_EXEC_SILENT_OUTPUT, onOutput);
    poll();
    const timer = setInterval(poll, POLL_MS);

    return () => {
      clearInterval(timer);
      inFlightRef.current = false;
      socket.off(SocketEventConstants.SSH_EXEC_SILENT_OUTPUT, onOutput);
    };
  }, [socket, connected, paused, sessionId, namespace]);

  /* ── Actions ──────────────────────────────────────────────────── */

  const runCmd = useCallback(
    (cmd: string, podName: string, opts?: { captureOutput?: boolean; outputTitle?: string }) => {
      if (!socket || !connected) return;
      setActionErr(null);
      const actPrefix = `k8a-${sessionId}-`;
      const reqId = `${actPrefix}${Date.now()}`;

      if (opts?.captureOutput) {
        const handler = (payload: { requestId: string; output: string }) => {
          if (payload.requestId !== reqId) return;
          socket.off(SocketEventConstants.SSH_EXEC_SILENT_OUTPUT, handler);
          setBusyPod(null);
          const out = (payload.output ?? "").trim();
          if (PERM_RE.test(out)) { setActionErr(out.split("\n")[0]); return; }
          setOutputOverlay({ title: opts.outputTitle ?? podName, content: out });
        };
        socket.on(SocketEventConstants.SSH_EXEC_SILENT_OUTPUT, handler);
        setBusyPod(podName);
        socket.emit(SocketEventConstants.SSH_EXEC_SILENT, { requestId: reqId, cmd });
      } else {
        const handler = (payload: { requestId: string; output: string }) => {
          if (payload.requestId !== reqId) return;
          socket.off(SocketEventConstants.SSH_EXEC_SILENT_OUTPUT, handler);
          setBusyPod(null);
          const out = (payload.output ?? "").trim();
          if (out && PERM_RE.test(out)) setActionErr(out.split("\n")[0]);
          pollRef.current();
        };
        socket.on(SocketEventConstants.SSH_EXEC_SILENT_OUTPUT, handler);
        setBusyPod(podName);
        socket.emit(SocketEventConstants.SSH_EXEC_SILENT, { requestId: reqId, cmd });
      }
    },
    [socket, connected, sessionId],
  );

  const executePodAction = useCallback(
    (pod: Pod, action: PodAction, inputVal?: string) => {
      const ns = pod.namespace || namespace;
      switch (action) {
        case "delete":
          runCmd(`kubectl delete pod ${pod.name} -n ${ns} 2>&1`, pod.name);
          break;
        case "restart":
          // Rollout restart of the owner deployment (extracts from pod name)
          runCmd(
            `dep=$(kubectl get pod ${pod.name} -n ${ns} -o jsonpath='{.metadata.ownerReferences[0].name}' 2>/dev/null); ` +
            `if [ -n "$dep" ]; then rs="$dep"; dep=$(kubectl get rs "$rs" -n ${ns} -o jsonpath='{.metadata.ownerReferences[0].name}' 2>/dev/null); fi; ` +
            `if [ -n "$dep" ]; then kubectl rollout restart deployment "$dep" -n ${ns} 2>&1; ` +
            `else kubectl delete pod ${pod.name} -n ${ns} 2>&1; fi`,
            pod.name,
          );
          break;
        case "logs":
          runCmd(`kubectl logs ${pod.name} -n ${ns} --tail=200 2>&1`, pod.name, {
            captureOutput: true,
            outputTitle: `Logs: ${pod.name}`,
          });
          break;
        case "describe":
          runCmd(`kubectl describe pod ${pod.name} -n ${ns} 2>&1`, pod.name, {
            captureOutput: true,
            outputTitle: `Describe: ${pod.name}`,
          });
          break;
        case "exec":
          // Send an interactive shell command to the terminal
          if (socket) {
            socket.emit(SocketEventConstants.SSH_EMIT_INPUT, `kubectl exec -it ${pod.name} -n ${ns} -- /bin/sh\r`);
          }
          break;
        case "scale": {
          if (!inputVal) return;
          const replicas = parseInt(inputVal, 10);
          if (Number.isNaN(replicas) || replicas < 0) { setActionErr("Invalid replica count"); return; }
          runCmd(
            `dep=$(kubectl get pod ${pod.name} -n ${ns} -o jsonpath='{.metadata.ownerReferences[0].name}' 2>/dev/null); ` +
            `if [ -n "$dep" ]; then rs="$dep"; dep=$(kubectl get rs "$rs" -n ${ns} -o jsonpath='{.metadata.ownerReferences[0].name}' 2>/dev/null); fi; ` +
            `if [ -n "$dep" ]; then kubectl scale deployment "$dep" -n ${ns} --replicas=${replicas} 2>&1; ` +
            `else echo "Cannot find parent deployment for ${pod.name}"; fi`,
            pod.name,
          );
          break;
        }
        case "set-image": {
          if (!inputVal) return;
          runCmd(
            `dep=$(kubectl get pod ${pod.name} -n ${ns} -o jsonpath='{.metadata.ownerReferences[0].name}' 2>/dev/null); ` +
            `if [ -n "$dep" ]; then rs="$dep"; dep=$(kubectl get rs "$rs" -n ${ns} -o jsonpath='{.metadata.ownerReferences[0].name}' 2>/dev/null); fi; ` +
            `ctr=$(kubectl get pod ${pod.name} -n ${ns} -o jsonpath='{.spec.containers[0].name}' 2>/dev/null); ` +
            `if [ -n "$dep" ] && [ -n "$ctr" ]; then kubectl set image deployment "$dep" "$ctr"=${inputVal} -n ${ns} 2>&1; ` +
            `else echo "Cannot find parent deployment or container for ${pod.name}"; fi`,
            pod.name,
          );
          break;
        }
      }
    },
    [namespace, runCmd, socket],
  );

  const requestAction = (pod: Pod, action: PodAction) => {
    if (action === "delete") {
      setConfirm({ pod: pod.name, action });
    } else if (action === "scale") {
      setInputDialog({ pod: pod.name, action, label: "Replicas", placeholder: "e.g. 3" });
      setInputValue("");
    } else if (action === "set-image") {
      setInputDialog({ pod: pod.name, action, label: "New image", placeholder: "e.g. nginx:1.25" });
      setInputValue(pod.image);
    } else {
      executePodAction(pod, action);
    }
  };

  const submitInputAction = () => {
    if (!inputDialog) return;
    const pod = pods.find((p) => p.name === inputDialog.pod);
    if (pod) executePodAction(pod, inputDialog.action, inputValue);
    setInputDialog(null);
    setInputValue("");
  };

  /* ── Drag ─────────────────────────────────────────────────────── */

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

  /* ── Derived ──────────────────────────────────────────────────── */

  const fg = colors.foreground;
  const bg = colors.background;
  const border = `${fg}22`;
  const track = `${fg}14`;
  const gray = colors.brightBlack ?? `${fg}66`;
  const sc = { green: colors.green, yellow: colors.yellow, red: colors.red, gray };

  const pods = result?.pods ?? [];
  const namespaces = result?.namespaces ?? [];
  const runningCount = pods.filter((p) => p.status.toLowerCase() === "running").length;

  const filtered = filter
    ? pods.filter((p) => p.name.toLowerCase().includes(filter.toLowerCase()) || p.image.toLowerCase().includes(filter.toLowerCase()))
    : pods;

  /* ── Output overlay ───────────────────────────────────────────── */

  if (outputOverlay) {
    return (
      <div
        style={{
          position: "fixed", left: pos.x, top: pos.y, zIndex: 51,
          width: 520, maxHeight: "85vh", borderRadius: 12,
          background: `${bg}f6`, border: `1px solid ${border}`,
          boxShadow: "0 18px 48px rgba(0,0,0,0.5)",
          backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)",
          fontFamily: "'Inter', system-ui, sans-serif",
          overflow: "hidden", display: "flex", flexDirection: "column",
        }}
      >
        <div
          onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp}
          style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 12px", borderBottom: `1px solid ${border}`, cursor: "move", userSelect: "none" }}
        >
          <FileText size={14} style={{ color: colors.cyan }} />
          <span style={{ fontSize: 12, fontWeight: 600, color: fg, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{outputOverlay.title}</span>
          <button onClick={() => setOutputOverlay(null)} style={{ display: "flex", background: "transparent", border: "none", color: `${fg}99`, cursor: "pointer", padding: 2 }}>
            <X size={15} />
          </button>
        </div>
        <pre
          style={{
            margin: 0, padding: "10px 12px", fontSize: 11, lineHeight: 1.5,
            color: `${fg}dd`, background: "transparent", overflow: "auto",
            whiteSpace: "pre-wrap", wordBreak: "break-all", maxHeight: "75vh",
          }}
          className="scrollbar-green"
        >
          {outputOverlay.content || "(empty)"}
        </pre>
      </div>
    );
  }

  /* ── Input dialog overlay ─────────────────────────────────────── */

  if (inputDialog) {
    return (
      <div
        style={{
          position: "fixed", left: pos.x, top: pos.y, zIndex: 51,
          width: 360, borderRadius: 12,
          background: `${bg}f6`, border: `1px solid ${border}`,
          boxShadow: "0 18px 48px rgba(0,0,0,0.5)",
          backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)",
          fontFamily: "'Inter', system-ui, sans-serif",
          overflow: "hidden", display: "flex", flexDirection: "column",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 12px", borderBottom: `1px solid ${border}` }}>
          <Scale size={14} style={{ color: colors.cyan }} />
          <span style={{ fontSize: 12, fontWeight: 600, color: fg }}>{inputDialog.action === "scale" ? "Scale" : "Update Image"} — {inputDialog.pod}</span>
          <div style={{ flex: 1 }} />
          <button onClick={() => setInputDialog(null)} style={{ display: "flex", background: "transparent", border: "none", color: `${fg}99`, cursor: "pointer", padding: 2 }}>
            <X size={15} />
          </button>
        </div>
        <div style={{ padding: "12px", display: "flex", flexDirection: "column", gap: 8 }}>
          <label style={{ fontSize: 11, color: `${fg}aa` }}>{inputDialog.label}</label>
          <input
            autoFocus
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") submitInputAction(); }}
            placeholder={inputDialog.placeholder}
            style={{
              padding: "6px 8px", fontSize: 12, borderRadius: 6,
              border: `1px solid ${border}`, background: `${fg}08`,
              color: fg, outline: "none",
            }}
          />
          <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
            <button onClick={() => setInputDialog(null)} style={{ fontSize: 11, color: `${fg}aa`, background: "transparent", border: `1px solid ${border}`, borderRadius: 5, padding: "4px 10px", cursor: "pointer" }}>Cancel</button>
            <button onClick={submitInputAction} style={{ fontSize: 11, fontWeight: 600, color: "#fff", background: colors.cyan, border: "none", borderRadius: 5, padding: "4px 10px", cursor: "pointer" }}>Apply</button>
          </div>
        </div>
      </div>
    );
  }

  /* ── Main panel ───────────────────────────────────────────────── */

  return (
    <div
      style={{
        position: "fixed", left: pos.x, top: pos.y, zIndex: 50,
        width: 400, maxHeight: "82vh", borderRadius: 12,
        background: `${bg}f2`, border: `1px solid ${border}`,
        boxShadow: "0 18px 48px rgba(0,0,0,0.45)",
        backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)",
        fontFamily: "'Inter', system-ui, sans-serif",
        overflow: "hidden", display: "flex", flexDirection: "column",
      }}
    >
      {/* Header */}
      <div
        onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp}
        style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 12px", borderBottom: `1px solid ${border}`, cursor: "move", userSelect: "none" }}
      >
        <Box size={15} style={{ color: colors.blue ?? colors.cyan }} />
        <span style={{ fontSize: 12.5, fontWeight: 600, color: fg }}>Kubernetes</span>
        {result?.available && (
          <span style={{ fontSize: 10, color: `${fg}66` }}>{runningCount}/{pods.length} running</span>
        )}
        {/* Namespace selector */}
        <div style={{ position: "relative", marginLeft: 4 }}>
          <button
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => setShowNsDropdown((v) => !v)}
            style={{
              display: "flex", alignItems: "center", gap: 3, padding: "2px 6px",
              fontSize: 10, color: `${fg}88`, background: `${fg}0a`, border: `1px solid ${border}`,
              borderRadius: 4, cursor: "pointer",
            }}
          >
            {namespace} <ChevronDown size={10} />
          </button>
          {showNsDropdown && namespaces.length > 0 && (
            <div
              style={{
                position: "absolute", top: "100%", left: 0, marginTop: 2, zIndex: 60,
                background: bg, border: `1px solid ${border}`, borderRadius: 6,
                boxShadow: "0 8px 24px rgba(0,0,0,0.4)", maxHeight: 180, overflowY: "auto",
                minWidth: 120,
              }}
              className="scrollbar-green"
            >
              {namespaces.map((ns) => (
                <button
                  key={ns}
                  onClick={() => { setNamespace(ns); setShowNsDropdown(false); }}
                  style={{
                    display: "block", width: "100%", textAlign: "left", padding: "5px 10px",
                    fontSize: 11, color: ns === namespace ? colors.cyan : `${fg}cc`,
                    background: ns === namespace ? `${colors.cyan}18` : "transparent",
                    border: "none", cursor: "pointer",
                  }}
                  onMouseEnter={(e) => { if (ns !== namespace) e.currentTarget.style.background = `${fg}0a`; }}
                  onMouseLeave={(e) => { if (ns !== namespace) e.currentTarget.style.background = "transparent"; }}
                >
                  {ns}
                </button>
              ))}
            </div>
          )}
        </div>
        <span style={{ fontSize: 10, color: `${fg}66`, maxWidth: 70, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{host}</span>
        <div style={{ flex: 1 }} />
        <button
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => setPaused((p) => !p)}
          title={paused ? "Resume" : "Pause"}
          style={{ display: "flex", background: "transparent", border: "none", color: `${fg}99`, cursor: "pointer", padding: 2 }}
        >
          {paused ? <Play size={14} /> : <Pause size={14} />}
        </button>
        <button onPointerDown={(e) => e.stopPropagation()} onClick={onClose} title="Close (Ctrl+Shift+K)" style={{ display: "flex", background: "transparent", border: "none", color: `${fg}99`, cursor: "pointer", padding: 2 }}>
          <X size={15} />
        </button>
      </div>

      {/* Search / filter bar */}
      {result?.available && !result.error && pods.length > 0 && (
        <div style={{ padding: "6px 12px 2px", display: "flex", alignItems: "center", gap: 6 }}>
          <Search size={12} style={{ color: `${fg}55` }} />
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter pods…"
            onPointerDown={(e) => e.stopPropagation()}
            style={{
              flex: 1, padding: "3px 6px", fontSize: 11, borderRadius: 4,
              border: `1px solid ${border}`, background: `${fg}06`, color: fg, outline: "none",
            }}
          />
        </div>
      )}

      {/* Body */}
      <div style={{ padding: "8px 10px", display: "flex", flexDirection: "column", gap: 7, overflowY: "auto", flex: 1 }} className="scrollbar-green">
        {!connected ? (
          <EmptyMsg fg={fg}>Session not connected.</EmptyMsg>
        ) : !result ? (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, fontSize: 12, color: `${fg}88`, padding: "12px 0" }}>
            <RefreshCw size={14} style={{ animation: "k8Spin 0.9s linear infinite" }} /> Loading pods…
          </div>
        ) : !result.available ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, fontSize: 12, color: `${fg}88`, padding: "16px 8px", textAlign: "center" }}>
            <Box size={22} style={{ color: `${fg}55` }} />
            kubectl is not installed or not on PATH.
          </div>
        ) : result.error ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, fontSize: 11.5, color: colors.red, padding: "14px 8px", textAlign: "center" }}>
            <AlertTriangle size={20} />
            <span style={{ color: `${fg}aa` }}>{result.error}</span>
            <span style={{ fontSize: 10, color: `${fg}66` }}>Check kubeconfig and RBAC permissions.</span>
          </div>
        ) : pods.length === 0 ? (
          <EmptyMsg fg={fg}>No pods in namespace "{namespace}".</EmptyMsg>
        ) : filtered.length === 0 ? (
          <EmptyMsg fg={fg}>No pods matching "{filter}".</EmptyMsg>
        ) : (
          filtered.map((pod) => {
            const running = pod.status.toLowerCase() === "running";
            const dot = statusColor(pod.status, sc);
            const isBusy = busyPod === pod.name;
            const isConfirming = confirm?.pod === pod.name;

            return (
              <div key={pod.name} style={{ border: `1px solid ${border}`, borderRadius: 9, padding: "8px 9px", display: "flex", flexDirection: "column", gap: 5, background: `${fg}08` }}>
                {/* Name + status */}
                <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                  <span style={{ width: 7, height: 7, borderRadius: "50%", background: dot, flexShrink: 0, boxShadow: running ? `0 0 6px ${dot}` : "none" }} />
                  <span style={{ fontSize: 11.5, fontWeight: 600, color: fg, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={pod.name}>{pod.name}</span>
                  <span style={{ marginLeft: "auto", fontSize: 9.5, color: dot, textTransform: "capitalize" }}>{pod.status}</span>
                </div>

                {/* Meta row */}
                <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 10, color: `${fg}77`, flexWrap: "wrap" }}>
                  <span title={pod.image} style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 180 }}>{pod.image}</span>
                  <span style={{ marginLeft: "auto" }}>Ready: {pod.ready}</span>
                  <span>R: {pod.restarts}</span>
                  <span>{pod.age}</span>
                </div>

                {/* Confirm bar */}
                {isConfirming ? (
                  <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: fg, background: `${colors.red}18`, borderRadius: 6, padding: "5px 7px" }}>
                    <AlertTriangle size={13} style={{ color: colors.red }} />
                    <span>Delete pod "{pod.name}"?</span>
                    <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
                      <button onClick={() => { executePodAction(pod, "delete"); setConfirm(null); }} style={{ fontSize: 10.5, fontWeight: 600, color: "#fff", background: colors.red, border: "none", borderRadius: 5, padding: "3px 8px", cursor: "pointer" }}>Yes</button>
                      <button onClick={() => setConfirm(null)} style={{ fontSize: 10.5, color: `${fg}aa`, background: "transparent", border: `1px solid ${border}`, borderRadius: 5, padding: "3px 8px", cursor: "pointer" }}>No</button>
                    </div>
                  </div>
                ) : (
                  /* Action buttons */
                  <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 1 }}>
                    <ActionBtn label="Logs" icon={<FileText size={11} />} disabled={isBusy} onClick={() => requestAction(pod, "logs")} fg={fg} border={border} accent={colors.cyan} />
                    <ActionBtn label="Describe" icon={<Search size={11} />} disabled={isBusy} onClick={() => requestAction(pod, "describe")} fg={fg} border={border} accent={colors.blue ?? colors.cyan} />
                    {running && (
                      <ActionBtn label="Exec" icon={<Terminal size={11} />} disabled={isBusy} onClick={() => requestAction(pod, "exec")} fg={fg} border={border} accent={colors.green} />
                    )}
                    <ActionBtn label="Restart" icon={<RotateCcw size={11} />} disabled={isBusy} onClick={() => requestAction(pod, "restart")} fg={fg} border={border} accent={colors.yellow} />
                    <ActionBtn label="Scale" icon={<Scale size={11} />} disabled={isBusy} onClick={() => requestAction(pod, "scale")} fg={fg} border={border} accent={colors.magenta ?? colors.blue} />
                    <ActionBtn label="Image" icon={<ImageIcon size={11} />} disabled={isBusy} onClick={() => requestAction(pod, "set-image")} fg={fg} border={border} accent={colors.magenta ?? colors.blue} />
                    <ActionBtn label="Delete" icon={<Trash2 size={11} />} disabled={isBusy} onClick={() => requestAction(pod, "delete")} fg={fg} border={border} accent={colors.red} />
                    {isBusy && <RefreshCw size={13} style={{ color: `${fg}88`, alignSelf: "center", animation: "k8Spin 0.9s linear infinite" }} />}
                  </div>
                )}
              </div>
            );
          })
        )}

        {actionErr && (
          <div style={{ fontSize: 10.5, color: colors.red, display: "flex", alignItems: "center", gap: 5 }}>
            <AlertTriangle size={12} /> {actionErr}
          </div>
        )}
      </div>

      {/* Footer */}
      {result?.available && !result.error && (
        <div style={{ display: "flex", alignItems: "center", fontSize: 10, color: `${fg}55`, padding: "6px 12px", borderTop: `1px solid ${border}` }}>
          {paused ? "Paused" : `Updated ${lastUpdate ? new Date(lastUpdate).toLocaleTimeString() : "—"}`}
          <span style={{ marginLeft: "auto" }}>every {POLL_MS / 1000}s</span>
        </div>
      )}

      <style>{`@keyframes k8Spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

/* ── Helpers ────────────────────────────────────────────────────── */

function EmptyMsg({ fg, children }: { fg: string; children: React.ReactNode }) {
  return <div style={{ fontSize: 12, color: `${fg}88`, textAlign: "center", padding: "16px 0" }}>{children}</div>;
}

interface ActionBtnProps {
  label: string;
  icon: React.ReactNode;
  accent: string;
  fg: string;
  border: string;
  disabled?: boolean;
  onClick: () => void;
}

function ActionBtn({ label, icon, accent, fg, border, disabled, onClick }: ActionBtnProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 3,
        fontSize: 10, fontWeight: 500, color: disabled ? `${fg}55` : fg,
        background: "transparent", border: `1px solid ${border}`, borderRadius: 5,
        padding: "3px 6px", cursor: disabled ? "default" : "pointer",
        transition: "background 0.15s, border-color 0.15s",
      }}
      onMouseEnter={(e) => { if (!disabled) { e.currentTarget.style.background = `${accent}18`; e.currentTarget.style.borderColor = `${accent}66`; } }}
      onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.borderColor = border; }}
    >
      <span style={{ color: accent, display: "flex" }}>{icon}</span>{label}
    </button>
  );
}
