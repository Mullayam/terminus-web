import { Link } from "react-router-dom";
import { useState, useEffect } from "react";
import { Button } from "./ui/button";
import { buttonVariants } from "./ui/button";
import { GitHubLogoIcon } from "@radix-ui/react-icons";
import { ArrowRight, Terminal, Users, Shield, Sparkles, FolderTree, Code2 } from "lucide-react";

const heroScreenshots = [
  {
    src: "/2.png",
    alt: "SSH Terminal with theme settings and command autocomplete",
    callouts: [
      { label: "17+ Themes", position: "top-8 right-4", anim: "animate-float" },
      { label: "Full xterm.js", position: "bottom-20 left-4", anim: "animate-float-delayed" },
    ],
  },
  {
    src: "/7.png",
    alt: "Built-in code editor with IntelliSense and multiple themes",
    callouts: [
      { label: "IntelliSense", position: "top-8 left-4", anim: "animate-float" },
      { label: "AI Completions", position: "bottom-16 right-4", anim: "animate-float-delayed" },
    ],
  },
  {
    src: "/4.png",
    alt: "SFTP file manager with context menu and permissions",
    callouts: [
      { label: "Drag & Drop", position: "top-8 right-4", anim: "animate-float" },
      { label: "13 Actions", position: "bottom-20 left-4", anim: "animate-float-delayed" },
    ],
  },
];

const stats = [
  { label: "Terminal Themes", value: "17+" },
  { label: "Editor Themes", value: "25+" },
  { label: "SFTP Actions", value: "13" },
  { label: "Open Source", value: "100%" },
];

