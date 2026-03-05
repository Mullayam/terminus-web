import { Terminal } from "lucide-react";

export const Footer = () => {
  return (
    <footer id="footer">
      <hr className="w-11/12 mx-auto" />

      <section className="container py-16 grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-x-12 gap-y-8">
        <div className="col-span-full xl:col-span-2">
          <a
            rel="noreferrer noopener"
            href="/"
            className="font-bold text-xl flex items-center gap-2"
          >
            <Terminal className="w-5 h-5 text-primary" />
            Terminus Web
          </a>
          <p className="text-sm text-muted-foreground mt-2 max-w-xs">
            The browser-based DevOps workspace for SSH, SFTP, code editing, and
            real-time terminal collaboration.
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <h3 className="font-bold text-lg">Product</h3>
          <a href="#features" className="opacity-60 hover:opacity-100 text-sm">
            Features
          </a>
          <a href="#demo" className="opacity-60 hover:opacity-100 text-sm">
            Demo
          </a>
          <a href="#howItWorks" className="opacity-60 hover:opacity-100 text-sm">
            How It Works
          </a>
          <a href="#faq" className="opacity-60 hover:opacity-100 text-sm">
            FAQ
          </a>
        </div>

        <div className="flex flex-col gap-2">
          <h3 className="font-bold text-lg">Project</h3>
          <a
            rel="noreferrer noopener"
            href="https://github.com/Mullayam/terminus-web"
            target="_blank"
            className="opacity-60 hover:opacity-100 text-sm"
          >
            GitHub
          </a>
          <a
            rel="noreferrer noopener"
            href="https://github.com/Mullayam/terminus-web/issues"
            target="_blank"
            className="opacity-60 hover:opacity-100 text-sm"
          >
            Issues
          </a>
          <a
            rel="noreferrer noopener"
            href="https://github.com/Mullayam/terminus-web/releases"
            target="_blank"
            className="opacity-60 hover:opacity-100 text-sm"
          >
            Releases
          </a>
        </div>

        <div className="flex flex-col gap-2">
          <h3 className="font-bold text-lg">Community</h3>
          <a
            rel="noreferrer noopener"
            href="https://github.com/Mullayam"
            target="_blank"
            className="opacity-60 hover:opacity-100 text-sm"
          >
            Author
          </a>
          <a
            rel="noreferrer noopener"
            href="https://github.com/Mullayam/terminus-web/blob/main/LICENSE"
            target="_blank"
            className="opacity-60 hover:opacity-100 text-sm"
          >
            MIT License
          </a>
        </div>
      </section>

      <section className="container pb-14 text-center">
        <p className="text-sm text-muted-foreground">
          &copy; {new Date().getFullYear()} Terminus Web &mdash; Crafted by{" "}
          <a
            rel="noreferrer noopener"
            href="https://github.com/Mullayam"
            target="_blank"
            className="text-primary transition-all border-primary hover:border-b-2"
          >
            Enjoys &bull; Mullayam
          </a>
        </p>
      </section>
    </footer>
  );
};
