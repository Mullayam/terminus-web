import { useState } from "react";
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
  position: string; // tailwind absolute positioning classes
  animation: string;
}

interface ShowcaseSlide {
  id: string;
  tagline: string;
  headline: string;
  description: string;
  image: string;
  gradient: string;
  glowColor: string;
  callouts: Callout[];
  cta: { label: string; href: string };
}

const slides: ShowcaseSlide[] = [
  {
    id: "terminal",
    tagline: "SSH Terminal",
    headline: "Your Server, One Click Away",
    description:
      "Full xterm.js terminal with 17+ themes, font customization, search, image rendering, and ligature support. Connect to any server in seconds.",
    image: "/2.png",
    gradient: "from-green-500/30 via-emerald-500/10 to-transparent",
    glowColor: "bg-green-500/20",
    callouts: [
      {
        label: "17+ Terminal Themes",
        icon: <Palette className="w-3.5 h-3.5" />,
        position: "top-8 -right-3 lg:right-4",
        animation: "animate-float",
      },
      {
        label: "Search & Highlight",
        icon: <Zap className="w-3.5 h-3.5" />,
        position: "bottom-20 -left-3 lg:left-4",
        animation: "animate-float-delayed",
      },
      {
        label: "Encrypted Sessions",
        icon: <Shield className="w-3.5 h-3.5" />,
        position: "bottom-8 -right-3 lg:right-8",
        animation: "animate-float",
      },
    ],
    cta: { label: "Launch Terminal", href: "/ssh/connect" },
  },
  {
    id: "editor",
    tagline: "Code Editor",
    headline: "A Full IDE in Your Browser",
    description:
      "Monaco-powered editor with IntelliSense, 25+ themes, multi-tab editing, command palette, minimap, bracket colorization, and AI ghost-text completions.",
    image: "/7.png",
    gradient: "from-violet-500/30 via-purple-500/10 to-transparent",
    glowColor: "bg-violet-500/20",
    callouts: [
      {
        label: "IntelliSense",
        icon: <Code2 className="w-3.5 h-3.5" />,
        position: "top-8 -left-3 lg:left-4",
        animation: "animate-float",
      },
      {
        label: "AI Completions",
        icon: <Sparkles className="w-3.5 h-3.5" />,
        position: "top-12 -right-3 lg:right-4",
        animation: "animate-float-delayed",
      },
      {
        label: "25+ Themes",
        icon: <Palette className="w-3.5 h-3.5" />,
        position: "bottom-16 -left-3 lg:left-8",
        animation: "animate-float",
      },
    ],
    cta: { label: "Open Editor", href: "/ssh/connect" },
  },
  {
    id: "sftp",
    tagline: "SFTP Manager",
    headline: "Visual File Management, Reimagined",
    description:
      "Browse, upload, download, rename, chmod — all with a visual file tree, drag-and-drop, context menus, and real-time progress tracking.",
    image: "/4.png",
    gradient: "from-blue-500/30 via-cyan-500/10 to-transparent",
    glowColor: "bg-blue-500/20",
    callouts: [
      {
        label: "Drag & Drop Upload",
        icon: <FolderTree className="w-3.5 h-3.5" />,
        position: "top-10 -right-3 lg:right-4",
        animation: "animate-float",
      },
      {
        label: "Context Menus",
        icon: <Zap className="w-3.5 h-3.5" />,
        position: "bottom-16 -left-3 lg:left-4",
        animation: "animate-float-delayed",
      },
      {
        label: "13 Actions",
        icon: <Shield className="w-3.5 h-3.5" />,
        position: "bottom-8 -right-3 lg:right-8",
        animation: "animate-float",
      },
    ],
    cta: { label: "Manage Files", href: "/ssh/connect" },
  },
  {
    id: "collab",
    tagline: "Collaborative Terminal",
    headline: "Share Your Terminal. Work Together.",
    description:
      "One link, instant access. Role-based permissions, real-time sync, ghost-text lock overlays, kick & ban controls — multiplayer DevOps.",
    image: "/6.png",
    gradient: "from-pink-500/30 via-rose-500/10 to-transparent",
    glowColor: "bg-pink-500/20",
    callouts: [
      {
        label: "Real-Time Sync",
        icon: <Users className="w-3.5 h-3.5" />,
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
        label: "Kick & Ban",
        icon: <Zap className="w-3.5 h-3.5" />,
        position: "bottom-12 -left-3 lg:left-8",
        animation: "animate-float",
      },
    ],
    cta: { label: "Start Sharing", href: "/ssh/connect" },
  },
];

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */
export const ProductShowcase = () => {
  const [active, setActive] = useState(0);
  const slide = slides[active];

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

        {/* Tab navigation */}
        <div className="flex flex-wrap justify-center gap-2 mb-12">
          {slides.map((s, i) => (
            <button
              key={s.id}
              onClick={() => setActive(i)}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-medium transition-all duration-300 ${
                i === active
                  ? "bg-primary text-primary-foreground shadow-lg shadow-primary/25"
                  : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground border border-border/40"
              }`}
            >
              {s.id === "terminal" && <Terminal className="w-4 h-4" />}
              {s.id === "editor" && <Code2 className="w-4 h-4" />}
              {s.id === "sftp" && <FolderTree className="w-4 h-4" />}
              {s.id === "collab" && <Users className="w-4 h-4" />}
              {s.tagline}
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
