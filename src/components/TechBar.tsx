import {
  Terminal,
  Code2,
  Shield,
  Sparkles,
  Globe,
  Layers,
} from "lucide-react";

const techStack = [
  { label: "xterm.js", icon: <Terminal className="w-5 h-5" /> },
  { label: "Monaco Editor", icon: <Code2 className="w-5 h-5" /> },
  { label: "React 18", icon: <Layers className="w-5 h-5" /> },
  { label: "WebSocket", icon: <Globe className="w-5 h-5" /> },
  { label: "E2E Encryption", icon: <Shield className="w-5 h-5" /> },
  { label: "AI Powered", icon: <Sparkles className="w-5 h-5" /> },
];

export const TechBar = () => {
  return (
    <section className="container py-12">
      <p className="text-center text-xs font-semibold tracking-widest uppercase text-muted-foreground/60 mb-6">
        Built With Industry-Leading Technologies
      </p>
      <div className="flex flex-wrap items-center justify-center gap-8 md:gap-12">
        {techStack.map(({ label, icon }) => (
          <div
            key={label}
            className="flex items-center gap-2 text-muted-foreground/50 hover:text-muted-foreground transition-colors duration-300"
          >
            {icon}
            <span className="text-sm font-medium">{label}</span>
          </div>
        ))}
      </div>
    </section>
  );
};
