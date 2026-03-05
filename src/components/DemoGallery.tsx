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
  Ghost,
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
  description: string;
  image: string;
  accent: string;
  glow: string;
  callouts: Callout[];
}

const demos: DemoItem[] = [
  {
    step: 1,
    title: "Connect & Customize",
    subtitle: "SSH Terminal",
    description:
      "Instantly connect to any remote server via SSH. Personalize with 17+ terminal themes, adjustable font sizes, weights, and ligature support. Your workspace, your rules.",
    image: "/2.png",
    accent: "from-green-500 to-emerald-600",
    glow: "bg-green-500/15",
    callouts: [
      { label: "17+ Themes", icon: <Palette className="w-3 h-3" />, position: "top-6 right-4", animation: "animate-float" },
      { label: "Search Terminal", icon: <Search className="w-3 h-3" />, position: "bottom-20 left-4", animation: "animate-float-delayed" },
    ],
  },
  {
    step: 2,
    title: "Code with Intelligence",
    subtitle: "Monaco Editor",
    description:
      "Edit files directly on the server with our built-in code editor. IntelliSense autocomplete, 25+ themes, command palette, minimap, diff viewer, and AI ghost-text completions.",
    image: "/7.png",
    accent: "from-violet-500 to-purple-600",
    glow: "bg-violet-500/15",
    callouts: [
      { label: "IntelliSense", icon: <Code2 className="w-3 h-3" />, position: "top-6 left-4", animation: "animate-float" },
      { label: "AI Autocomplete", icon: <Sparkles className="w-3 h-3" />, position: "bottom-16 right-4", animation: "animate-float-delayed" },
    ],
  },
  {
    step: 3,
    title: "Manage Files Visually",
    subtitle: "SFTP Client",
    description:
      "Browse, upload, download, rename, chmod, and delete files through a visual file-tree interface. Drag-and-drop uploads, real-time progress tracking, and 13 context-menu actions.",
    image: "/4.png",
    accent: "from-blue-500 to-cyan-600",
    glow: "bg-blue-500/15",
    callouts: [
      { label: "Drag & Drop", icon: <Upload className="w-3 h-3" />, position: "top-8 right-4", animation: "animate-float" },
      { label: "13 Actions", icon: <FolderTree className="w-3 h-3" />, position: "bottom-16 left-4", animation: "animate-float-delayed" },
    ],
  },
  {
    step: 4,
    title: "Collaborate in Real Time",
    subtitle: "Shared Terminal",
    description:
      "Share your terminal session with a single link. Role-based permissions, live keystroke sync, ghost-text lock overlays for blocked users, and one-click kick or ban controls.",
    image: "/6.png",
    accent: "from-pink-500 to-rose-600",
    glow: "bg-pink-500/15",
    callouts: [
      { label: "Live Sync", icon: <Users className="w-3 h-3" />, position: "top-6 left-4", animation: "animate-float" },
      { label: "Ghost Lock", icon: <Ghost className="w-3 h-3" />, position: "top-10 right-4", animation: "animate-float-delayed" },
      { label: "Encrypted", icon: <Shield className="w-3 h-3" />, position: "bottom-16 left-8", animation: "animate-float" },
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
        {demos.map(({ step, title, subtitle, description, image, accent, glow, callouts }, index) => (
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
                  {subtitle === "SSH Terminal" && <Terminal className="w-3 h-3" />}
                  {subtitle === "Monaco Editor" && <Code2 className="w-3 h-3" />}
                  {subtitle === "SFTP Client" && <FolderTree className="w-3 h-3" />}
                  {subtitle === "Shared Terminal" && <Users className="w-3 h-3" />}
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
