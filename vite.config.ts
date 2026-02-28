import path from "path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import vsix from "@codingame/monaco-vscode-rollup-vsix-plugin";

export default defineConfig({
  plugins: [react(), vsix()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return;

          // ── Monaco editor core ─────────────────────────────
          if (id.includes("monaco-editor/")) return "vendor-monaco";

          // ── @codingame service-overrides & default-extensions
          if (id.includes("@codingame/")) return "vendor-codingame";

          // ── AI completion (monacopilot) ────────────────────
          if (id.includes("monacopilot")) return "vendor-monacopilot";

          // ── @monaco-editor/react wrapper ───────────────────
          if (id.includes("@monaco-editor/")) return "vendor-monaco";

          // ── Terminal (xterm) ───────────────────────────────
          if (id.includes("@xterm/")) return "vendor-xterm";

          // ── Radix UI primitives ────────────────────────────
          if (id.includes("@radix-ui/")) return "vendor-radix";

          // ── Charts (recharts + d3) ─────────────────────────
          if (id.includes("recharts") || id.includes("d3-"))
            return "vendor-charts";

          // ── IndexedDB / storage ────────────────────────────
          if (id.includes("dexie") || id.includes("/idb/"))
            return "vendor-storage";

          // ── VSIX extraction (jszip / pako) ─────────────────
          if (id.includes("jszip") || id.includes("pako"))
            return "vendor-jszip";

          // ── Animation ──────────────────────────────────────
          if (id.includes("framer-motion")) return "vendor-animation";

          // ── Realtime (socket.io) ───────────────────────────
          if (id.includes("socket.io")) return "vendor-socket";

          // ── LSP JSON-RPC ───────────────────────────────────
          if (id.includes("vscode-ws-jsonrpc") || id.includes("vscode-jsonrpc"))
            return "vendor-lsp";

          // ── React core ─────────────────────────────────────
          if (
            id.includes("/react-dom/") ||
            id.includes("/react/") ||
            id.includes("/scheduler/")
          )
            return "vendor-react";
        },
      },
    },
  },
});
