import { Badge } from "./ui/badge";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import ai from "../assets/pngwing.com.png";
import key from "../assets/key.png";
import sftp from "../assets/sftpnew.png";
import terminal from "../assets/terminal.png";
import multiUser from "../assets/multiUser.png";

interface FeatureProps {
  title: string;
  description: string;
  image: string;
}

const features: FeatureProps[] = [
  {
    title: "Live Terminal Sharing",
    description:
      "Work together in real-time terminal sessions, supporting multiple users with role-based permissions. Collaborate seamlessly with concurrent access and enjoy session recording for later review.",
    image: terminal,
  },
  {
    title: "Secure SFTP Integration",
    description:
      "Our platform includes a web-based SFTP client with live file system updates and multi-user access control. Easily manage file transfers and monitor progress in real time.",
    image: sftp,
  },
  {
    title: "AI Development Assistant",
    description:
      "Enhance your workflow with context-aware code suggestions and error detection powered by AI. Our assistant analyzes command history to provide you with insights and best practices.",
    image: ai,
  },
  {
    title: "Key Vault Management",
    description:
      "Keep your credentials safe with secure SSH key management and encrypted storage. Handle access tokens efficiently, all while ensuring top-tier encryption at rest.",
    image: key,
  },
  {
    title: "Multi-User Sessions",
    description:
      "Our platform allows multiple users to join the same session, collaborate on code, and execute commands simultaneously. This feature is perfect for pair programming, team debugging, or real-time infrastructure management, fostering a truly collaborative environment.",
    image: multiUser,
  },
];

const featureList: string[] = [
  "Live Terminal Sharing",
  "Secure SFTP Integration",
  "AI Development Assistant",
  "Key Vault Management",
  "Multi-User Sessions",
];

export const Features = () => {
  return (
    <section id="features" className="container py-24 sm:py-32 space-y-8">
      <h2 className="text-3xl lg:text-4xl font-bold md:text-center">
        Many{" "}
        <span className="bg-gradient-to-b from-primary/60 to-primary text-transparent bg-clip-text">
          Great Features
        </span>
      </h2>

      <div className="hidden lg:flex flex-wrap md:justify-center gap-4">
        {featureList.map((feature: string) => (
          <div key={feature}>
            <Badge variant="secondary" className="text-sm">
              {feature}
            </Badge>
          </div>
        ))}
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
        {features.map(({ title, description, image }: FeatureProps) => (
          <Card key={title}>
            <CardHeader>
              <CardTitle>{title}</CardTitle>
            </CardHeader>

            <CardContent>{description}</CardContent>

            <CardFooter>
              <img
                src={image}
                alt="About feature"
                className="w-[200px] lg:w-[300px] mx-auto"
              />
            </CardFooter>
          </Card>
        ))}
      </div>
    </section>
  );
};
