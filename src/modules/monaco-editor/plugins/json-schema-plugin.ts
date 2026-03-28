/**
 * @module monaco-editor/plugins/json-schema-plugin
 *
 * Registers JSON and YAML schemas for well-known config files,
 * providing validation diagnostics and hover documentation.
 */

import type { MonacoPlugin, PluginContext, Monaco } from "../types";

interface SchemaMapping {
  /** Glob-like filename patterns */
  fileMatch: string[];
  /** JSON Schema URI or inline schema */
  uri: string;
  /** Optional inline schema object */
  schema?: Record<string, unknown>;
}

/**
 * Built-in schema mappings for common config files.
 * Uses schemastore.org for most schemas.
 */
const SCHEMA_MAPPINGS: SchemaMapping[] = [
  {
    fileMatch: ["package.json"],
    uri: "https://json.schemastore.org/package.json",
  },
  {
    fileMatch: ["tsconfig.json", "tsconfig.*.json"],
    uri: "https://json.schemastore.org/tsconfig.json",
  },
  {
    fileMatch: [".eslintrc.json", ".eslintrc"],
    uri: "https://json.schemastore.org/eslintrc.json",
  },
  {
    fileMatch: [".prettierrc", ".prettierrc.json"],
    uri: "https://json.schemastore.org/prettierrc.json",
  },
  {
    fileMatch: [".babelrc", ".babelrc.json", "babel.config.json"],
    uri: "https://json.schemastore.org/babelrc.json",
  },
  {
    fileMatch: ["nest-cli.json", ".nestcli.json"],
    uri: "https://json.schemastore.org/nest-cli.json",
  },
  {
    fileMatch: [".github/workflows/*.json", ".github/workflows/*.yml"],
    uri: "https://json.schemastore.org/github-workflow.json",
  },
  {
    fileMatch: ["vercel.json"],
    uri: "https://openapi.vercel.sh/vercel.json",
  },
  {
    fileMatch: ["docker-compose.yml", "docker-compose.yaml", "compose.yml", "compose.yaml"],
    uri: "https://json.schemastore.org/docker-compose.json",
  },
  {
    fileMatch: [".dockerignore"],
    uri: "https://json.schemastore.org/dockerignore.json",
  },
  {
    fileMatch: ["tailwind.config.json"],
    uri: "https://json.schemastore.org/tailwindcss.json",
  },
  {
    fileMatch: ["lerna.json"],
    uri: "https://json.schemastore.org/lerna.json",
  },
  {
    fileMatch: [".swcrc"],
    uri: "https://json.schemastore.org/swcrc.json",
  },
  {
    fileMatch: ["deno.json", "deno.jsonc"],
    uri: "https://json.schemastore.org/deno.json",
  },
  {
    fileMatch: ["components.json"],
    uri: "https://ui.shadcn.com/schema.json",
  },
];

/**
 * Match a filename against a glob-like pattern.
 * Supports * as wildcard segment.
 */
function matchesPattern(filename: string, pattern: string): boolean {
  const name = filename.split("/").pop() ?? filename;
  const escaped = pattern
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\*/g, ".*");
  return new RegExp(`^${escaped}$`, "i").test(name);
}

export const jsonSchemaPlugin: MonacoPlugin = {
  id: "builtin-json-schema",
  name: "JSON/YAML Schema Validation",
  version: "1.0.0",
  description: "Schema validation and auto-complete for common config files",

  onBeforeMount(monaco: Monaco) {
    /* Configure Monaco's built-in JSON language service with schemas */
    const jsonDefaults = (monaco.languages as any).json?.jsonDefaults;
    if (jsonDefaults) {
      const existing = jsonDefaults.diagnosticsOptions?.schemas ?? [];
      jsonDefaults.setDiagnosticsOptions({
        validate: true,
        allowComments: true,
        enableSchemaRequest: true,
        schemas: [
          ...existing,
          ...SCHEMA_MAPPINGS.map((s) => ({
            uri: s.uri,
            fileMatch: s.fileMatch.filter((f) => f.endsWith(".json") || !f.includes(".")),
            schema: s.schema,
          })),
        ],
      });
    }
  },

  onMount(ctx: PluginContext) {
    /* For YAML files: provide basic key completion based on filename match */
    const yamlSchemas = SCHEMA_MAPPINGS.filter((s) =>
      s.fileMatch.some((f) => f.endsWith(".yml") || f.endsWith(".yaml")),
    );

    if (yamlSchemas.length > 0) {
      ctx.registerHoverProvider(["yaml"], {
        provideHover(model, position) {
          const filePath = model.uri.path;
          const matched = yamlSchemas.find((s) =>
            s.fileMatch.some((f) => matchesPattern(filePath, f)),
          );
          if (!matched) return null;

          const word = model.getWordAtPosition(position);
          if (!word) return null;

          return {
            range: new ctx.monaco.Range(
              position.lineNumber,
              word.startColumn,
              position.lineNumber,
              word.endColumn,
            ),
            contents: [
              { value: `**Schema**: ${matched.uri}` },
              { value: `Key: \`${word.word}\`` },
            ],
          };
        },
      });
    }

    /* Notify user about schema detection */
    const filePath = ctx.getFilePath() ?? "";
    const fileName = filePath.split("/").pop() ?? "";
    const matchedSchema = SCHEMA_MAPPINGS.find((s) =>
      s.fileMatch.some((f) => matchesPattern(fileName, f)),
    );
    if (matchedSchema) {
      ctx.emit("schema-detected", {
        file: fileName,
        schema: matchedSchema.uri,
      });
    }
  },

  onLanguageChange(language: string, ctx: PluginContext) {
    if (language === "json" || language === "jsonc") {
      const filePath = ctx.getFilePath() ?? "";
      const fileName = filePath.split("/").pop() ?? "";
      const matched = SCHEMA_MAPPINGS.find((s) =>
        s.fileMatch.some((f) => matchesPattern(fileName, f)),
      );
      if (matched) {
        ctx.emit("schema-detected", { file: fileName, schema: matched.uri });
      }
    }
  },
};