export const Hero = () => {
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % heroScreenshots.length);
    }, 4000);
    return () => clearInterval(timer);
  }, []);

  return (
    <section className="relative overflow-hidden">
      {/* Background gradient mesh */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-[#D247BF]/10 rounded-full blur-3xl" />
        <div className="absolute top-20 right-1/4 w-96 h-96 bg-[#61DAFB]/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-1/2 w-96 h-96 bg-[#27C93F]/8 rounded-full blur-3xl" />
      </div>

      <div className="container py-24 md:py-36 space-y-16">
        {/* Top Section */}
        <div className="text-center max-w-4xl mx-auto space-y-8">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-muted/50 px-4 py-1.5 text-sm text-muted-foreground backdrop-blur-sm">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
            </span>
            Now with Collaborative Terminal Sharing
          </div>

          {/* Headline */}
          <h1 className="text-5xl md:text-7xl font-bold tracking-tight leading-[1.1]">
            The{" "}
            <span className="inline bg-gradient-to-r from-[#F596D3] to-[#D247BF] text-transparent bg-clip-text">
              DevOps Workspace
            </span>{" "}
            That Lives in Your{" "}
            <span className="inline bg-gradient-to-r from-[#61DAFB] via-[#1fc0f1] to-[#03a3d7] text-transparent bg-clip-text">
              Browser
            </span>
          </h1>

          {/* Subtitle */}
          <p className="text-xl md:text-2xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            SSH terminal, SFTP file manager, code editor, AI assistance, and
            real-time collaboration — all in one place. No installs required.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2">
            <Link to="/ssh/connect">
              <Button size="lg" className="text-base px-8 gap-2 group">
                Get Started Free
                <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
              </Button>
            </Link>
            <a
              rel="noreferrer noopener"
              href="https://github.com/Mullayam/terminus-web-api/"
              target="_blank"
              className={`text-base px-8 ${buttonVariants({ variant: "outline", size: "lg" })}`}
            >
              <GitHubLogoIcon className="mr-2 w-5 h-5" />
              Star on GitHub
            </a>
          </div>

          {/* Trust signals */}
          <div className="flex items-center justify-center gap-6 text-sm text-muted-foreground pt-2">
            <span className="flex items-center gap-1.5">
              <Terminal className="w-4 h-4" /> Full xterm.js
            </span>
            <span className="flex items-center gap-1.5">
              <Users className="w-4 h-4" /> Multi-user collab
            </span>
            <span className="flex items-center gap-1.5">
              <Shield className="w-4 h-4" /> End-to-end encrypted
            </span>
          </div>
        </div>

        {/* Product Screenshot */}
        <div className="max-w-5xl mx-auto">
          <div className="group relative">
            {/* Ambient glow */}
            <div className="absolute -inset-4 rounded-2xl bg-gradient-to-r from-[#D247BF]/20 via-[#61DAFB]/15 to-[#27C93F]/20 blur-2xl opacity-60 group-hover:opacity-100 transition-opacity duration-700" />

            {/* Browser frame */}
            <div className="relative rounded-xl border border-border/50 bg-[#0A0A0A] overflow-hidden shadow-2xl shadow-primary/5">
              {/* Title bar */}
              <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border/30 bg-[#111111]">
                <div className="flex gap-1.5">
                  <span className="w-3 h-3 rounded-full bg-[#FF5F57]" />
                  <span className="w-3 h-3 rounded-full bg-[#FFBD2E]" />
                  <span className="w-3 h-3 rounded-full bg-[#27C93F]" />
                </div>
                <div className="flex-1 mx-8">
                  <div className="mx-auto max-w-xs h-6 rounded-md bg-[#1a1a1a] border border-border/20 flex items-center justify-center gap-2">
                    <Shield className="w-3 h-3 text-green-500/60" />
                    <span className="text-xs text-muted-foreground/50 font-mono">
                      terminus.enjoys.in
                    </span>
                  </div>
                </div>
              </div>

              {/* Screenshots with crossfade */}
              <div className="relative aspect-[16/9] bg-[#0A0A0A]">
                {heroScreenshots.map((shot, i) => (
                  <img
                    key={shot.src}
                    src={shot.src}
                    alt={shot.alt}
                    className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-700 ease-in-out ${
                      i === activeIndex ? "opacity-100" : "opacity-0"
                    }`}
                  />
                ))}
                {/* Bottom vignette */}
                <div className="absolute bottom-0 inset-x-0 h-20 bg-gradient-to-t from-[#0A0A0A]/60 to-transparent pointer-events-none" />
              </div>
            </div>

            {/* Floating callout badges */}
            {heroScreenshots[activeIndex].callouts.map((callout, idx) => (
              <div
                key={`${activeIndex}-${idx}`}
                className={`absolute ${callout.position} ${callout.anim} z-20 hidden sm:flex`}
              >
                <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-card/90 border border-border/50 shadow-xl backdrop-blur-md text-xs font-semibold">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                  {callout.label}
                </div>
              </div>
            ))}

            {/* Corner feature icons */}
            <div className="absolute -bottom-3 -right-3 z-20 hidden lg:flex gap-2">
              {[
                { icon: <Terminal className="w-4 h-4" />, bg: "bg-green-500" },
                { icon: <Code2 className="w-4 h-4" />, bg: "bg-violet-500" },
                { icon: <FolderTree className="w-4 h-4" />, bg: "bg-blue-500" },
                { icon: <Users className="w-4 h-4" />, bg: "bg-pink-500" },
              ].map((item, i) => (
                <div
                  key={i}
                  className={`w-9 h-9 rounded-xl ${item.bg} text-white flex items-center justify-center shadow-lg`}
                >
                  {item.icon}
                </div>
              ))}
            </div>

            {/* Dots indicator */}
            <div className="flex justify-center gap-2 mt-4">
              {heroScreenshots.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setActiveIndex(i)}
                  aria-label={`Show screenshot ${i + 1}`}
                  className={`h-2 rounded-full transition-all duration-300 ${
                    i === activeIndex
                      ? "w-6 bg-primary"
                      : "w-2 bg-muted-foreground/30 hover:bg-muted-foreground/50"
                  }`}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Stats bar */}
        <div className="max-w-3xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 rounded-xl border border-border/40 bg-card/30 backdrop-blur-sm p-6">
            {stats.map((stat) => (
              <div key={stat.label} className="text-center space-y-1">
                <div className="text-3xl font-bold bg-gradient-to-b from-foreground to-foreground/70 bg-clip-text text-transparent">
                  {stat.value}
                </div>
                <div className="text-sm text-muted-foreground">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Shadow effect */}
      <div className="shadow"></div>
    </section>
  );
};
