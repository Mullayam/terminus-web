import { Link } from "react-router-dom";
import { useState, useEffect } from "react";
import { Button } from "./ui/button";
import { buttonVariants } from "./ui/button";
import { GitHubLogoIcon } from "@radix-ui/react-icons";

const heroScreenshots = [
  {
    src: "/2.png",
    alt: "SSH Terminal with theme settings and command autocomplete",
  },
  {
    src: "/7.png",
    alt: "Built-in code editor with IntelliSense and multiple themes",
  },
  { src: "/4.png", alt: "SFTP file manager with context menu and permissions" },
];

export const Hero = () => {
  const [activeIndex, setActiveIndex] = useState(0);

  // Auto-cycle every 4 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % heroScreenshots.length);
    }, 4000);
    return () => clearInterval(timer);
  }, []);

  return (
    <section className="container grid lg:grid-cols-2 place-items-center py-20 md:py-32 gap-10">
      <div className="text-center lg:text-start space-y-6">
        <main className="text-5xl md:text-6xl font-bold">
          <h1 className="inline">
            <span className="inline bg-gradient-to-r from-[#F596D3]  to-[#D247BF] text-transparent bg-clip-text">
              Seamlessly Real-Time
            </span>{" "}
          </h1>{" "}
          <h2 className="inline">
            Collaboration Terminal with{" "}
            <span className="inline bg-gradient-to-r from-[#61DAFB] via-[#1fc0f1] to-[#03a3d7] text-transparent bg-clip-text">
              AI Assistance.
            </span>{" "}
          </h2>
        </main>

        <p className="text-xl text-muted-foreground md:w-10/12 mx-auto lg:mx-0">
          Terminal Collaboration Platform offers secure, multi-user access to
          terminal sessions, shared SFTP environments, and AI-driven development
          support.
        </p>

        <div className="space-y-4 md:space-y-0 md:space-x-4">
          <Link to={"/ssh/connect"}>
            {" "}
            <Button className="w-full md:w-1/3">Get Started</Button>{" "}
          </Link>

          <a
            rel="noreferrer noopener"
            href="https://github.com/Mullayam/terminus-web-api/"
            target="_blank"
            className={`w-full md:w-1/3 ${buttonVariants({
              variant: "outline",
            })}`}
          >
            Github Repository
            <GitHubLogoIcon className="ml-2 w-5 h-5" />
          </a>
        </div>
      </div>

      {/* Hero product screenshot carousel */}
      <div className="z-10 w-full max-w-2xl">
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
                <div className="mx-auto max-w-xs h-6 rounded-md bg-[#1a1a1a] border border-border/20 flex items-center justify-center">
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
            </div>
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

      {/* Shadow effect */}
      <div className="shadow"></div>
    </section>
  );
};
