interface DemoItem {
  title: string;
  description: string;
  image: string;
  step: number;
}

const demos: DemoItem[] = [
  {
    step: 1,
    title: "Connect & Customize",
    description:
      "Instantly connect to any remote server via SSH in your browser. Personalize your experience with multiple terminal themes, font sizes, and weights — everything adapts to your preferences.",
    image: "/2.png",
  },
  {
    step: 2,
    title: "Code with Intelligence",
    description:
      "Edit files directly on the server with our built-in code editor featuring IntelliSense autocomplete, syntax highlighting, and multiple color themes. A full IDE experience inside your browser.",
    image: "/7.png",
  },
  {
    step: 3,
    title: "Manage Files Visually",
    description:
      "Browse, upload, rename, and manage files on your remote servers with the integrated SFTP client. Full context-menu support, permissions viewer, and real-time updates.",
    image: "/4.png",
  },
];

export const DemoGallery = () => {
  return (
    <section id="demo" className="container py-24 sm:py-32">
      <div className="text-center mb-16">
        <h2 className="text-3xl md:text-4xl font-bold">
          See It{" "}
          <span className="bg-gradient-to-b from-primary/60 to-primary text-transparent bg-clip-text">
            In Action
          </span>
        </h2>
        <p className="md:w-3/4 mx-auto mt-4 text-xl text-muted-foreground">
          A quick walkthrough of how Terminus Web works — from connection to
          collaboration.
        </p>
      </div>

      <div className="space-y-24">
        {demos.map(({ step, title, description, image }, index) => (
          <div
            key={title}
            className={`flex flex-col ${
              index % 2 === 0 ? "lg:flex-row" : "lg:flex-row-reverse"
            } items-center gap-12`}
          >
            {/* Screenshot */}
            <div className="flex-1 w-full">
              <div className="group relative">
                {/* Step badge */}
                <div className="absolute -top-4 -left-4 z-10 w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-lg font-bold shadow-lg">
                  {step}
                </div>

                {/* Glow effect */}
                <div className="absolute -inset-1 rounded-xl bg-gradient-to-r from-primary/20 via-primary/10 to-transparent blur-lg opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

                {/* Browser frame */}
                <div className="relative rounded-xl border border-border/50 bg-[#0A0A0A] overflow-hidden shadow-2xl">
                  {/* Title bar */}
                  <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border/30 bg-[#111111]">
                    <div className="flex gap-1.5">
                      <span className="w-3 h-3 rounded-full bg-[#FF5F57]" />
                      <span className="w-3 h-3 rounded-full bg-[#FFBD2E]" />
                      <span className="w-3 h-3 rounded-full bg-[#27C93F]" />
                    </div>
                    <div className="flex-1 mx-8">
                      <div className="mx-auto max-w-sm h-5 rounded-md bg-[#1a1a1a] border border-border/20 flex items-center justify-center">
                        <span className="text-[10px] text-muted-foreground/50 font-mono">
                          terminus.enjoys.in
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Screenshot image */}
                  <img
                    src={image}
                    alt={title}
                    className="w-full object-cover transition-transform duration-500 group-hover:scale-[1.02]"
                  />
                </div>
              </div>
            </div>

            {/* Text content */}
            <div className="flex-1 space-y-4 text-center lg:text-left">
              <span className="inline-block text-sm font-semibold text-primary tracking-wider uppercase">
                Step {step}
              </span>
              <h3 className="text-2xl md:text-3xl font-bold">{title}</h3>
              <p className="text-lg text-muted-foreground leading-relaxed">
                {description}
              </p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};
