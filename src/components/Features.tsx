import { Badge } from "./ui/badge";
import {
  Terminal,
  FolderOpen,
  Code2,
  Shield,
  Sparkles,
  Users,
  ArrowRight,
  Search,
  type LucideIcon,
} from "lucide-react";
import { Link } from "react-router-dom";

/* ------------------------------------------------------------------ */
/*  Data                                                               */
/* ------------------------------------------------------------------ */

interface FeatureHighlight {
  text: string;
}

interface FeatureCard {
  category: string;
  tagline: string;
  description: string;
  icon: LucideIcon;
  color: string;
  gradient: string;
  borderGlow: string;
  highlights: FeatureHighlight[];
  cta: { label: string; href: string };
  isNew?: boolean;
}

const features: FeatureCard[] = [
  {
    category: "SSH Terminal",
    tagline: "Your server, one click away",
    description:
      "A full-featured web terminal powered by xterm.js with WebGL rendering. Connect to any server via SSH, open multiple tabs, split panes, and personalize with 17+ themes — all without leaving your browser.",
    icon: Terminal,
    color: "text-green-400",
    gradient: "from-green-500/20 via-green-500/5 to-transparent",
    borderGlow: "group-hover:shadow-green-500/10",
    highlights: [
      { text: "Multi-tab & split terminal sessions" },
      { text: "Password & private-key authentication" },
      { text: "17+ themes with per-session font & weight settings" },
      { text: "Idle auto-reconnect & session resilience" },
      { text: "Command palette (PM2, Nginx, Docker)" },
      { text: "Shell history autocomplete & context-engine suggestions" },
      { text: "VS Code-style search bar (Ctrl+F) with theme-aware styling" },
      { text: "Bell sound notifications & dynamic tab titles" },
    ],
    cta: { label: "Launch Terminal", href: "/ssh/connect" },
  },
  {
    category: "AI Assistance",
    tagline: "Your intelligent co-pilot",
    isNew: true,
    description:
      "A deeply integrated AI layer across terminal, editor, and SFTP. Inline ghost-text predictions, a streaming chat panel with full terminal context, and an inline command bar (Ctrl+Shift+I) that turns natural language into shell commands — all powered by SSE streaming with multi-provider support.",
    icon: Sparkles,
    color: "text-amber-400",
    gradient: "from-amber-500/20 via-amber-500/5 to-transparent",
    borderGlow: "group-hover:shadow-amber-500/10",
    highlights: [
      { text: "Ghost-text command autocomplete from AI & shell history" },
      { text: "Inline AI command input (Ctrl+Shift+I) — describe & generate" },
      { text: "AI Chat panel with SSE streaming & multi-provider support" },
      { text: "Full terminal screen capture as AI context automatically" },
      { text: "Ask AI button in suggestion box for instant command help" },
      { text: "Run / Paste code blocks from AI responses directly" },
      { text: "Real-time diagnostics overlay with error/warning detection" },
      { text: "Diagnostics chat — AI explains & fixes detected errors" },
    ],
    cta: { label: "Try AI Features", href: "/ssh/connect" },
  },
  {
    category: "Collaborative Terminal",
    tagline: "Multiplayer DevOps, built in",
    description:
      "Share your terminal session with a single link. Teammates join instantly with role-based permissions. Every keystroke syncs live, blocked users see a ghost-text lock overlay, and admins can kick or ban with one click.",
    icon: Users,
    color: "text-pink-400",
    gradient: "from-pink-500/20 via-pink-500/5 to-transparent",
    borderGlow: "group-hover:shadow-pink-500/10",
    highlights: [
      { text: "Real-time multi-user sessions via WebSocket" },
      { text: "Share terminal with a shareable link" },
      { text: "Role-based permissions (read / write / admin)" },
      { text: "Live typing indicator for collaborators" },
      { text: "Admin panel: kick, block, lock PTY" },
      { text: "Independent theme system per session" },
    ],
    cta: { label: "Start Sharing", href: "/ssh/connect" },
  },
  {
    category: "SFTP File Manager",
    tagline: "Visual file management, reimagined",
    description:
      "Browse, upload, download, rename, chmod, and delete files on your remote servers through a visual file-tree interface. Full drag-and-drop support, context-menu actions, real-time progress tracking, and media preview.",
    icon: FolderOpen,
    color: "text-blue-400",
    gradient: "from-blue-500/20 via-blue-500/5 to-transparent",
    borderGlow: "group-hover:shadow-blue-500/10",
    highlights: [
      { text: "Multi-tab SFTP with breadcrumb navigation" },
      { text: "Drag-and-drop upload with progress bars" },
      { text: "13 context-menu actions (copy, move, chmod...)" },
      { text: "Inline media preview (images, video, audio)" },
      { text: "Persistent sessions & directory bookmarks" },
      { text: "Auto-reconnect on connection drop" },
    ],
    cta: { label: "Manage Files", href: "/ssh/connect" },
  },
  {
    category: "Code Editor",
    tagline: "A full IDE in your browser",
    description:
      "Monaco-powered editor with IntelliSense autocomplete, 25+ color themes, multi-tab and split editing, command palette, minimap, bracket colorization, diff viewer, and AI ghost-text completions.",
    icon: Code2,
    color: "text-violet-400",
    gradient: "from-violet-500/20 via-violet-500/5 to-transparent",
    borderGlow: "group-hover:shadow-violet-500/10",
    highlights: [
      { text: "Monaco Editor with full IntelliSense" },
      { text: "25+ themes with live preview switching" },
      { text: "Multi-tab, split-group, & diff editing" },
      { text: "Command Palette, minimap, & sticky scroll" },
      { text: "Snippets for Go, JavaScript, Python, TypeScript" },
      { text: "Auto-save with debounce & embedded terminal" },
      { text: "View Panel System — custom React tabs in the editor" },
      { text: "NPM Package Manager — update, install & manage deps visually" },
    ],
    cta: { label: "Open Editor", href: "/ssh/connect" },
  },
  {
    category: "Smart Terminal UX",
    tagline: "Productivity built into every keystroke",
    description:
      "An intelligent suggestion engine that learns from your shell history, command packs, and context-engine data. Ghost-text autocomplete appears as you type, a smart suggestion box surfaces relevant commands, and per-session settings let you toggle features on or off.",
    icon: Search,
    color: "text-teal-400",
    gradient: "from-teal-500/20 via-teal-500/5 to-transparent",
    borderGlow: "group-hover:shadow-teal-500/10",
    highlights: [
      { text: "Ghost-text inline autocomplete (Tab / → to accept)" },
      { text: "Suggestion box with keyboard navigation (↑↓ Tab Esc)" },
      { text: "Context-engine powered command packs (auto-loaded)" },
      { text: "Per-session toggles: autocomplete, AI suggestions, diagnostics" },
      { text: "Mutual-exclusive sidebar & AI chat panels" },
      { text: "Responsive layout — panels adapt to sidebar/chat state" },
    ],
    cta: { label: "Explore UX", href: "/ssh/connect" },
  },
  {
    category: "Security & Extensions",
    tagline: "Enterprise-grade, zero compromise",
    description:
      "End-to-end encryption, an encrypted key vault in IndexedDB, session resilience on disconnect, and a full extension marketplace. Install themes, grammars, and plugins from Open VSX or drag-and-drop .vsix files.",
    icon: Shield,
    color: "text-cyan-400",
    gradient: "from-cyan-500/20 via-cyan-500/5 to-transparent",
    borderGlow: "group-hover:shadow-cyan-500/10",
    highlights: [
      { text: "E2E encryption on all sessions & transfers" },
      { text: "Encrypted credential vault (browser IndexedDB)" },
      { text: "Open VSX marketplace & GitHub VSIX installs" },
      { text: "Drag-and-drop .vsix extension installer" },
      { text: "Session resilience & auto-reconnect" },
      { text: "Server status indicator & health monitoring" },
    ],
    cta: { label: "Learn More", href: "#about" },
  },
];

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export const Features = () => {
  return (
    <section id="features" className="container py-24 sm:py-32">
      {/* Header */}
      <div className="text-center space-y-4 mb-16">
        <Badge
          variant="outline"
          className="text-xs px-4 py-1 border-primary/30 text-primary tracking-wider uppercase"
        >
          Features
        </Badge>
        <h2 className="text-3xl md:text-5xl font-bold">
          One Platform.{" "}
          <span className="bg-gradient-to-b from-primary/60 to-primary text-transparent bg-clip-text">
            Every Tool You Need.
          </span>
        </h2>
        <p className="text-xl text-muted-foreground md:w-3/4 mx-auto lg:w-2/3">
          SSH, SFTP, Code Editor, AI, Collaboration, Extensions — a complete
          DevOps workspace running entirely in your browser.
        </p>
      </div>

      {/* Feature grid — 2 cols on desktop, stacked on mobile */}
      <div className="grid md:grid-cols-2 gap-6 max-w-6xl mx-auto">
        {features.map((feature) => {
          const Icon = feature.icon;
          return (
            <div
              key={feature.category}
              className={`group relative rounded-2xl border border-border/50 bg-gradient-to-br ${feature.gradient} p-8 transition-all duration-300 hover:border-primary/30 hover:shadow-xl ${feature.borderGlow}`}
            >
              {/* New badge */}
              {feature.isNew && (
                <div className="absolute top-4 right-4">
                  <Badge className="bg-primary/90 text-primary-foreground text-[10px] px-2 py-0.5">
                    NEW
                  </Badge>
                </div>
              )}

              {/* Icon + Category */}
              <div className="flex items-center gap-3 mb-4">
                <div
                  className={`flex items-center justify-center w-11 h-11 rounded-xl bg-background/80 border border-border/40 ${feature.color} transition-colors group-hover:bg-background`}
                >
                  <Icon className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-lg">{feature.category}</h3>
                  <p className="text-xs text-muted-foreground/80 italic">
                    {feature.tagline}
                  </p>
                </div>
              </div>

              {/* Description */}
              <p className="text-sm text-muted-foreground leading-relaxed mb-5">
                {feature.description}
              </p>

              {/* Highlight list */}
              <ul className="space-y-2 mb-6">
                {feature.highlights.map((h, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-2.5 text-sm text-foreground/80"
                  >
                    <span
                      className={`mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 ${feature.color.replace("text-", "bg-")}`}
                    />
                    {h.text}
                  </li>
                ))}
              </ul>

              {/* CTA link */}
              <Link
                to={feature.cta.href}
                className={`inline-flex items-center gap-1.5 text-sm font-medium ${feature.color} hover:underline underline-offset-4 transition-colors`}
              >
                {feature.cta.label}
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
              </Link>
            </div>
          );
        })}
      </div>
    </section>
  );
};
