/**
 * @module lib/monaco/registerCopilot
 *
 * Wires up monacopilot for AI-powered inline completions.
 * Completions are fetched from the configured endpoint (default: /api/complete).
 *
 * ```ts
 * import { registerCopilot } from "@/modules/monaco-editor";
 *
 * const registration = registerCopilot(monaco, editor, {
 *   language: "typescript",
 *   filename: "app.tsx",
 * });
 *
 * // later: registration.deregister();
 * ```
 */

import type * as monacoNs from "monaco-editor";
import { registerCompletion, type RegisterCompletionOptions, type CompletionRegistration } from "monacopilot";

type Monaco = typeof monacoNs;

export interface CopilotOptions {
  /** Language ID for completions */
  language: string;
  /** Optional file name for better context */
  filename?: string;
  /** API endpoint (default: "/api/complete") */
  endpoint?: string;
  /** Technologies/frameworks for more relevant completions */
  technologies?: string[];
  /** Trigger mode: "onIdle" | "onTyping" | "onDemand" (default: "onIdle") */
  trigger?: "onIdle" | "onTyping" | "onDemand";
  /** Max context lines to send (default: 100) */
  maxContextLines?: number;
  /** Enable caching (default: true) */
  enableCaching?: boolean;
}

/**
 * Register monacopilot AI completions with the editor.
 *
 * @param monaco   The Monaco namespace
 * @param editor   The editor instance
 * @param options  Configuration options
 * @returns A CompletionRegistration with .deregister() and .trigger() methods
 */
export function registerCopilot(
  monaco: Monaco,
  editor: monacoNs.editor.IStandaloneCodeEditor,
  options: CopilotOptions,
): CompletionRegistration {
  const {
    language,
    filename,
    endpoint = "/api/complete",
    technologies,
    trigger = "onIdle",
    maxContextLines = 100,
    enableCaching = true,
  } = options;

  const regOptions: RegisterCompletionOptions = {
    language,
    endpoint,
    trigger,
    maxContextLines,
    enableCaching,
  };

  if (filename) {
    regOptions.filename = filename;
  }

  if (technologies && technologies.length > 0) {
    regOptions.technologies = technologies;
  }

  return registerCompletion(monaco as any, editor as any, regOptions);
}

/**
 * Detect relevant technologies from the file name and language.
 * Returns a list of technology hints for better completions.
 */
export function detectTechnologies(langId: string, fileName?: string): string[] {
  const techs: string[] = [];

  // Add framework hints based on file extension
  if (fileName) {
    const lower = fileName.toLowerCase();
    if (lower.endsWith(".tsx") || lower.endsWith(".jsx")) {
      techs.push("react");
    }
    if (lower.endsWith(".vue")) {
      techs.push("vue");
    }
    if (lower.endsWith(".svelte")) {
      techs.push("svelte");
    }
    if (lower.includes("tailwind") || lower.includes("tw")) {
      techs.push("tailwindcss");
    }
  }

  // Add language-specific additions
  switch (langId) {
    case "typescript":
    case "javascript":
      techs.push("node");
      break;
    case "python":
      techs.push("pip");
      break;
    case "go":
      techs.push("go modules");
      break;
    case "rust":
      techs.push("cargo");
      break;
  }

  return techs;
}
