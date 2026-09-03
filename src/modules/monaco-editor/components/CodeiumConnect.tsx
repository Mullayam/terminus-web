/**
 * @module components/CodeiumConnect
 *
 * "Connect Codeium" flow for the AI completions panel.
 *
 * Drives the three auth calls from the backend contract:
 *   GET  /api/codeium/auth/status  — is a key configured for this user?
 *   GET  /api/codeium/auth/url     — open the Codeium login page
 *   POST /api/codeium/auth         — exchange a pasted (short-lived) token
 *
 * The api_key never reaches the browser; this component only handles the
 * short-lived login token.
 */
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Check, ExternalLink, Loader2, LogIn, RefreshCw, ShieldAlert } from "lucide-react";
import { __config } from "@/lib/config";
import {
  fetchCodeiumAuthStatus,
  fetchCodeiumAuthUrl,
  submitCodeiumToken,
  fetchCodeiumHealth,
  type CodeiumAuthStatus,
  type CodeiumHealth,
} from "../plugins/codeium-plugin";

type Phase = "loading" | "disconnected" | "awaiting-token" | "verifying" | "connected" | "error";

export interface CodeiumConnectProps {
  /** Companion base URL; falls back to the app API URL when blank. */
  endpoint?: string;
  /** Host id, sent as `?user=base64(hostId)`. */
  hostId?: string;
}

