import {
  Terminal,
  Code2,
  FolderTree,
  Users,
  Palette,
  Sparkles,
  Shield,
  Search,
  Upload,
  Settings,
  Puzzle,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { Badge } from "./ui/badge";

interface Callout {
  label: string;
  icon: React.ReactNode;
  position: string;
  animation: string;
}

interface DemoItem {
  step: number;
  title: string;
  subtitle: string;
  subtitleIcon: LucideIcon;
  description: string;
  image: string;
  accent: string;
  glow: string;
  callouts: Callout[];
}

const demos: DemoItem[] = [
  {
    step: 1,
    title: "Connect & Command",
    subtitle: "SSH Terminal",
    subtitleIcon: Terminal,
    description:
      "Instantly connect to any remote server via SSH. Ghost-text autocomplete predicts your next command, the AI suggestion box helps you discover commands, and shell history syncs automatically.",
    image: "/1.png",
    accent: "from-green-500 to-emerald-600",
    glow: "bg-green-500/15",
    callouts: [
      { label: "Ghost Autocomplete", icon: <Sparkles className="w-3 h-3" />, position: "top-6 right-4", animation: "animate-float" },
      { label: "AI Suggestion Box", icon: <Search className="w-3 h-3" />, position: "bottom-20 left-4", animation: "animate-float-delayed" },
    ],
  },
  {
    step: 2,
    title: "Customize Everything",
    subtitle: "Settings & Themes",
    subtitleIcon: Settings,
    description:
      "17+ terminal themes with live preview, per-session font size & weight controls, behavior toggles for autocomplete, AI suggestions, and diagnostics. Make every session uniquely yours.",
    image: "/2.png",
    accent: "from-orange-500 to-amber-600",
    glow: "bg-orange-500/15",
    callouts: [
      { label: "17+ Themes", icon: <Palette className="w-3 h-3" />, position: "top-6 right-4", animation: "animate-float" },
      { label: "Font Controls", icon: <Settings className="w-3 h-3" />, position: "bottom-16 left-4", animation: "animate-float-delayed" },
    ],
  },
  {
    step: 3,
    title: "Collaborate in Real Time",
    subtitle: "Shared Terminal",
    subtitleIcon: Users,
    description:
      "Share your terminal session with a single link. Role-based permissions, live keystroke sync, typing indicators for collaborators, and one-click kick or ban controls — multiplayer DevOps.",
    image: "/3.png",
    accent: "from-pink-500 to-rose-600",
    glow: "bg-pink-500/15",
    callouts: [
      { label: "Live Sync", icon: <Users className="w-3 h-3" />, position: "top-6 left-4", animation: "animate-float" },
      { label: "Role Permissions", icon: <Shield className="w-3 h-3" />, position: "bottom-16 right-4", animation: "animate-float-delayed" },
    ],
  },
  {
    step: 4,
    title: "Manage Files Visually",
    subtitle: "SFTP Client",
    subtitleIcon: FolderTree,
    description:
      "Browse, upload, download, rename, chmod, and delete files through a visual file-tree interface. Drag-and-drop uploads, real-time progress tracking, media preview, and 13 context-menu actions.",
    image: "/4.png",
    accent: "from-blue-500 to-cyan-600",
    glow: "bg-blue-500/15",
    callouts: [
      { label: "Drag & Drop", icon: <Upload className="w-3 h-3" />, position: "top-8 right-4", animation: "animate-float" },
      { label: "13 Context Actions", icon: <FolderTree className="w-3 h-3" />, position: "bottom-16 left-4", animation: "animate-float-delayed" },
    ],
  },
  {
    step: 5,
    title: "Edit Like a Pro",
    subtitle: "Code Editor",
    subtitleIcon: Code2,
    description:
      "Monaco-powered editor with full context menus, multi-tab editing, command palette, minimap, bracket colorization, diff viewer, and AI ghost-text completions. Everything you expect from a desktop IDE.",
    image: "/5.png",
    accent: "from-violet-500 to-purple-600",
    glow: "bg-violet-500/15",
    callouts: [
      { label: "Full Context Menu", icon: <Code2 className="w-3 h-3" />, position: "top-6 left-4", animation: "animate-float" },
      { label: "AI Completions", icon: <Sparkles className="w-3 h-3" />, position: "bottom-16 right-4", animation: "animate-float-delayed" },
    ],
  },
  {
    step: 6,
    title: "Extend with Plugins",
    subtitle: "Plugin System",
    subtitleIcon: Puzzle,
    description:
      "17 built-in editor plugins — IntelliSense, Code Lens, inline annotations, auto-detect indentation, JSON/YAML validation, diff viewer, focus mode, and more. Toggle each on or off instantly.",
    image: "/6.png",
    accent: "from-teal-500 to-emerald-600",
    glow: "bg-teal-500/15",
    callouts: [
      { label: "17 Plugins", icon: <Puzzle className="w-3 h-3" />, position: "top-6 right-4", animation: "animate-float" },
      { label: "IntelliSense", icon: <Sparkles className="w-3 h-3" />, position: "bottom-16 left-4", animation: "animate-float-delayed" },
      { label: "Validation", icon: <Shield className="w-3 h-3" />, position: "bottom-8 right-8", animation: "animate-float" },
    ],
  },
  {
    step: 7,
    title: "Theme & IntelliSense",
    subtitle: "Themes & AI",
    subtitleIcon: Palette,
    description:
      "25+ editor themes with live preview, full IntelliSense autocomplete with document symbols and keywords, import & export themes, or install from Open VSX marketplace.",
    image: "/7.png",
    accent: "from-indigo-500 to-violet-600",
    glow: "bg-indigo-500/15",
    callouts: [
      { label: "25+ Themes", icon: <Palette className="w-3 h-3" />, position: "top-8 right-4", animation: "animate-float" },
      { label: "IntelliSense", icon: <Code2 className="w-3 h-3" />, position: "top-10 left-4", animation: "animate-float-delayed" },
      { label: "Import & Export", icon: <Zap className="w-3 h-3" />, position: "bottom-16 left-8", animation: "animate-float" },
    ],
  },
  {
    step: 8,
    title: "Editor + Terminal",
    subtitle: "Embedded Terminal",
    subtitleIcon: Terminal,
    description:
      "Split your workspace with an embedded terminal panel below the editor. Run commands, see output, and edit code — all without switching tabs. Resize, minimize, or go full-screen.",
    image: "/8.png",
    accent: "from-emerald-500 to-green-600",
    glow: "bg-emerald-500/15",
    callouts: [
      { label: "Embedded Terminal", icon: <Terminal className="w-3 h-3" />, position: "top-6 right-4", animation: "animate-float" },
      { label: "Resizable Panels", icon: <Zap className="w-3 h-3" />, position: "bottom-16 left-4", animation: "animate-float-delayed" },
    ],
  },
];

export const DemoGallery = () => {
  return (
    <section id="demo" className="container py-24 sm:py-32">
      <div className="text-center mb-20 space-y-4">
        <Badge variant="outline" className="text-xs px-3 py-1 border-primary/30 text-primary tracking-wider uppercase">
          Product Tour
        </Badge>
        <h2 className="text-3xl md:text-5xl font-bold">
          See It{" "}
          <span className="bg-gradient-to-b from-primary/60 to-primary text-transparent bg-clip-text">
            In Action
          </span>
        </h2>
        <p className="md:w-3/4 mx-auto text-xl text-muted-foreground">
          A quick walkthrough of how Terminus Web works — from connection to collaboration.
        </p>
      </div>

      <div className="space-y-32">
        {demos.map(({ step, title, subtitle, subtitleIcon: SubIcon, description, image, accent, glow, callouts }, index) => (
          <div
            key={title}
            className={`flex flex-col ${index % 2 === 0 ? "lg:flex-row" : "lg:flex-row-reverse"} items-center gap-12 lg:gap-16`}
          >
            {/* Screenshot with callouts */}
            <div className="flex-1 w-full">
              <div className="group relative">
                <div className={`absolute -inset-4 rounded-3xl ${glow} blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-700`} />
                <div className={`absolute -top-5 -left-5 z-20 w-12 h-12 rounded-2xl bg-gradient-to-br ${accent} text-white flex items-center justify-center text-lg font-bold shadow-xl`}>
                  {step}
                </div>

                <div className="relative rounded-2xl border border-border/40 bg-[#0A0A0A] overflow-hidden shadow-2xl shadow-black/30">
                  <div className="flex items-center gap-2 px-4 py-3 border-b border-border/30 bg-gradient-to-r from-[#111111] to-[#0d0d0d]">
                    <div className="flex gap-1.5">
                      <span className="w-3 h-3 rounded-full bg-[#FF5F57]" />
                      <span className="w-3 h-3 rounded-full bg-[#FFBD2E]" />
                      <span className="w-3 h-3 rounded-full bg-[#27C93F]" />
                    </div>
                    <div className="flex-1 mx-6">
                      <div className="mx-auto max-w-sm h-6 rounded-lg bg-[#1a1a1a] border border-border/20 flex items-center justify-center gap-1.5">
                        <Shield className="w-3 h-3 text-green-500/50" />
                        <span className="text-[11px] text-muted-foreground/40 font-mono">terminus.enjoys.in</span>
                      </div>
                    </div>
                  </div>

                  <div className="relative overflow-hidden">
                    <img src={image} alt={title} className="w-full object-cover transition-transform duration-700 group-hover:scale-[1.03]" />
                    <div className="absolute bottom-0 inset-x-0 h-16 bg-gradient-to-t from-[#0A0A0A]/50 to-transparent pointer-events-none" />
                  </div>
                </div>

                {callouts.map((callout, idx) => (
                  <div key={idx} className={`absolute ${callout.position} ${callout.animation} z-20 hidden md:flex`}>
                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-card/95 border border-border/50 shadow-xl backdrop-blur-md text-[11px] font-semibold">
                      <span className="text-primary">{callout.icon}</span>
                      {callout.label}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Text content */}
            <div className="flex-1 space-y-5 text-center lg:text-left">
              <div className="flex items-center gap-3 justify-center lg:justify-start">
                <span className={`inline-flex items-center gap-1.5 text-xs font-bold tracking-widest uppercase px-3 py-1 rounded-full bg-gradient-to-r ${accent} text-white`}>
                  <SubIcon className="w-3 h-3" />
                  {subtitle}
                </span>
              </div>
              <h3 className="text-2xl md:text-3xl font-bold">{title}</h3>
              <p className="text-lg text-muted-foreground leading-relaxed">{description}</p>

              <div className="flex flex-wrap gap-2 justify-center lg:justify-start md:hidden">
                {callouts.map((c, i) => (
                  <span key={i} className="inline-flex items-center gap-1.5 text-[11px] px-3 py-1.5 rounded-full bg-muted/60 border border-border/30 text-muted-foreground">
                    <span className="text-primary">{c.icon}</span>
                    {c.label}
                  </span>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};
