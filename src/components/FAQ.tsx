import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

interface FAQProps {
  question: string;
  answer: string;
  value: string;
}

const FAQList: FAQProps[] = [
  {
    question: "What is Terminus Web?",
    answer:
      "Terminus Web is a browser-based DevOps workspace that combines SSH terminal access, real-time collaborative terminal sharing, SFTP file management, and a full Monaco code editor. Everything runs in your browser with no installs required.",
    value: "item-1",
  },
  {
    question: "How does collaborative terminal sharing work?",
    answer:
      "Create a session and share the link. Teammates join instantly with role-based permissions: viewers can watch in read-only mode, collaborators can type commands, and admins have full control including the ability to kick or ban users. All input is synced in real time via WebSocket, and blocked users see a ghost-text lock overlay instead of a live cursor.",
    value: "item-2",
  },
  {
    question: "Is the platform secure?",
    answer:
      "Yes. All sessions use end-to-end encryption. SSH keys and credentials are stored in IndexedDB's encrypted vault and never leave your browser in plaintext. The platform enforces rate limiting, session timeouts, and maintains access logs for full transparency. Regular security audits are conducted to keep the platform robust.",
    value: "item-3",
  },
  {
    question: "What does the AI assistant do?",
    answer:
      "The AI assistant provides context-aware diagnostics — detecting errors in your terminal output in real time and suggesting fixes. It also offers ghost-text command autocomplete, code generation in the editor, and best-practice recommendations based on your command history and project context.",
    value: "item-4",
  },
  {
    question: "How does the SFTP integration work?",
    answer:
      "The built-in SFTP client lets you browse, upload, download, rename, chmod, and delete files on your remote servers through a visual file-tree interface. It supports drag-and-drop uploads, real-time progress tracking, context-menu actions, and multi-user file access control — all running alongside your terminal session.",
    value: "item-5",
  },
  {
    question: "Is Terminus Web free and open source?",
    answer:
      "Yes. Terminus Web is 100% open source under the MIT license. You can self-host it, fork it, or contribute to the project on GitHub. There are no paywalls or premium tiers.",
    value: "item-6",
  },
  {
    question: "What browsers and devices are supported?",
    answer:
      "Terminus Web works on all modern browsers — Chrome, Firefox, Safari, and Edge. The responsive UI adapts to desktop, tablet, and mobile screens. Since everything runs in the browser, there is nothing to install on the client side.",
    value: "item-7",
  },
];

export const FAQ = () => {
  return (
    <section id="faq" className="container py-24 sm:py-32">
      <div className="max-w-3xl mx-auto">
        <h2 className="text-3xl md:text-4xl font-bold mb-2">
          Frequently Asked{" "}
          <span className="bg-gradient-to-b from-primary/60 to-primary text-transparent bg-clip-text">
            Questions
          </span>
        </h2>
        <p className="text-muted-foreground mb-8">
          Everything you need to know about Terminus Web.
        </p>

        <Accordion type="single" collapsible className="w-full AccordionRoot">
          {FAQList.map(({ question, answer, value }: FAQProps) => (
            <AccordionItem key={value} value={value}>
              <AccordionTrigger className="text-left">
                {question}
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground leading-relaxed">
                {answer}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>

        <p className="text-sm text-muted-foreground mt-6">
          Still have questions?{" "}
          <a
            rel="noreferrer noopener"
            href="https://github.com/Mullayam/terminus-web/issues"
            className="text-primary transition-all border-primary hover:border-b-2"
            target="_blank"
          >
            Open an issue on GitHub
          </a>
        </p>
      </div>
    </section>
  );
};
