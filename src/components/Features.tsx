import { useState } from "react";
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
  Puzzle,
  Palette,
  Zap,
  Check,
  type LucideIcon,
} from "lucide-react";
import { Link } from "react-router-dom";

/* ------------------------------------------------------------------ */
/*  Data                                                               */
/* ------------------------------------------------------------------ */

interface FeatureCard {
  category: string;
  tagline: string;
  description: string;
  icon: LucideIcon;
  themeKey: "emerald" | "amber" | "violet" | "blue" | "pink" | "teal" | "orange" | "cyan";
  filterCategory: "terminal" | "ai" | "editor" | "collab";
  color: string;
  accentBg: string;
  highlights: string[];
  cta: { label: string; href: string };
  isNew?: boolean;
  isFeatured?: boolean;
}

const colorThemes: Record<
  FeatureCard["themeKey"],
  {
    text: string;
    bg: string;
    border: string;
    hoverBorder: string;
    glow: string;
    dot: string;
    badge: string;
    ctaSolid?: string;
  }
> = {
  emerald: {
    text: "text-emerald-400",
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/20",
    hoverBorder: "hover:border-emerald-500/40",
    glow: "from-emerald-500/15",
    dot: "bg-emerald-400",
    badge: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
    ctaSolid: "bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-semibold shadow-emerald-500/20",
  },
  amber: {
    text: "text-amber-400",
    bg: "bg-amber-500/10",
    border: "border-amber-500/20",
    hoverBorder: "hover:border-amber-500/40",
    glow: "from-amber-500/15",
    dot: "bg-amber-400",
    badge: "bg-amber-500/15 text-amber-300 border-amber-500/30",
    ctaSolid: "bg-amber-500 hover:bg-amber-400 text-neutral-950 font-semibold shadow-amber-500/20",
  },
  violet: {
    text: "text-violet-400",
    bg: "bg-violet-500/10",
    border: "border-violet-500/20",
    hoverBorder: "hover:border-violet-500/40",
    glow: "from-violet-500/15",
    dot: "bg-violet-400",
    badge: "bg-violet-500/15 text-violet-300 border-violet-500/30",
  },
  blue: {
    text: "text-blue-400",
    bg: "bg-blue-500/10",
    border: "border-blue-500/20",
    hoverBorder: "hover:border-blue-500/40",
    glow: "from-blue-500/15",
    dot: "bg-blue-400",
    badge: "bg-blue-500/15 text-blue-300 border-blue-500/30",
  },
  pink: {
    text: "text-pink-400",
    bg: "bg-pink-500/10",
    border: "border-pink-500/20",
    hoverBorder: "hover:border-pink-500/40",
    glow: "from-pink-500/15",
    dot: "bg-pink-400",
    badge: "bg-pink-500/15 text-pink-300 border-pink-500/30",
  },
  teal: {
    text: "text-teal-400",
    bg: "bg-teal-500/10",
    border: "border-teal-500/20",
    hoverBorder: "hover:border-teal-500/40",
    glow: "from-teal-500/15",
    dot: "bg-teal-400",
    badge: "bg-teal-500/15 text-teal-300 border-teal-500/30",
  },
  orange: {
    text: "text-orange-400",
    bg: "bg-orange-500/10",
    border: "border-orange-500/20",
    hoverBorder: "hover:border-orange-500/40",
    glow: "from-orange-500/15",
    dot: "bg-orange-400",
    badge: "bg-orange-500/15 text-orange-300 border-orange-500/30",
  },
  cyan: {
    text: "text-cyan-400",
    bg: "bg-cyan-500/10",
    border: "border-cyan-500/20",
    hoverBorder: "hover:border-cyan-500/40",
    glow: "from-cyan-500/15",
    dot: "bg-cyan-400",
    badge: "bg-cyan-500/15 text-cyan-300 border-cyan-500/30",
  },
};

