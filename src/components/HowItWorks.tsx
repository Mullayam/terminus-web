import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { MedalIcon, MapIcon, PlaneIcon, GiftIcon } from "../components/Icons";

interface FeatureProps {
  icon: JSX.Element;
  title: string;
  description: string;
}

const features: FeatureProps[] = [
  {
    icon: <MedalIcon />,
    title: "Simple Setup",
    description:
      "Getting started is fast and easy. Set up your environment in just a few minutes using our intuitive configuration tools. Once you’ve cloned the repository and configured your settings, you’re ready to invite collaborators and start working together in real time.",
  },
  {
    icon: <MapIcon />,
    title: "Real-Time Collaboration",
    description:
      "Once a session is initiated, invite team members to join you in the terminal. Assign them read or write permissions to control their level of interaction. As everyone works together, each command and change is reflected instantly across all users, creating a smooth and synchronous experience.",
  },
  {
    icon: <PlaneIcon />,
    title: "Secure by Design",
    description:
      "Security is at the core of our platform. Every terminal session and SFTP operation is encrypted end-to-end, and sensitive data like SSH keys and access tokens are stored securely in our key vault. We also enforce rate limiting, session timeouts, and log all access activities for full transparency",
  },
  {
    icon: <GiftIcon />,
    title: "Built with Security in Mind",
    description:
      "With encryption, rate limiting, and secure key management, your sessions are protected at every step. We enforce session timeouts and maintain access logs for transparency.",
  },
];

export const HowItWorks = () => {
  return (
    <section id="howItWorks" className="container text-center py-24 sm:py-32">
      <h2 className="text-3xl md:text-4xl font-bold ">
        How It{" "}
        <span className="bg-gradient-to-b from-primary/60 to-primary text-transparent bg-clip-text">
          Works{" "}
        </span>
        Step-by-Step Guide
      </h2>
      <p className="md:w-3/4 mx-auto mt-4 mb-8 text-xl text-muted-foreground">
        {/* add some text here */}
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
        {features.map(({ icon, title, description }: FeatureProps) => (
          <Card key={title} className="bg-muted/50">
            <CardHeader>
              <CardTitle className="grid gap-4 place-items-center">
                {icon}
                {title}
              </CardTitle>
            </CardHeader>
            <CardContent>{description}</CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
};
