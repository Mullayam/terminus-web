import pilot from "../assets/pilot.png";

export const About = () => {
  return (
    <section id="about" className="container py-24 sm:py-32">
      <div className="bg-muted/50 border rounded-lg py-12">
        <div className="px-6 flex flex-col-reverse md:flex-row gap-8 md:gap-12">
          <img
            src={pilot}
            alt=""
            className="w-[300px] object-contain rounded-lg"
          />
          <div className="bg-green-0 flex flex-col justify-between">
            <div className="pb-6">
              <h2 className="text-3xl md:text-4xl font-bold">
                <span className="bg-gradient-to-b from-primary/60 to-primary text-transparent bg-clip-text">
                  About{" "}
                </span>
                Terminus-Web
              </h2>
              <p className="text-xl text-muted-foreground mt-4">
                Our platform is designed to revolutionize how teams collaborate
                in terminal environments, combining real-time terminal sharing,
                secure SFTP access, and AI-powered development support. Born out
                of the need for seamless, secure collaboration, we enable
                multiple users to work together simultaneously, with role-based
                permissions and end-to-end encryption.
              </p>
              <p className="text-xl text-muted-foreground mt-4">
                Our mission is to empower developers with the tools they need to
                collaborate efficiently while maintaining the highest security
                standards. With integrated AI features, we help optimize
                workflows, offering code suggestions, error detection, and best
                practices, all within the terminal environment.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
