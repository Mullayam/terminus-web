import { useState, useEffect } from "react";
import {
  Terminal,
  Code2,
  FolderTree,
  Users,
  Sparkles,
  Shield,
  Palette,
  Zap,
  ArrowRight,
  Settings,
  Search,
  Command,
  Share2,
  MessageSquare,
  Bot,
  Boxes,
  Activity,
  Gauge,
  SquareTerminal,
  Columns2,
  PanelsTopLeft,
  SlidersHorizontal,
  type LucideIcon,
} from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";

/* ------------------------------------------------------------------ */
/*  Data: each showcase is a "product ad" slide                        */
/* ------------------------------------------------------------------ */
interface Callout {
  label: string;
  icon: React.ReactNode;
  position: string;
  animation: string;
}

interface ShowcaseSlide {
  id: string;
  tagline: string;
  headline: string;
  description: string;
  image: string;
  icon: LucideIcon;
  gradient: string;
  glowColor: string;
  callouts: Callout[];
  cta: { label: string; href: string };
}

const slides: ShowcaseSlide[] = [
  {
    id: "command-palette",
    tagline: "Command Palette",
    headline: "Every Command, One Keystroke Away",
    description:
      "Open the command palette for 174+ smart suggestions, natural-language \"Ask AI\" commands, one-tap git actions, and fuzzy shell-history search. Discover and run anything without memorizing a single flag.",
    image: "/1.png",
    icon: Command,
    gradient: "from-green-500/30 via-emerald-500/10 to-transparent",
    glowColor: "bg-green-500/20",
    callouts: [
      {
        label: "Command Palette",
        icon: <Command className="w-3.5 h-3.5" />,
        position: "top-8 -right-3 lg:right-4",
        animation: "animate-float",
      },
      {
        label: "Ask AI Commands",
        icon: <Sparkles className="w-3.5 h-3.5" />,
        position: "bottom-20 -left-3 lg:left-4",
        animation: "animate-float-delayed",
      },
      {
        label: "Git Quick-Actions",
        icon: <Terminal className="w-3.5 h-3.5" />,
        position: "bottom-8 -right-3 lg:right-8",
        animation: "animate-float",
      },
    ],
    cta: { label: "Launch Terminal", href: "/ssh/connect" },
  },
  {
    id: "settings",
    tagline: "Customization",
    headline: "Make It Yours",
    description:
      "17+ terminal themes, per-session font size & weight controls, behavior toggles for autocomplete, AI suggestions, and diagnostics. Every detail is customizable.",
    image: "/2.png",
    icon: Settings,
    gradient: "from-orange-500/30 via-amber-500/10 to-transparent",
    glowColor: "bg-orange-500/20",
    callouts: [
      {
        label: "17+ Themes",
        icon: <Palette className="w-3.5 h-3.5" />,
        position: "top-8 -right-3 lg:right-4",
        animation: "animate-float",
      },
      {
        label: "Font Customization",
        icon: <Settings className="w-3.5 h-3.5" />,
        position: "bottom-20 -left-3 lg:left-4",
        animation: "animate-float-delayed",
      },
      {
        label: "Per-Session Settings",
        icon: <Zap className="w-3.5 h-3.5" />,
        position: "bottom-8 -right-3 lg:right-8",
        animation: "animate-float",
      },
    ],
    cta: { label: "Customize Now", href: "/ssh/connect" },
  },
  {
    id: "collab",
    tagline: "Collaboration",
    headline: "Share Your Terminal. Work Together.",
    description:
      "Spin up a shared session in one click and hand out a single link. Role-based permissions, real-time keystroke sync, live typing indicators, and one-click kick or ban controls — multiplayer DevOps.",
    image: "/3.png",
    icon: Share2,
    gradient: "from-pink-500/30 via-rose-500/10 to-transparent",
    glowColor: "bg-pink-500/20",
    callouts: [
      {
        label: "One-Click Sessions",
        icon: <Share2 className="w-3.5 h-3.5" />,
        position: "top-8 -left-3 lg:left-4",
        animation: "animate-float",
      },
      {
        label: "Role Permissions",
        icon: <Shield className="w-3.5 h-3.5" />,
        position: "top-12 -right-3 lg:right-4",
        animation: "animate-float-delayed",
      },
      {
        label: "Real-Time Sync",
        icon: <Users className="w-3.5 h-3.5" />,
        position: "bottom-12 -left-3 lg:left-8",
        animation: "animate-float",
      },
    ],
    cta: { label: "Start Sharing", href: "/ssh/connect" },
  },
  {
    id: "sftp",
    tagline: "SFTP Manager",
    headline: "Visual File Management, Reimagined",
    description:
      "Browse, upload, download, rename, chmod, and delete through a visual file-tree. A rich right-click menu adds compress to ZIP/TAR.GZ, extract, duplicate, copy content, and permission checks — with drag-and-drop uploads and inline media preview.",
    image: "/4.png",
    icon: FolderTree,
    gradient: "from-blue-500/30 via-cyan-500/10 to-transparent",
    glowColor: "bg-blue-500/20",
    callouts: [
      {
        label: "Compress & Extract",
        icon: <FolderTree className="w-3.5 h-3.5" />,
        position: "top-10 -right-3 lg:right-4",
        animation: "animate-float",
      },
      {
        label: "Full Context Menu",
        icon: <Zap className="w-3.5 h-3.5" />,
        position: "bottom-16 -left-3 lg:left-4",
        animation: "animate-float-delayed",
      },
      {
        label: "Media Preview",
        icon: <Search className="w-3.5 h-3.5" />,
        position: "bottom-8 -right-3 lg:right-8",
        animation: "animate-float",
      },
    ],
    cta: { label: "Manage Files", href: "/ssh/connect" },
  },
  {
    id: "editor-ai",
    tagline: "Editor + AI Chat",
    headline: "A Full IDE in Your Browser",
    description:
      "Monaco-powered editor with a rich right-click menu — format with Prettier, lint with ESLint, fetch snippets, change all occurrences, and open the command palette. A built-in AI Chat panel explains code and drafts changes right beside your file.",
    image: "/5.png",
    icon: MessageSquare,
    gradient: "from-violet-500/30 via-purple-500/10 to-transparent",
    glowColor: "bg-violet-500/20",
    callouts: [
      {
        label: "Prettier & ESLint",
        icon: <Code2 className="w-3.5 h-3.5" />,
        position: "top-8 -left-3 lg:left-4",
        animation: "animate-float",
      },
      {
        label: "Built-in AI Chat",
        icon: <Bot className="w-3.5 h-3.5" />,
        position: "top-12 -right-3 lg:right-4",
        animation: "animate-float-delayed",
      },
      {
        label: "Fetch Snippets",
        icon: <Sparkles className="w-3.5 h-3.5" />,
        position: "bottom-16 -left-3 lg:left-8",
        animation: "animate-float",
      },
    ],
    cta: { label: "Open Editor", href: "/ssh/connect" },
  },
  {
    id: "ai-completion",
    tagline: "AI Code Completion",
    headline: "Ghost-Text That Writes With You",
    description:
      "Inline AI completions appear as ghost text as you type — accept a word or the whole suggestion with a keystroke. Powered by a collection of LLM providers you can switch on the fly, with an AI Chat sidebar for deeper help.",
    image: "/6.png",
    icon: Bot,
    gradient: "from-fuchsia-500/30 via-pink-500/10 to-transparent",
    glowColor: "bg-fuchsia-500/20",
    callouts: [
      {
        label: "Ghost-Text AI",
        icon: <Sparkles className="w-3.5 h-3.5" />,
        position: "top-8 -right-3 lg:right-4",
        animation: "animate-float",
      },
      {
        label: "Multiple LLM Providers",
        icon: <Bot className="w-3.5 h-3.5" />,
        position: "bottom-20 -left-3 lg:left-4",
        animation: "animate-float-delayed",
      },
      {
        label: "Accept Word / Line",
        icon: <Code2 className="w-3.5 h-3.5" />,
        position: "bottom-8 -right-3 lg:right-8",
        animation: "animate-float",
      },
    ],
    cta: { label: "Try AI Completion", href: "/ssh/connect" },
  },
  {
    id: "docker-monitor",
    tagline: "Docker & Monitoring",
    headline: "Run Ops Without Leaving the Terminal",
    description:
      "Manage Docker containers with start, stop, restart, and remove controls, watch a live resource monitor for CPU, memory, disk, and network, and pin prebuilt widgets — top processes, listening ports, running services, and more.",
    image: "/7.png",
    icon: Boxes,
    gradient: "from-sky-500/30 via-blue-500/10 to-transparent",
    glowColor: "bg-sky-500/20",
    callouts: [
      {
        label: "Docker Control",
        icon: <Boxes className="w-3.5 h-3.5" />,
        position: "top-8 -right-3 lg:right-4",
        animation: "animate-float",
      },
      {
        label: "Resource Monitor",
        icon: <Activity className="w-3.5 h-3.5" />,
        position: "bottom-20 -left-3 lg:left-4",
        animation: "animate-float-delayed",
      },
      {
        label: "Live Widget Center",
        icon: <Gauge className="w-3.5 h-3.5" />,
        position: "bottom-8 -right-3 lg:right-8",
        animation: "animate-float",
      },
    ],
    cta: { label: "Open Dashboard", href: "/ssh/connect" },
  },
  {
    id: "embedded",
    tagline: "Embedded Terminal",
    headline: "Editor + Terminal, Side by Side",
    description:
      "Split your workspace with an embedded terminal panel below the editor. Run commands, see output, and edit code — all without switching tabs. Resize, minimize, or go full-screen.",
    image: "/8.png",
    icon: SquareTerminal,
    gradient: "from-emerald-500/30 via-green-500/10 to-transparent",
    glowColor: "bg-emerald-500/20",
    callouts: [
      {
        label: "Embedded Terminal",
        icon: <Terminal className="w-3.5 h-3.5" />,
        position: "top-8 -right-3 lg:right-4",
        animation: "animate-float",
      },
      {
        label: "Resizable Panels",
        icon: <Zap className="w-3.5 h-3.5" />,
        position: "bottom-16 -left-3 lg:left-4",
        animation: "animate-float-delayed",
      },
      {
        label: "Full-Screen Mode",
        icon: <Sparkles className="w-3.5 h-3.5" />,
        position: "bottom-8 -right-3 lg:right-8",
        animation: "animate-float",
      },
    ],
    cta: { label: "Try It Now", href: "/ssh/connect" },
  },
  {
    id: "split-panes",
    tagline: "Split Panes",
    headline: "Every Session, One Screen",
    description:
      "Split the terminal into stacked or side-by-side panes and drive multiple servers at once. Tabbed sessions, per-pane command blocks, and instant switching keep parallel work organized.",
    image: "/10.png",
    icon: Columns2,
    gradient: "from-teal-500/30 via-cyan-500/10 to-transparent",
    glowColor: "bg-teal-500/20",
    callouts: [
      {
        label: "Split Panes",
        icon: <Columns2 className="w-3.5 h-3.5" />,
        position: "top-8 -left-3 lg:left-4",
        animation: "animate-float",
      },
      {
        label: "Multi-Session Tabs",
        icon: <Terminal className="w-3.5 h-3.5" />,
        position: "top-12 -right-3 lg:right-4",
        animation: "animate-float-delayed",
      },
      {
        label: "Command Blocks",
        icon: <Zap className="w-3.5 h-3.5" />,
        position: "bottom-12 -left-3 lg:left-8",
        animation: "animate-float",
      },
    ],
    cta: { label: "Open Split View", href: "/ssh/connect" },
  },
  {
    id: "workspace",
    tagline: "Remote Workspace",
    headline: "A VS Code-Style Home for Your Servers",
    description:
      "A familiar editor workspace with a welcome dashboard, saved SFTP connections in the sidebar, and one-click reconnect. Manage every host from a single remote code editor.",
    image: "/11.png",
    icon: PanelsTopLeft,
    gradient: "from-indigo-500/30 via-violet-500/10 to-transparent",
    glowColor: "bg-indigo-500/20",
    callouts: [
      {
        label: "Remote Workspace",
        icon: <PanelsTopLeft className="w-3.5 h-3.5" />,
        position: "top-8 -left-3 lg:left-4",
        animation: "animate-float",
      },
      {
        label: "Saved Connections",
        icon: <FolderTree className="w-3.5 h-3.5" />,
        position: "top-12 -right-3 lg:right-4",
        animation: "animate-float-delayed",
      },
      {
        label: "One-Click Reconnect",
        icon: <Shield className="w-3.5 h-3.5" />,
        position: "bottom-16 -left-3 lg:left-8",
        animation: "animate-float",
      },
    ],
    cta: { label: "Open Workspace", href: "/ssh/connect" },
  },
  {
    id: "behavior",
    tagline: "Behavior Controls",
    headline: "Tune Every Terminal Behavior",
    description:
      "Toggle exactly what you want — ghost-text autocomplete, the AI suggestion box, the Ctrl+K command palette, explain-before-run, command blocks, diagnostics, and notifications — plus fine-grained font weight controls.",
    image: "/12.png",
    icon: SlidersHorizontal,
    gradient: "from-amber-500/30 via-yellow-500/10 to-transparent",
    glowColor: "bg-amber-500/20",
    callouts: [
      {
        label: "Behavior Toggles",
        icon: <SlidersHorizontal className="w-3.5 h-3.5" />,
        position: "top-8 -right-3 lg:right-4",
        animation: "animate-float",
      },
      {
        label: "Explain Command",
        icon: <Sparkles className="w-3.5 h-3.5" />,
        position: "bottom-20 -left-3 lg:left-4",
        animation: "animate-float-delayed",
      },
      {
        label: "Command Blocks",
        icon: <Zap className="w-3.5 h-3.5" />,
        position: "bottom-8 -right-3 lg:right-8",
        animation: "animate-float",
      },
    ],
    cta: { label: "Adjust Behavior", href: "/ssh/connect" },
  },
];

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */
export const ProductShowcase = () => {
  const [active, setActive] = useState(0);
  const slide = slides[active];

  // Auto-rotate slides every 5 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      setActive((prev) => (prev + 1) % slides.length);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  return (
    <section className="relative py-24 sm:py-32 overflow-hidden">
      {/* Ambient background */}
      <div className="absolute inset-0 -z-10">
        <div
          className={`absolute inset-0 bg-gradient-to-br ${slide.gradient} transition-all duration-700`}
        />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full blur-[120px] opacity-30 transition-colors duration-700" style={{ backgroundColor: `var(--showcase-glow)` }} />
      </div>

      <div className="container">
        {/* Section header */}
        <div className="text-center mb-16 space-y-4">
          <Badge
            variant="outline"
            className="text-sm px-4 py-1 border-primary/30 text-primary"
          >
            Product Showcase
          </Badge>
          <h2 className="text-3xl md:text-5xl font-bold">
            Everything You Need.{" "}
            <span className="bg-gradient-to-r from-primary to-primary/60 text-transparent bg-clip-text">
              Nothing You Don't.
            </span>
          </h2>
        </div>

        {/* Tab navigation — scrollable on mobile */}
        <div className="flex flex-wrap justify-center gap-2 mb-12">
          {slides.map((s, i) => {
            const Icon = s.icon;
            return (
              <button
                key={s.id}
                onClick={() => setActive(i)}
                className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all duration-300 ${
                  i === active
                    ? "bg-primary text-primary-foreground shadow-lg shadow-primary/25"
                    : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground border border-border/40"
                }`}
              >
                <Icon className="w-4 h-4" />
                <span className="hidden sm:inline">{s.tagline}</span>
              </button>
            );
          })}
        </div>

        {/* Progress bar */}
        <div className="flex justify-center gap-1.5 mb-8">
          {slides.map((_, i) => (
            <button
              key={i}
              onClick={() => setActive(i)}
              className="relative h-1 rounded-full overflow-hidden transition-all duration-300"
              style={{ width: i === active ? 32 : 12 }}
            >
              <span className={`absolute inset-0 rounded-full transition-colors duration-300 ${
                i === active ? "bg-primary" : "bg-muted-foreground/20"
              }`} />
            </button>
          ))}
        </div>

        {/* Main showcase */}
        <div className="grid lg:grid-cols-5 gap-12 items-center max-w-6xl mx-auto">
          {/* Left — Copy (2 cols) */}
          <div className="lg:col-span-2 space-y-6 text-center lg:text-left">
            <span className="inline-block text-xs font-bold tracking-widest uppercase text-primary">
              {slide.tagline}
            </span>
            <h3 className="text-3xl md:text-4xl font-bold leading-tight">
              {slide.headline}
            </h3>
            <p className="text-lg text-muted-foreground leading-relaxed">
              {slide.description}
            </p>
            <Link to={slide.cta.href}>
              <Button size="lg" className="gap-2 group mt-2">
                {slide.cta.label}
                <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
              </Button>
            </Link>
          </div>

          {/* Right — Product screenshot with floating callouts (3 cols) */}
          <div className="lg:col-span-3 relative">
            {/* Outer glow ring */}
            <div
              className={`absolute -inset-6 rounded-3xl ${slide.glowColor} blur-3xl animate-pulse-glow transition-colors duration-700`}
            />

            {/* The product frame */}
            <div className="relative group">
              {/* Browser chrome */}
              <div className="relative rounded-2xl border border-border/50 bg-[#0A0A0A] overflow-hidden shadow-2xl shadow-black/40">
                {/* Title bar */}
                <div className="flex items-center gap-2 px-4 py-3 border-b border-border/30 bg-[#111111]">
                  <div className="flex gap-1.5">
                    <span className="w-3 h-3 rounded-full bg-[#FF5F57]" />
                    <span className="w-3 h-3 rounded-full bg-[#FFBD2E]" />
                    <span className="w-3 h-3 rounded-full bg-[#27C93F]" />
                  </div>
                  <div className="flex-1 mx-6">
                    <div className="mx-auto max-w-xs h-6 rounded-lg bg-[#1a1a1a] border border-border/20 flex items-center justify-center gap-2">
                      <Shield className="w-3 h-3 text-green-500/60" />
                      <span className="text-[11px] text-muted-foreground/50 font-mono">
                        terminus.enjoys.in
                      </span>
                    </div>
                  </div>
                </div>

                {/* Screenshot with subtle zoom on hover */}
                <div className="relative overflow-hidden">
                  {slides.map((s, i) => (
                    <img
                      key={s.id}
                      src={s.image}
                      alt={s.headline}
                      className={`w-full object-cover transition-all duration-700 ${
                        i === active
                          ? "opacity-100 scale-100"
                          : "opacity-0 scale-105 absolute inset-0"
                      }`}
                    />
                  ))}

                  {/* Subtle gradient overlay at bottom */}
                  <div className="absolute bottom-0 inset-x-0 h-20 bg-gradient-to-t from-[#0A0A0A]/60 to-transparent pointer-events-none" />
                </div>
              </div>

              {/* ---- Floating callout badges ---- */}
              {slide.callouts.map((callout, idx) => (
                <div
                  key={`${slide.id}-${idx}`}
                  className={`absolute ${callout.position} ${callout.animation} z-20 hidden sm:flex`}
                >
                  <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-card/90 border border-border/50 shadow-xl backdrop-blur-md text-xs font-semibold">
                    <div className="p-1 rounded-md bg-primary/10 text-primary">
                      {callout.icon}
                    </div>
                    {callout.label}
                  </div>
                </div>
              ))}
            </div>

            {/* Bottom badge strip — mini feature pills */}
            <div className="flex flex-wrap justify-center gap-2 mt-6">
              {slide.callouts.map((c, i) => (
                <span
                  key={i}
                  className="sm:hidden inline-flex items-center gap-1.5 text-[11px] px-3 py-1.5 rounded-full bg-muted/60 border border-border/30 text-muted-foreground"
                >
                  <span className="text-primary">{c.icon}</span>
                  {c.label}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