const features: FeatureCard[] = [
  {
    category: "SSH Terminal",
    tagline: "Your server, one click away",
    isNew: true,
    themeKey: "emerald",
    filterCategory: "terminal",
    description:
      "Full-featured web terminal with WebGL rendering, multi-tab sessions, split panes, a Docker control panel, and a customizable Widget Center. SSH into any server without leaving your browser.",
    icon: Terminal,
    color: "text-emerald-400",
    accentBg: "bg-emerald-500/10",
    highlights: [
      "Multi-tab & split terminal sessions",
      "Docker control panel — live container stats (Ctrl+Shift+D)",
      "Widget Center — custom & prebuilt server widgets",
      "Command blocks with ASCII-faithful output",
      "Live resource monitor — CPU/RAM/disk/net (Ctrl+Shift+M)",
      "Smart filesystem & command-aware autocomplete",
      "Idle auto-reconnect & session resilience",
      "Natural-language command palette (Ctrl+K)",
    ],
    cta: { label: "Launch Terminal", href: "/ssh/connect" },
    isFeatured: true,
  },
  {
    category: "AI Agent & Copilot",
    tagline: "Autonomous intelligence across your stack",
    isNew: true,
    themeKey: "amber",
    filterCategory: "ai",
    description:
      "An AI layer spanning terminal, editor, and SFTP. Ghost-text predictions, streaming chat, inline commands, and an autonomous agent that plans and executes multi-step tasks with safety rails.",
    icon: Sparkles,
    color: "text-amber-400",
    accentBg: "bg-amber-500/10",
    highlights: [
      "AI Agent — autonomous multi-step execution",
      "Explain any command before it runs (Ctrl+Shift+E)",
      "35+ dangerous-pattern safety checks",
      "Ghost-text autocomplete from AI & history",
      "Inline AI command bar (Ctrl+I)",
      "SSE streaming chat with multi-provider support",
      "Real-time diagnostics — AI explains & fixes errors",
    ],
    cta: { label: "Try AI Features", href: "/ssh/connect" },
    isFeatured: true,
  },
  {
    category: "Code Editor",
    tagline: "A full IDE in your browser",
    themeKey: "violet",
    filterCategory: "editor",
    description:
      "Monaco-powered editor with IntelliSense, 25+ themes, multi-tab split editing, LSP support, command palette, and live AI completions.",
    icon: Code2,
    color: "text-violet-400",
    accentBg: "bg-violet-500/10",
    highlights: [
      "Monaco Editor with full IntelliSense",
      "LSP support for 40+ languages",
      "Multi-tab, split-group & diff editing",
      "Command palette, minimap & sticky scroll",
      "AI ghost-text & inline completions",
      "Embedded terminal & NPM manager",
    ],
    cta: { label: "Open Editor", href: "/ssh/connect" },
  },
  {
    category: "SFTP File Manager",
    tagline: "Visual file management, reimagined",
    themeKey: "blue",
    filterCategory: "collab",
    description:
      "Browse, upload, download, rename, chmod, and manage files on remote servers with a visual tree interface, drag-and-drop, and real-time progress.",
    icon: FolderOpen,
    color: "text-blue-400",
    accentBg: "bg-blue-500/10",
    highlights: [
      "Multi-tab SFTP with breadcrumb navigation",
      "Drag-and-drop upload with progress bars",
      "13 context-menu actions (copy, move, chmod…)",
      "Inline media preview (images, video, audio)",
      "Persistent sessions & directory bookmarks",
      "Auto-reconnect on connection drop",
    ],
    cta: { label: "Manage Files", href: "/ssh/connect" },
  },
  {
    category: "Real-time Collaboration",
    tagline: "Multiplayer DevOps, built in",
    themeKey: "pink",
    filterCategory: "collab",
    description:
      "Share terminal sessions with a single link. Role-based permissions, live typing indicators, and admin controls for team workflows.",
    icon: Users,
    color: "text-pink-400",
    accentBg: "bg-pink-500/10",
    highlights: [
      "Real-time multi-user terminal sessions",
      "Shareable links with role-based access",
      "Live typing indicators for collaborators",
      "Admin panel: kick, block, lock PTY",
    ],
    cta: { label: "Start Sharing", href: "/ssh/connect" },
  },
  {
    category: "Smart Autocomplete",
    tagline: "Learns from every keystroke",
    themeKey: "teal",
    filterCategory: "terminal",
    description:
      "An intelligent suggestion engine combining shell history, command packs, and context-engine data. Ghost-text appears as you type with Tab to accept.",
    icon: Search,
    color: "text-teal-400",
    accentBg: "bg-teal-500/10",
    highlights: [
      "Ghost-text inline autocomplete (Tab / → to accept)",
      "Remote filesystem path completion (cd, ls, cat…)",
      "Suggestion box with keyboard navigation",
      "Context-engine powered command packs",
      "Per-session toggles for all suggestion sources",
    ],
    cta: { label: "Explore UX", href: "/ssh/connect" },
  },
  {
    category: "Extensions & Marketplace",
    tagline: "Extend everything, install anything",
    isNew: true,
    themeKey: "orange",
    filterCategory: "editor",
    description:
      "Full VS Code-style extension host with Open VSX marketplace integration. Install themes, grammars, language servers, and plugins — or drag-and-drop .vsix files.",
    icon: Puzzle,
    color: "text-orange-400",
    accentBg: "bg-orange-500/10",
    highlights: [
      "VS Code extension host with RPC worker",
      "Open VSX marketplace search & install",
      "Drag-and-drop .vsix installer",
      "Theme, grammar & snippet extensions",
    ],
    cta: { label: "Browse Extensions", href: "/ssh/connect" },
  },
  {
    category: "Security & Infrastructure",
    tagline: "Enterprise-grade, zero compromise",
    themeKey: "cyan",
    filterCategory: "collab",
    description:
      "End-to-end encryption, encrypted key vault, session resilience, and health monitoring. Built for teams that take security seriously.",
    icon: Shield,
    color: "text-cyan-400",
    accentBg: "bg-cyan-500/10",
    highlights: [
      "E2E encryption on all sessions & transfers",
      "Encrypted credential vault (browser IndexedDB)",
      "Session resilience & auto-reconnect",
      "Server health monitoring & status indicators",
    ],
    cta: { label: "Learn More", href: "#about" },
  },
];