export const CodeiumConnect: React.FC<CodeiumConnectProps> = ({ endpoint, hostId }) => {
  const base = endpoint?.trim() || __config.API_URL;

  const [phase, setPhase] = useState<Phase>("loading");
  const [status, setStatus] = useState<CodeiumAuthStatus | null>(null);
  const [health, setHealth] = useState<CodeiumHealth | null>(null);
  const [token, setToken] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  useEffect(() => {
    let active = true;
    fetchCodeiumHealth(base)
      .then((h) => { if (active) setHealth(h); })
      .catch(() => { if (active) setHealth(null); });
    return () => { active = false; };
  }, [base]);

  const refreshStatus = useCallback(async () => {
    try {
      const s = await fetchCodeiumAuthStatus(base, hostId);
      if (!mounted.current) return;
      setStatus(s);
      setPhase(s.authenticated ? "connected" : "disconnected");
    } catch (e) {
      if (!mounted.current) return;
      setStatus(null);
      setMessage((e as Error)?.message ?? "Could not reach the Codeium companion.");
      setPhase("error");
    }
  }, [base, hostId]);

  useEffect(() => { void refreshStatus(); }, [refreshStatus]);

  const handleConnect = useCallback(async () => {
    setMessage(null);
    try {
      const url = await fetchCodeiumAuthUrl(base);
      window.open(url, "_blank", "noopener,noreferrer");
      setPhase("awaiting-token");
    } catch (e) {
      setMessage((e as Error)?.message ?? "Could not fetch the login URL.");
      setPhase("error");
    }
  }, [base]);

  const handleSubmitToken = useCallback(async () => {
    if (!token.trim()) return;
    setPhase("verifying");
    setMessage(null);
    try {
      const res = await submitCodeiumToken(base, token.trim(), hostId);
      if (!mounted.current) return;
      if (res.success) {
        setToken("");
        await refreshStatus();
      } else {
        setMessage(res.message ?? "Token exchange failed. It may have expired.");
        setPhase("awaiting-token");
      }
    } catch (e) {
      if (!mounted.current) return;
      setMessage((e as Error)?.message ?? "Token exchange failed.");
      setPhase("awaiting-token");
    }
  }, [base, token, hostId, refreshStatus]);

  const sectionTitle = (
    <div className="flex items-center gap-1.5 mb-1.5 border-b border-[#3c3c3c] pb-1">
      <span
        className={`w-1.5 h-1.5 rounded-full shrink-0 ${
          health?.phase === "ready"
            ? "bg-green-500"
            : health?.phase === "downloading" || health?.phase === "starting"
              ? "bg-amber-500"
              : health?.phase === "failed" || health?.phase === "disabled"
                ? "bg-red-500"
                : "bg-gray-600"
        }`}
        title={health ? `Companion: ${health.phase}` : "Companion status unknown"}
      />
      <span className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">
        Codeium Account
      </span>
    </div>
  );

  // Companion disabled server-side — nothing to connect.
  if (status && !status.enabled) {
    return (
      <div className="mb-4">
        {sectionTitle}
        <div className="px-2 py-2 rounded bg-[#1e1e1e] border border-[#3c3c3c] text-[10px] text-gray-400">
          The Codeium companion is disabled on the server.
        </div>
      </div>
    );
  }

  // Key present and no connect flow required.
  if (phase === "connected" || (status?.authenticated && !status.required)) {
    return (
      <div className="mb-4">
        {sectionTitle}
        <div className="px-2 py-2 rounded bg-[#1e1e1e] border border-[#3c3c3c] flex items-center justify-between gap-2">
          <span className="flex items-center gap-1.5 text-[11px] text-green-400">
            <Check className="w-3.5 h-3.5" /> Connected
          </span>
          <button
            onClick={() => void refreshStatus()}
            title="Re-check status"
            className="text-gray-500 hover:text-gray-300 transition-colors"
          >
            <RefreshCw className="w-3 h-3" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mb-4">
      {sectionTitle}
      <div className="px-1 py-2 rounded bg-[#1e1e1e] border border-[#3c3c3c] flex flex-col gap-2">
        {phase === "loading" ? (
          <div className="flex items-center gap-1.5 px-2 text-[11px] text-gray-400">
            <Loader2 className="w-3.5 h-3.5 animate-spin" /> Checking Codeium status…
          </div>
        ) : (
          <>
            <p className="text-[10px] text-gray-400 px-2">
              Connect your Codeium account to enable inline completions.
            </p>

            <button
              onClick={handleConnect}
              disabled={phase === "verifying"}
              className="flex items-center justify-center gap-1.5 text-[11px] px-3 py-1.5 rounded bg-[#007acc] text-white hover:bg-[#006bb3] disabled:opacity-50 transition-colors mx-1"
            >
              <LogIn className="w-3 h-3" />
              {phase === "awaiting-token" ? "Reopen login page" : "Connect Codeium"}
              <ExternalLink className="w-3 h-3 opacity-70" />
            </button>

            {phase === "awaiting-token" || phase === "verifying" ? (
              <div className="flex flex-col gap-1.5 px-1 mt-1">
                <p className="text-[9px] text-amber-400/90 px-1 flex items-start gap-1">
                  <ShieldAlert className="w-3 h-3 mt-px shrink-0" />
                  Paste the token from the login page — it expires in ~5 minutes.
                </p>
                <textarea
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  placeholder="Paste your token here"
                  rows={3}
                  className="bg-[#3c3c3c] text-[10px] font-mono text-gray-200 px-2 py-1.5 rounded border border-[#555] hover:border-[#007acc] focus:border-[#007acc] focus:outline-none transition-colors w-full resize-none break-all"
                />
                <button
                  onClick={handleSubmitToken}
                  disabled={!token.trim() || phase === "verifying"}
                  className="flex items-center justify-center gap-1.5 text-[11px] px-3 py-1.5 rounded bg-[#2ea043] text-white hover:bg-[#2c974b] disabled:opacity-50 transition-colors"
                >
                  {phase === "verifying" ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                  {phase === "verifying" ? "Verifying…" : "Submit token"}
                </button>
              </div>
            ) : null}
          </>
        )}

        {message && (
          <p className="text-[9px] text-red-400 px-2">{message}</p>
        )}
      </div>
    </div>
  );
};

CodeiumConnect.displayName = "CodeiumConnect";
