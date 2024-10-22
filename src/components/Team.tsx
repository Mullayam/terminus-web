import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Facebook, Instagram, Linkedin, Github } from "lucide-react";
// import owner from "../assets/owner.jpeg";
import { useEffect, useState } from "react";

interface TeamProps {
  imageUrl: string;
  name: string;
  position: string;
  socialNetworks: SociaNetworkslProps[];
  bio: string;
}

interface SociaNetworkslProps {
  name: string;
  url: string;
}

// const teamList: TeamProps[] = [
//   {
//     imageUrl: owner,
//     name: "Mulayam Singh",
//     position: "Backend | Full Stack Developer",
//     socialNetworks: [
//       {
//         name: "Linkedin",
//         url: "https://www.linkedin.com/in/mullayam06/",
//       },
//       {
//         name: "Github",
//         url: "",
//       },
//     ],
//   },
// ];

export const Team = () => {
  const [teamsState, setTeamsState] = useState<TeamProps[]>([]);
  const socialIcon = (iconName: string) => {
    switch (iconName) {
      case "Linkedin":
        return <Linkedin size="20" />;

      case "Facebook":
        return <Facebook size="20" />;

      case "Instagram":
        return <Instagram size="20" />;
      case "Github":
        return <Github size="20" />;
    }
  };

  //  fetch the teams github data

  async function fetchFromGithub() {
    const urls: string[] = [
      "https://api.github.com/users/Mullayam",
      "https://api.github.com/users/rudrodip",
      "https://api.github.com/users/ruru-m07",
      "https://api.github.com/users/shubhexists",
    ];
    urls.map(async (url, _) => {
      const response = await fetch(url);
      const data = await response.json();
      console.log(data);

      setTeamsState((set) => {
        return [
          ...set,
          {
            name: data.login,
            imageUrl: data.avatar_url,
            position: "Developer",
            socialNetworks: [{ name: "Github", url: data.html_url }],
            bio: data.bio,
          },
        ];
      });
    });
  }

  useEffect(() => {
    fetchFromGithub();
  }, []);

  return (
    <section id="team" className="container py-24 sm:py-32">
      <h2 className="text-3xl md:text-4xl font-bold">
        <span className="bg-gradient-to-b from-primary/60 to-primary text-transparent bg-clip-text">
          Our Dedicated{" "}
        </span>
        Crew
      </h2>

      <p className="mt-4 mb-10 text-xl text-muted-foreground"></p>
      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8 gap-y-10">
        {teamsState.map(
          ({ imageUrl, name, position, socialNetworks, bio }: TeamProps) => (
            <Card
              key={name}
              className="bg-muted/50 relative mt-8 flex flex-col justify-center items-center"
            >
              <CardHeader className="mt-8 flex justify-center items-center pb-2">
                <img
                  src={imageUrl}
                  alt={`${name} ${position}`}
                  className="absolute -top-12 rounded-full w-24 h-24 aspect-square object-cover"
                />
                <CardTitle className="text-center">{name}</CardTitle>
                <CardDescription className="text-primary">
                  {position}
                </CardDescription>
              </CardHeader>

              <CardContent className="text-center pb-2">
                <p>{bio}</p>
              </CardContent>

              <CardFooter>
                {socialNetworks.map(({ name, url }: SociaNetworkslProps) => (
                  <div key={name}>
                    <a
                      rel="noreferrer noopener"
                      href={url}
                      target="_blank"
                      className={buttonVariants({
                        variant: "ghost",
                        size: "sm",
                      })}
                    >
                      <span className="sr-only">{name} icon</span>
                      {socialIcon(name)}
                    </a>
                  </div>
                ))}
              </CardFooter>
            </Card>
          )
        )}
      </div>
    </section>
  );
};
