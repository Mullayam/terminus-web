import {
  Terminal,
  Globe,
  Shield,
  Zap,
  Code2,
  Users,
} from "lucide-react";

const stats = [
  { icon: <Terminal className="w-5 h-5" />, label: "SSH & SFTP", detail: "Browser-native" },
  { icon: <Users className="w-5 h-5" />, label: "Multi-user", detail: "Real-time collab" },
  { icon: <Shield className="w-5 h-5" />, label: "E2E Encrypted", detail: "Zero-trust design" },
  { icon: <Code2 className="w-5 h-5" />, label: "Monaco Editor", detail: "Full IDE features" },
  { icon: <Zap className="w-5 h-5" />, label: "AI Powered", detail: "Smart diagnostics" },
  { icon: <Globe className="w-5 h-5" />, label: "Open Source", detail: "MIT Licensed" },
];

export const About = () => {
  return (
    <section id="about" className="container py-24 sm:py-32">
      <div className="rounded-2xl border border-border/60 bg-gradient-to-br from-muted/30 via-background to-muted/20 overflow-hidden">
        <div className="grid lg:grid-cols-2 gap-0">
          {/* Left — product screenshot */}
          <div className="relative p-8 lg:p-12 flex items-center justify-center bg-gradient-to-br from-primary/5 to-transparent">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,hsl(var(--primary)/0.08),transparent_70%)]" />
            <div className="relative rounded-xl border border-border/40 bg-[#0A0A0A] overflow-hidden shadow-2xl w-full max-w-lg">
              {/* Title bar */}
              <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border/30 bg-[#111111]">
                <div className="flex gap-1.5">
                  <span className="w-3 h-3 rounded-full bg-[#FF5F57]" />
                  <span className="w-3 h-3 rounded-full bg-[#FFBD2E]" />
                  <span className="w-3 h-3 rounded-full bg-[#27C93F]" />
                </div>
                <div className="flex-1 mx-8">
                  <div className="mx-auto max-w-xs h-5 rounded-md bg-[#1a1a1a] border border-border/20 flex items-center justify-center">
                    <span className="text-[10px] text-muted-foreground/50 font-mono">
                      terminus.enjoys.in
                    </span>
                  </div>
                </div>
              </div>
              <img
                src="/5.png"
                alt="Terminus Web platform"
                className="w-full object-cover"
              />
            </div>
          </div>

          {/* Right — copy + stats */}
          <div className="p-8 lg:p-12 flex flex-col justify-center">
            <h2 className="text-3xl md:text-4xl font-bold mb-6">
              <span className="bg-gradient-to-b from-primary/60 to-primary text-transparent bg-clip-text">
                About{" "}
              </span>
              Terminus Web
            </h2>

            <p className="text-lg text-muted-foreground leading-relaxed mb-4">
              Terminus Web is the DevOps workspace that lives entirely in your
              browser. Connect to any server via SSH, share terminal sessions
              with your team in real time, manage files through a visual SFTP
              client, and edit code with a full-featured Monaco editor — all
              from a single tab.
            </p>
            <p className="text-lg text-muted-foreground leading-relaxed mb-8">
              Built with security at its core — end-to-end encryption,
              role-based access control, and AI-powered diagnostics that catch
              errors before they hit production. 100% open source, MIT licensed.
            </p>

            {/* Stats grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {stats.map(({ icon, label, detail }) => (
                <div
                  key={label}
                  className="flex items-start gap-3 p-3 rounded-lg bg-muted/40 border border-border/30"
                >
                  <div className="mt-0.5 text-primary">{icon}</div>
                  <div>
                    <div className="text-sm font-semibold">{label}</div>
                    <div className="text-xs text-muted-foreground">{detail}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