/* ------------------------------------------------------------------ */
/*  Stats bar                                                          */
/* ------------------------------------------------------------------ */

const stats = [
  { value: "40+", label: "Languages", icon: Code2 },
  { value: "25+", label: "Editor Themes", icon: Palette },
  { value: "17+", label: "Terminal Themes", icon: Terminal },
  { value: "100%", label: "Browser-based", icon: Zap },
];

/* ------------------------------------------------------------------ */
/*  Helper: Highlight Item Formatter                                   */
/* ------------------------------------------------------------------ */

const HighlightItem = ({ text }: { text: string }) => {
  // Check for shortcut in parentheses at the end, e.g. (Ctrl+Shift+D) or (Tab / → to accept)
  const kbdMatch = text.match(/^(.*)\s+\(([^)]+)\)$/);
  const baseText = kbdMatch ? kbdMatch[1] : text;
  const shortcut = kbdMatch ? kbdMatch[2] : null;

  // Split on em-dash if present
  const dashParts = baseText.split(" — ");

  return (
    <span className="leading-snug">
      {dashParts.length === 2 ? (
        <>
          <span className="font-medium text-foreground">{dashParts[0]}</span>
          <span className="text-muted-foreground/60 mx-1">—</span>
          <span className="text-muted-foreground">{dashParts[1]}</span>
        </>
      ) : (
        <span className="text-foreground/85">{baseText}</span>
      )}
      {shortcut && (
        <kbd className="ml-1.5 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono font-medium bg-muted/80 text-muted-foreground border border-border/60 align-baseline">
          {shortcut}
        </kbd>
      )}
    </span>
  );
};

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export const Features = () => {
  const [activeFilter, setActiveFilter] = useState<string>("all");

  const filterTabs = [
    { id: "all", label: "All Features", count: features.length },
    { id: "terminal", label: "Terminal & Shell", count: features.filter(f => f.filterCategory === "terminal").length },
    { id: "ai", label: "AI & Intelligence", count: features.filter(f => f.filterCategory === "ai").length },
    { id: "editor", label: "IDE & Extensions", count: features.filter(f => f.filterCategory === "editor").length },
    { id: "collab", label: "Collab & Security", count: features.filter(f => f.filterCategory === "collab").length },
  ];

  const filteredFeatures = activeFilter === "all"
    ? features
    : features.filter(f => f.filterCategory === activeFilter);

  const featuredCards = filteredFeatures.filter(f => f.isFeatured);
  const standardCards = filteredFeatures.filter(f => !f.isFeatured);

  return (
    <section id="features" className="relative container py-24 sm:py-32 overflow-hidden">
      {/* Ambient background glow & radial gradient */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[350px] bg-primary/10 rounded-full blur-[140px] pointer-events-none -z-10" />
      <div className="absolute top-2/3 right-10 w-[450px] h-[280px] bg-emerald-500/5 rounded-full blur-[120px] pointer-events-none -z-10" />

      {/* Header */}
      <div className="text-center space-y-4 mb-12">
        <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full border border-primary/30 bg-primary/5 text-primary text-xs font-semibold uppercase tracking-wider backdrop-blur-sm">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
          </span>
          Platform
        </div>

        <h2 className="text-3xl md:text-5xl font-extrabold tracking-tight">
          Everything you need.{" "}
          <span className="bg-gradient-to-r from-emerald-400 via-primary to-teal-300 text-transparent bg-clip-text">
            Nothing you don't.
          </span>
        </h2>

        <p className="text-base sm:text-lg text-muted-foreground md:w-3/4 mx-auto lg:w-2/3 leading-relaxed">
          SSH, SFTP, Code Editor, AI Agent, Collaboration, Extensions — a
          complete cloud DevOps workspace in your browser.
        </p>
      </div>

      {/* Modern Glassmorphic Stats bar */}
      <div className="relative max-w-4xl mx-auto mb-14 rounded-2xl border border-border/50 bg-card/40 backdrop-blur-md p-1.5 shadow-xl shadow-black/20">
        <div className="grid grid-cols-2 md:grid-cols-4 divide-y md:divide-y-0 md:divide-x divide-border/40">
          {stats.map((s) => {
            const StatIcon = s.icon;
            return (
              <div
                key={s.label}
                className="group flex flex-col items-center justify-center p-4 sm:p-5 text-center transition-all hover:bg-white/[0.02] rounded-xl"
              >
                <div className="flex items-center gap-2 mb-1">
                  <StatIcon className="w-4 h-4 text-primary/70 transition-transform group-hover:scale-110" />
                  <span className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground group-hover:text-primary transition-colors">
                    {s.value}
                  </span>
                </div>
                <span className="text-xs font-medium text-muted-foreground tracking-wide uppercase">
                  {s.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Interactive Category Filter Pills */}
      <div className="flex items-center justify-center flex-wrap gap-2 mb-10 max-w-3xl mx-auto px-2">
        {filterTabs.map((tab) => {
          const isActive = activeFilter === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveFilter(tab.id)}
              className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-medium transition-all duration-200 border ${
                isActive
                  ? "bg-primary/15 text-primary border-primary/40 shadow-sm shadow-primary/10"
                  : "bg-secondary/40 text-muted-foreground border-border/50 hover:text-foreground hover:bg-secondary/70 hover:border-border"
              }`}
            >
              <span>{tab.label}</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                  isActive ? "bg-primary text-primary-foreground font-bold" : "bg-muted text-muted-foreground"
                }`}
              >
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Featured cards (Large Bento Spotlight — first 2 when visible) */}
      {featuredCards.length > 0 && (
        <div className={`grid ${featuredCards.length > 1 ? "md:grid-cols-2" : "grid-cols-1"} gap-6 max-w-6xl mx-auto mb-8`}>
          {featuredCards.map((feature) => {
            const Icon = feature.icon;
            const theme = colorThemes[feature.themeKey];
            return (
              <div
                key={feature.category}
                className={`group relative flex flex-col justify-between rounded-3xl border border-border/60 bg-gradient-to-b from-card/80 to-card/40 backdrop-blur-xl p-7 sm:p-8 transition-all duration-300 hover:border-border/80 ${theme.hoverBorder} hover:shadow-2xl hover:shadow-black/30`}
              >
                {/* Hairline gradient accent line */}
                <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-border to-transparent group-hover:via-primary/50 transition-all duration-500" />
                
                {/* Ambient glow in card background */}
                <div
                  className={`absolute -top-12 -right-12 w-48 h-48 bg-gradient-to-br ${theme.glow} to-transparent rounded-full blur-3xl opacity-50 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none`}
                />

                <div>
                  {/* Top Header Row */}
                  <div className="flex items-start justify-between gap-4 mb-6">
                    <div className="flex items-center gap-3.5">
                      <div
                        className={`flex items-center justify-center w-12 h-12 rounded-2xl ${theme.bg} ${theme.text} border ${theme.border} transition-transform duration-300 group-hover:scale-105 shadow-sm`}
                      >
                        <Icon className="w-6 h-6" />
                      </div>
                      <div>
                        <h3 className="font-bold text-lg sm:text-xl tracking-tight text-foreground">
                          {feature.category}
                        </h3>
                        <p className={`text-xs font-medium ${theme.text} tracking-wide`}>
                          {feature.tagline}
                        </p>
                      </div>
                    </div>

                    {feature.isNew && (
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${theme.badge}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${theme.dot} animate-pulse`} />
                        New
                      </span>
                    )}
                  </div>

                  {/* Description */}
                  <p className="text-sm text-muted-foreground leading-relaxed mb-6">
                    {feature.description}
                  </p>

                  {/* Highlights Grid (2-column on larger screens) */}
                  <div className="grid sm:grid-cols-2 gap-2.5 mb-7">
                    {feature.highlights.map((h, i) => (
                      <div
                        key={i}
                        className="flex items-start gap-2.5 p-2.5 rounded-xl bg-background/50 border border-border/40 hover:border-border/80 hover:bg-background/80 transition-all text-xs"
                      >
                        <div
                          className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-md ${theme.bg} ${theme.text} border ${theme.border}`}
                        >
                          <Check className="w-2.5 h-2.5" />
                        </div>
                        <HighlightItem text={h} />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Footer CTA */}
                <div className="pt-4 border-t border-border/40 flex items-center justify-between">
                  <Link
                    to={feature.cta.href}
                    className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold ${
                      theme.ctaSolid || "bg-secondary text-foreground hover:bg-secondary/80 border border-border/60"
                    } shadow-md transition-all duration-200 group/btn`}
                  >
                    <span>{feature.cta.label}</span>
                    <ArrowRight className="w-3.5 h-3.5 transition-transform duration-200 group-hover/btn:translate-x-1" />
                  </Link>

                  <span className="text-[11px] text-muted-foreground font-mono">
                    Ready in browser
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Standard cards grid */}
      {standardCards.length > 0 && (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 max-w-6xl mx-auto">
          {standardCards.map((feature) => {
            const Icon = feature.icon;
            const theme = colorThemes[feature.themeKey];
            return (
              <div
                key={feature.category}
                className={`group relative flex flex-col justify-between rounded-2xl border border-border/50 bg-gradient-to-b from-card/80 to-card/30 backdrop-blur-md p-6 transition-all duration-300 hover:-translate-y-1 hover:border-border/80 ${theme.hoverBorder} hover:shadow-xl hover:shadow-black/20`}
              >
                {/* Hairline gradient accent line */}
                <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-border to-transparent group-hover:via-primary/30 transition-all duration-500" />

                {/* Ambient glow in card background */}
                <div
                  className={`absolute top-0 right-0 w-32 h-32 bg-gradient-to-br ${theme.glow} to-transparent rounded-full blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none`}
                />

                <div>
                  {/* Card Header */}
                  <div className="flex items-start justify-between gap-3 mb-4">
                    <div className="flex items-center gap-3">
                      <div
                        className={`flex items-center justify-center w-11 h-11 rounded-xl ${theme.bg} ${theme.text} border ${theme.border} transition-transform duration-300 group-hover:scale-105 shadow-sm`}
                      >
                        <Icon className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="font-bold text-base tracking-tight text-foreground">
                          {feature.category}
                        </h3>
                        <p className="text-xs text-muted-foreground">
                          {feature.tagline}
                        </p>
                      </div>
                    </div>

                    {feature.isNew && (
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${theme.badge}`}>
                        <span className={`w-1 h-1 rounded-full ${theme.dot} animate-pulse`} />
                        New
                      </span>
                    )}
                  </div>

                  {/* Description */}
                  <p className="text-xs text-muted-foreground leading-relaxed mb-4 min-h-[44px]">
                    {feature.description}
                  </p>

                  {/* Highlights list */}
                  <ul className="space-y-2 mb-6">
                    {feature.highlights.map((h, i) => (
                      <li key={i} className="flex items-start gap-2.5 text-xs text-foreground/80">
                        <span className={`mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 ${theme.dot}`} />
                        <HighlightItem text={h} />
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Card Footer CTA */}
                <div className="pt-4 mt-auto border-t border-border/30 flex items-center justify-between">
                  <Link
                    to={feature.cta.href}
                    className={`inline-flex items-center gap-1.5 text-xs font-semibold ${theme.text} hover:underline underline-offset-4 transition-all group/link`}
                  >
                    <span>{feature.cta.label}</span>
                    <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover/link:translate-x-1" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
};