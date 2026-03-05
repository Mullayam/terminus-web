import { buttonVariants } from "./ui/button";
import { GitHubLogoIcon } from "@radix-ui/react-icons";
import { Terminal, Star, GitFork } from "lucide-react";

export const Newsletter = () => {
  return (
    <section id="newsletter">
      <hr className="w-11/12 mx-auto" />

      <div className="container py-24 sm:py-32">
        <div className="max-w-3xl mx-auto text-center space-y-6">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-sm font-medium mx-auto">
            <Terminal className="w-4 h-4" />
            Open Source & Community Driven
          </div>

          <h3 className="text-4xl md:text-5xl font-bold">
            Built in the Open,{" "}
            <span className="bg-gradient-to-b from-primary/60 to-primary text-transparent bg-clip-text">
              For Everyone
            </span>
          </h3>

          <p className="text-xl text-muted-foreground max-w-xl mx-auto">
            Terminus Web is 100% open source. Star the repo, submit a PR, or
            fork it and make it your own. Every contribution makes the platform
            better for everyone.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
            <a
              rel="noreferrer noopener"
              href="https://github.com/Mullayam/terminus-web"
              target="_blank"
              className={`${buttonVariants({ size: "lg" })} gap-2`}
            >
              <GitHubLogoIcon className="w-5 h-5" />
              View on GitHub
            </a>
            <a
              rel="noreferrer noopener"
              href="https://github.com/Mullayam/terminus-web"
              target="_blank"
              className={`${buttonVariants({
                variant: "outline",
                size: "lg",
              })} gap-2`}
            >
              <Star className="w-4 h-4" />
              Star the Repo
            </a>
            <a
              rel="noreferrer noopener"
              href="https://github.com/Mullayam/terminus-web/fork"
              target="_blank"
              className={`${buttonVariants({
                variant: "outline",
                size: "lg",
              })} gap-2`}
            >
              <GitFork className="w-4 h-4" />
              Fork It
            </a>
          </div>
        </div>
      </div>

      <hr className="w-11/12 mx-auto" />
    </section>
  );
};
