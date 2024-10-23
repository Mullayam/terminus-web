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
    question: "What is the Terminal Collaboration Platform?",
    answer:
      "The AI Development Assistant is designed to improve productivity and collaboration during terminal sessions. It provides context-aware code suggestions, helping you write better code faster by predicting the next logical step based on your command history and the context of the task. The AI also detects common coding errors in real time and offers solutions, reducing the time spent troubleshooting. In addition, the assistant recommends best practices for code quality and efficiency, ensuring that your team follows optimal coding standards during collaborative development. This AI-powered support helps streamline workflows and enhances the overall coding experience.",
    value: "item-1",
  },
  {
    question: "How do I start a shared terminal session?",
    answer:
      "Starting a shared terminal session is simple. Once you've set up the platform and logged in, you can create a new session through the terminal interface or API. After the session is initiated, you can invite team members by sharing the session ID or link. Each user can be assigned specific permissions, such as read-only access or full write control, ensuring proper role management. Multiple users can work concurrently in the session, and all changes are reflected in real time, allowing seamless collaboration. You can also record the session for playback later, making it easy to review or audit the session.",
    value: "item-2",
  },
  {
    question: "Is the platform secure?",
    answer:
      "Yes, the platform is built with security as a top priority. All terminal sessions and SFTP file transfers are encrypted end-to-end using modern encryption protocols, ensuring that sensitive information is protected at all times. The platform never stores credentials in plaintext, and SSH keys, access tokens, and other credentials are securely stored in a key vault with encryption at rest. Additional security measures include rate limiting to prevent abuse, session timeouts to avoid idle session risks, and comprehensive access logging to track user activity for full transparency. Regular security audits are also conducted to ensure the platform remains robust against threats.",
    value: "item-3",
  },
  {
    question: "What does the AI Development Assistant offer?",
    answer:
      "The AI Development Assistant is designed to improve productivity and collaboration during terminal sessions. It provides context-aware code suggestions, helping you write better code faster by predicting the next logical step based on your command history and the context of the task. The AI also detects common coding errors in real time and offers solutions, reducing the time spent troubleshooting. In addition, the assistant recommends best practices for code quality and efficiency, ensuring that your team follows optimal coding standards during collaborative development. This AI-powered support helps streamline workflows and enhances the overall coding experience.",
    value: "item-4",
  },
  {
    question: "How does the SFTP integration work?",
    answer:
      "The platform includes a built-in SFTP client that allows users to manage file transfers directly from the terminal environment. You can upload, download, and modify files while working collaboratively with other team members in the same terminal session. The platform provides live updates on file system changes, and multi-user file access control ensures that all collaborators can view or edit files based on their assigned permissions. With the integration of file transfer progress monitoring, you can track the status of uploads and downloads in real time, making file management both efficient and transparent during collaborative sessions.",
    value: "item-5",
  },
];

export const FAQ = () => {
  return (
    <section id="faq" className="container py-24 sm:py-32">
      <h2 className="text-3xl md:text-4xl font-bold mb-4">
        Frequently Asked{" "}
        <span className="bg-gradient-to-b from-primary/60 to-primary text-transparent bg-clip-text">
          Questions
        </span>
      </h2>

      <Accordion type="single" collapsible className="w-full AccordionRoot">
        {FAQList.map(({ question, answer, value }: FAQProps) => (
          <AccordionItem key={value} value={value}>
            <AccordionTrigger className="text-left">
              {question}
            </AccordionTrigger>

            <AccordionContent>{answer}</AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>

      <h3 className="font-medium mt-4">
        Still have questions?{" "}
        <a
          rel="noreferrer noopener"
          href="https://github.com/Mullayam"
          className="text-primary transition-all border-primary hover:border-b-2"
          target="_blank"
        >
          Contact us
        </a>
      </h3>
    </section>
  );
};
