import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Terminal, Users, Shield, Sparkles } from "lucide-react";

interface FeatureProps {
  icon: JSX.Element;
  title: string;
  description: string;
  step: number;
}

const features: FeatureProps[] = [
  {
    step: 1,
    icon: <Terminal className="w-8 h-8 text-green-400" />,
    title: "Connect in Seconds",
    description:
      "Enter your host, username, and credentials — you're connected instantly. Save hosts for one-click access next time. No client installs, everything runs in your browser.",
  },
  {
    step: 2,
    icon: <Users className="w-8 h-8 text-pink-400" />,
    title: "Invite Your Team",
    description:
      "Share a session link and your teammates join in real time. Assign permissions — read-only viewers, write-access collaborators, or full admin control. All input syncs instantly.",
  },
  {
    step: 3,
    icon: <Shield className="w-8 h-8 text-blue-400" />,
    title: "Work Securely",
    description:
      "Every session is encrypted end-to-end. SSH keys and credentials are stored in the browser's encrypted vault. Rate limiting, session timeouts, and access logs keep your environment safe.",
  },
  {
    step: 4,
    icon: <Sparkles className="w-8 h-8 text-amber-400" />,
    title: "Let AI Assist You",
    description:
      "Ghost-text autocomplete predicts your next command. The diagnostics AI detects errors in real time and suggests fixes. Context-aware code generation helps you move faster.",
  },
];

export const HowItWorks = () => {
  return (
    <section id="howItWorks" className="container py-24 sm:py-32">
      <div className="text-center space-y-4 mb-14">
        <h2 className="text-3xl md:text-4xl font-bold">
          How It{" "}
          <span className="bg-gradient-to-b from-primary/60 to-primary text-transparent bg-clip-text">
            Works
          </span>
        </h2>
        <p className="md:w-3/4 mx-auto text-lg text-muted-foreground">
          From zero to collaborative DevOps in four simple steps.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {features.map(({ icon, title, description, step }) => (
          <Card
            key={title}
            className="relative bg-card/50 border-border/60 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5 transition-all duration-300 group overflow-visible"
          >
            {/* Step number */}
            <div className="absolute -top-4 left-6 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold shadow-lg">
              {step}
            </div>
            <CardHeader className="pt-8">
              <CardTitle className="flex flex-col gap-4 items-start">
                <div className="p-2.5 rounded-lg bg-muted/50 border border-border/40 group-hover:bg-muted transition-colors">
                  {icon}
                </div>
                <span className="text-lg">{title}</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground leading-relaxed">
              {description}
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
};
