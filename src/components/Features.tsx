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
  color: string;
  accentBg: string;
  highlights: string[];
  cta: { label: string; href: string };
  isNew?: boolean;
  isFeatured?: boolean;
}

const features: FeatureCard[] = [
  {
    category: "SSH Terminal",
    tagline: "Your server, one click away",
    description:
      "Full-featured web terminal with WebGL rendering, multi-tab sessions, split panes, and 17+ themes. SSH into any server without leaving your browser.",
    icon: Terminal,
    color: "text-emerald-400",
    accentBg: "bg-emerald-500/10",
    highlights: [
      "Multi-tab & split terminal sessions",
      "Password & private-key authentication",
      "17+ themes with per-session customization",
      "Idle auto-reconnect & session resilience",
      "Command palette (PM2, Nginx, Docker)",
      "VS Code-style search bar (Ctrl+F)",
    ],
    cta: { label: "Launch Terminal", href: "/ssh/connect" },
    isFeatured: true,
  },
  {
    category: "AI Agent & Copilot",
    tagline: "Autonomous intelligence across your stack",
    isNew: true,
    description:
      "An AI layer spanning terminal, editor, and SFTP. Ghost-text predictions, streaming chat, inline commands, and an autonomous agent that plans and executes multi-step tasks with safety rails.",
    icon: Sparkles,
    color: "text-amber-400",
    accentBg: "bg-amber-500/10",
    highlights: [
      "AI Agent — autonomous multi-step execution",
      "35+ dangerous-pattern safety checks",
      "Ghost-text autocomplete from AI & history",
      "Inline AI command bar (Ctrl+Shift+I)",
      "SSE streaming chat with multi-provider support",
      "Real-time diagnostics — AI explains & fixes errors",
    ],
    cta: { label: "Try AI Features", href: "/ssh/connect" },
    isFeatured: true,
  },
  {
    category: "Code Editor",
    tagline: "A full IDE in your browser",
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
    description:
      "An intelligent suggestion engine combining shell history, command packs, and context-engine data. Ghost-text appears as you type with Tab to accept.",
    icon: Search,
    color: "text-teal-400",
    accentBg: "bg-teal-500/10",
    highlights: [
      "Ghost-text inline autocomplete (Tab / → to accept)",
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
  { value: "40+", label: "Languages" },
  { value: "25+", label: "Editor Themes" },
  { value: "17+", label: "Terminal Themes" },
  { value: "100%", label: "Browser-based" },
];

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export const Features = () => {
  return (
    <section id="features" className="container py-24 sm:py-32">
      {/* Header */}
      <div className="text-center space-y-4 mb-8">
        <Badge
          variant="outline"
          className="text-xs px-4 py-1 border-primary/30 text-primary tracking-wider uppercase"
        >
          Platform
        </Badge>
        <h2 className="text-3xl md:text-5xl font-bold tracking-tight">
          Everything you need.{" "}
          <span className="bg-gradient-to-r from-primary/80 to-primary text-transparent bg-clip-text">
            Nothing you don't.
          </span>
        </h2>
        <p className="text-lg text-muted-foreground md:w-3/4 mx-auto lg:w-2/3 leading-relaxed">
          SSH, SFTP, Code Editor, AI Agent, Collaboration, Extensions — a
          complete cloud DevOps workspace in your browser.
        </p>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-3xl mx-auto mb-16">
        {stats.map((s) => (
          <div key={s.label} className="text-center py-4 rounded-xl border border-border/40 bg-card/50">
            <div className="text-2xl font-bold text-primary">{s.value}</div>
            <div className="text-xs text-muted-foreground mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Featured cards (large — first 2) */}
      <div className="grid md:grid-cols-2 gap-6 max-w-6xl mx-auto mb-6">
        {features.filter((f) => f.isFeatured).map((feature) => {
          const Icon = feature.icon;
          return (
            <div
              key={feature.category}
              className="group relative rounded-2xl border border-border/40 bg-card/50 backdrop-blur-sm p-8 transition-all duration-300 hover:border-primary/30 hover:shadow-xl hover:shadow-primary/5 hover:-translate-y-0.5"
            >
              {feature.isNew && (
                <div className="absolute top-4 right-4">
                  <Badge className="bg-primary text-primary-foreground text-[10px] px-2.5 py-0.5 uppercase tracking-wide font-semibold">
                    New
                  </Badge>
                </div>
              )}

              <div className="flex items-center gap-3 mb-5">
                <div className={`flex items-center justify-center w-12 h-12 rounded-xl ${feature.accentBg} ${feature.color} transition-transform group-hover:scale-110`}>
                  <Icon className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-lg tracking-tight">{feature.category}</h3>
                  <p className="text-xs text-muted-foreground">{feature.tagline}</p>
                </div>
              </div>

              <p className="text-sm text-muted-foreground leading-relaxed mb-6">
                {feature.description}
              </p>

              <ul className="space-y-2.5 mb-6">
                {feature.highlights.map((h, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-sm text-foreground/80">
                    <span className={`mt-[7px] w-1.5 h-1.5 rounded-full shrink-0 ${feature.color.replace("text-", "bg-")}`} />
                    {h}
                  </li>
                ))}
              </ul>

              <Link
                to={feature.cta.href}
                className={`inline-flex items-center gap-1.5 text-sm font-medium ${feature.color} hover:underline underline-offset-4 transition-all`}
              >
                {feature.cta.label}
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
              </Link>
            </div>
          );
        })}
      </div>

      {/* Standard cards grid */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 max-w-6xl mx-auto">
        {features.filter((f) => !f.isFeatured).map((feature) => {
          const Icon = feature.icon;
          return (
            <div
              key={feature.category}
              className="group relative rounded-xl border border-border/40 bg-card/50 backdrop-blur-sm p-6 transition-all duration-300 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5 hover:-translate-y-0.5"
            >
              {feature.isNew && (
                <div className="absolute top-3 right-3">
                  <Badge className="bg-primary text-primary-foreground text-[9px] px-2 py-0.5 uppercase tracking-wide font-semibold">
                    New
                  </Badge>
                </div>
              )}

              <div className="flex items-center gap-3 mb-4">
                <div className={`flex items-center justify-center w-10 h-10 rounded-lg ${feature.accentBg} ${feature.color} transition-transform group-hover:scale-110`}>
                  <Icon className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-[15px] tracking-tight">{feature.category}</h3>
                  <p className="text-[11px] text-muted-foreground">{feature.tagline}</p>
                </div>
              </div>

              <p className="text-[13px] text-muted-foreground leading-relaxed mb-4">
                {feature.description}
              </p>

              <ul className="space-y-2 mb-5">
                {feature.highlights.map((h, i) => (
                  <li key={i} className="flex items-start gap-2 text-[13px] text-foreground/75">
                    <span className={`mt-[6px] w-1 h-1 rounded-full shrink-0 ${feature.color.replace("text-", "bg-")}`} />
                    {h}
                  </li>
                ))}
              </ul>

              <Link
                to={feature.cta.href}
                className={`inline-flex items-center gap-1 text-[13px] font-medium ${feature.color} hover:underline underline-offset-4 transition-all`}
              >
                {feature.cta.label}
                <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
              </Link>
            </div>
          );
        })}
      </div>
    </section>
  );
};
