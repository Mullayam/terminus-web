/**
 * @module lib/monaco/extractVSIX
 *
 * Extracts VS Code extension contents from a VSIX archive (zip file).
 * Parses the extension's package.json to understand contributes (themes,
 * grammars, snippets, languages, etc.) and extracts the relevant files.
 *
 * VSIX structure:
 *   extension/
 *     package.json          ← extension manifest
 *     themes/               ← color themes
 *     syntaxes/             ← TextMate grammars
 *     snippets/             ← language snippets
 *     ...
 */

import JSZip from "jszip";

/* ── Types ─────────────────────────────────────────────────── */

/** A contributed grammar from the extension manifest */
export interface ExtGrammar {
  language?: string;
  scopeName: string;
  path: string;
  /** Raw content (JSON or plist string) */
  content: string;
  /** Parsed JSON content (if applicable) */
  parsed?: object;
}

/** A contributed theme from the extension manifest */
export interface ExtTheme {
  id: string;
  label: string;
  uiTheme: "vs" | "vs-dark" | "hc-black" | "hc-light";
  path: string;
  /** Parsed theme JSON */
  content: Record<string, unknown>;
}

/** A contributed snippet from the extension manifest */
export interface ExtSnippet {
  language: string;
  path: string;
  /** Parsed snippet JSON */
  content: Record<string, unknown>;
}

/** A contributed language from the extension manifest */
export interface ExtLanguage {
  id: string;
  aliases?: string[];
  extensions?: string[];
  filenames?: string[];
  /** Relative path to the language-configuration.json in the VSIX */
  configuration?: string;
  /** Parsed content of the language configuration file (brackets, auto-closing, comments, etc.) */
  configurationContent?: VSCodeLanguageConfiguration;
}

/**
 * Mirrors the VS Code language-configuration.json shape.
 * This is the raw format as stored in VS Code extensions.
 */
export interface VSCodeLanguageConfiguration {
  comments?: {
    lineComment?: string;
    blockComment?: [string, string];
  };
  brackets?: [string, string][];
  autoClosingPairs?: Array<
    | [string, string]
    | { open: string; close: string; notIn?: string[] }
  >;
  surroundingPairs?: Array<[string, string] | { open: string; close: string }>;
  colorizedBracketPairs?: [string, string][];
  wordPattern?: string;
  indentationRules?: {
    increaseIndentPattern?: string;
    decreaseIndentPattern?: string;
    indentNextLinePattern?: string;
    unIndentedLinePattern?: string;
  };
  folding?: {
    offSide?: boolean;
    markers?: { start?: string; end?: string };
  };
  onEnterRules?: Array<{
    beforeText: string;
    afterText?: string;
    previousLineText?: string;
    action: { indent: string; appendText?: string; removeText?: number };
  }>;
  autoCloseBefore?: string;
}

/** A contributed icon theme from the extension manifest */
export interface ExtIconTheme {
  id: string;
  label: string;
  path: string;
  content?: Record<string, unknown>;
}

/* ── New contribution types (commands, keybindings, configuration, colors, icons, jsonValidation) ── */

/** A contributed command from the extension manifest */
export interface ExtCommand {
  command: string;
  title: string;
  category?: string;
  icon?: string | { light: string; dark: string };
}

/** A contributed keybinding from the extension manifest */
export interface ExtKeybinding {
  command: string;
  key: string;
  mac?: string;
  linux?: string;
  win?: string;
  when?: string;
}

/** A contributed configuration property from the extension manifest */
export interface ExtConfigurationProperty {
  type?: string;
  default?: unknown;
  description?: string;
  markdownDescription?: string;
  enum?: string[];
  enumDescriptions?: string[];
  minimum?: number;
  maximum?: number;
  scope?: string;
}

/** A contributed configuration section from the extension manifest */
export interface ExtConfiguration {
  title?: string;
  properties: Record<string, ExtConfigurationProperty>;
}

/** A contributed color from the extension manifest */
export interface ExtColor {
  id: string;
  description: string;
  defaults: {
    dark: string;
    light: string;
    highContrast?: string;
    highContrastLight?: string;
  };
}

/** A contributed custom icon font from the extension manifest */
export interface ExtIcon {
  name: string;
  description?: string;
  fontPath?: string;
  fontCharacter?: string;
}

/** A contributed JSON validation schema from the extension manifest */
export interface ExtJsonValidation {
  fileMatch: string | string[];
  url: string;
  /** Resolved schema content (if the url points to a local file in the VSIX) */
  schema?: Record<string, unknown>;
}

/** The full extracted contents of a VSIX */
export interface VSIXContents {
  /** Extension manifest (package.json) */
  packageJson: Record<string, unknown>;
  /** All contributed grammars */
  grammars: ExtGrammar[];
  /** All contributed themes */
  themes: ExtTheme[];
  /** All contributed snippets */
  snippets: ExtSnippet[];
  /** All contributed languages */
  languages: ExtLanguage[];
  /** All contributed icon themes */
  iconThemes: ExtIconTheme[];
  /** README markdown content */
  readme?: string;
  /** Status bar item contributions */
  statusBar?: Array<{
    id: string;
    alignment?: "left" | "right";
    priority?: number;
    text?: string;
    tooltip?: string;
    command?: string;
    color?: string;
  }>;
  /** Menu contributions (editor/context, etc.) */
  menus?: Record<string, Array<{ group: string; command: string; when?: string }>>;
  /** View container contributions */
  viewContainers?: Array<{ id: string; title: string; icon?: string }>;
  /** View contributions */
  views?: Record<string, Array<{ id: string; name: string; when?: string; type?: string }>>;
  /** Command contributions */
  commands: ExtCommand[];
  /** Keybinding contributions */
  keybindings: ExtKeybinding[];
  /** Configuration (settings) contributions */
  configurations: ExtConfiguration[];
  /** Color contributions */
  colors: ExtColor[];
  /** Custom icon contributions (font-based icons) */
  icons: ExtIcon[];
  /** JSON validation schema contributions */
  jsonValidation: ExtJsonValidation[];
  /** Raw file map: relative path → Uint8Array */
  files: Map<string, Uint8Array>;
}

/* ── Helpers ───────────────────────────────────────────────── */

/** Normalize a relative path from package.json (strip leading ./ or /) */
function normalizePath(p: string): string {
  return p.replace(/^\.?\//, "");
}

/** Read a file from the zip as a string, trying "extension/<path>" first */
async function readTextFile(zip: JSZip, relPath: string): Promise<string | null> {
  const normalizedPath = normalizePath(relPath);
  // Try with extension/ prefix
  const entry =
    zip.file(`extension/${normalizedPath}`) ??
    zip.file(normalizedPath) ??
    zip.file(relPath);

  if (!entry) return null;
  return entry.async("string");
}

/** Read a file from the zip as JSON */
async function readJsonFile(zip: JSZip, relPath: string): Promise<Record<string, unknown> | null> {
  const text = await readTextFile(zip, relPath);
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    console.warn(`[extractVSIX] Failed to parse JSON: ${relPath}`);
    return null;
  }
}

/* ── Main extraction function ──────────────────────────────── */

/**
 * Extract a VSIX archive (ArrayBuffer) and return its structured contents.
 *
 * Uses the extension's `package.json` → `contributes` to discover all
 * themes, grammars, snippets, and languages, then reads and parses each file.
 *
 * ```ts
 * const buffer = await downloadVSIX(downloadUrl);
 * const contents = await extractVSIX(buffer);
 * // contents.themes, contents.grammars, contents.snippets, ...
 * ```
 */
export async function extractVSIX(buffer: ArrayBuffer): Promise<VSIXContents> {
  const zip = await JSZip.loadAsync(buffer);

  const contents: VSIXContents = {
    packageJson: {},
    grammars: [],
    themes: [],
    snippets: [],
    languages: [],
    iconThemes: [],
    readme: undefined,
    statusBar: undefined,
    menus: undefined,
    viewContainers: undefined,
    views: undefined,
    commands: [],
    keybindings: [],
    configurations: [],
    colors: [],
    icons: [],
    jsonValidation: [],
    files: new Map(),
  };

  // 1. Read package.json first — determines everything else
  const pkgJson = await readJsonFile(zip, "package.json");
  if (!pkgJson) {
    console.warn("[extractVSIX] No package.json found in VSIX");
    return contents;
  }
  contents.packageJson = pkgJson;

  const contributes = (pkgJson.contributes ?? {}) as Record<string, unknown>;

  // 2. Extract all raw files (for later IDB storage)
  const filePromises: Promise<void>[] = [];
  zip.forEach((relativePath, zipEntry) => {
    if (zipEntry.dir) return;
    // Strip "extension/" prefix for consistency
    const cleanPath = relativePath.replace(/^extension\//, "");
    filePromises.push(
      zipEntry.async("uint8array").then((data) => {
        contents.files.set(cleanPath, data);
      }),
    );
  });
  await Promise.all(filePromises);

  // 3. Extract grammars from contributes.grammars
  const grammarContribs = (contributes.grammars ?? []) as Array<{
    language?: string;
    scopeName: string;
    path: string;
    embeddedLanguages?: Record<string, string>;
  }>;

  for (const gDef of grammarContribs) {
    const text = await readTextFile(zip, gDef.path);
    if (!text) continue;

    let parsed: object | undefined;
    try {
      parsed = JSON.parse(text);
    } catch {
      // Could be a plist/XML format — store raw
    }

    contents.grammars.push({
      language: gDef.language,
      scopeName: gDef.scopeName,
      path: normalizePath(gDef.path),
      content: text,
      parsed,
    });
  }

  // 4. Extract themes from contributes.themes
  const themeContribs = (contributes.themes ?? []) as Array<{
    id?: string;
    label: string;
    uiTheme: string;
    path: string;
  }>;

  for (const tDef of themeContribs) {
    const json = await readJsonFile(zip, tDef.path);
    if (!json) continue;

    contents.themes.push({
      id: tDef.id ?? tDef.label.toLowerCase().replace(/[^a-z0-9]/g, "-"),
      label: tDef.label,
      uiTheme: (tDef.uiTheme ?? "vs-dark") as ExtTheme["uiTheme"],
      path: normalizePath(tDef.path),
      content: json,
    });
  }

  // 5. Extract snippets from contributes.snippets
  const snippetContribs = (contributes.snippets ?? []) as Array<{
    language: string;
    path: string;
  }>;

  for (const sDef of snippetContribs) {
    const json = await readJsonFile(zip, sDef.path);
    if (!json) continue;

    contents.snippets.push({
      language: sDef.language,
      path: normalizePath(sDef.path),
      content: json,
    });
  }

  // 6. Extract languages from contributes.languages
  const langContribs = (contributes.languages ?? []) as Array<{
    id: string;
    aliases?: string[];
    extensions?: string[];
    filenames?: string[];
    configuration?: string;
  }>;

  for (const lDef of langContribs) {
    // Read and parse the language-configuration.json if a path is specified
    let configurationContent: VSCodeLanguageConfiguration | undefined;
    if (lDef.configuration) {
      try {
        const configJson = await readJsonFile(zip, lDef.configuration);
        if (configJson) {
          configurationContent = configJson as unknown as VSCodeLanguageConfiguration;
        }
      } catch (err) {
        console.warn(`[extractVSIX] Failed to parse language config for "${lDef.id}":`, err);
      }
    }

    contents.languages.push({
      id: lDef.id,
      aliases: lDef.aliases,
      extensions: lDef.extensions,
      filenames: lDef.filenames,
      configuration: lDef.configuration,
      configurationContent,
    });
  }

  // 7. Extract icon themes from contributes.iconThemes
  const iconThemeContribs = (contributes.iconThemes ?? []) as Array<{
    id: string;
    label: string;
    path: string;
  }>;

  for (const itDef of iconThemeContribs) {
    const json = await readJsonFile(zip, itDef.path);
    contents.iconThemes.push({
      id: itDef.id,
      label: itDef.label,
      path: normalizePath(itDef.path),
      content: json ?? undefined,
    });
  }

  // 8. Extract README
  const readmeText =
    (await readTextFile(zip, "README.md")) ??
    (await readTextFile(zip, "readme.md")) ??
    (await readTextFile(zip, "Readme.md"));
  if (readmeText) {
    contents.readme = readmeText;
  }

  // 9. Extract status bar contributions (from contributes.statusBar or custom activationEvents)
  // VS Code extensions store status bar items in code, but some pack them in contributes
  // We also check for menus/viewContainers/views which are in package.json contributes
  const statusBarContribs = contributes.statusBar as
    | Array<{ id: string; alignment?: string; priority?: number; text?: string; tooltip?: string; command?: string; color?: string }>
    | undefined;
  if (statusBarContribs && Array.isArray(statusBarContribs)) {
    contents.statusBar = statusBarContribs.map((sb) => ({
      id: sb.id,
      alignment: (sb.alignment === "left" || sb.alignment === "right") ? sb.alignment : undefined,
      priority: sb.priority,
      text: sb.text,
      tooltip: sb.tooltip,
      command: sb.command,
      color: sb.color,
    }));
  }

  // 10. Extract menu contributions
  const menuContribs = contributes.menus as Record<string, Array<{ group?: string; command: string; when?: string }>> | undefined;
  if (menuContribs && typeof menuContribs === "object") {
    contents.menus = {};
    for (const [menuId, items] of Object.entries(menuContribs)) {
      if (Array.isArray(items)) {
        contents.menus[menuId] = items.map((item) => ({
          group: item.group ?? "",
          command: item.command,
          when: item.when,
        }));
      }
    }
  }

  // 11. Extract view containers
  const viewContainerContribs = contributes.viewsContainers as
    | Record<string, Array<{ id: string; title: string; icon?: string }>>
    | undefined;
  if (viewContainerContribs && typeof viewContainerContribs === "object") {
    contents.viewContainers = [];
    for (const containers of Object.values(viewContainerContribs)) {
      if (Array.isArray(containers)) {
        for (const vc of containers) {
          contents.viewContainers.push({
            id: vc.id,
            title: vc.title,
            icon: vc.icon,
          });
        }
      }
    }
  }

  // 12. Extract views
  const viewContribs = contributes.views as
    | Record<string, Array<{ id: string; name: string; when?: string; type?: string }>>
    | undefined;
  if (viewContribs && typeof viewContribs === "object") {
    contents.views = {};
    for (const [containerId, views] of Object.entries(viewContribs)) {
      if (Array.isArray(views)) {
        contents.views[containerId] = views.map((v) => ({
          id: v.id,
          name: v.name,
          when: v.when,
          type: v.type,
        }));
      }
    }
  }

  // 13. Extract commands
  const commandContribs = (contributes.commands ?? []) as Array<{
    command: string;
    title: string | { value: string; original?: string };
    category?: string | { value: string; original?: string };
    icon?: string | { light: string; dark: string };
  }>;
  for (const cmd of commandContribs) {
    const title = typeof cmd.title === "string" ? cmd.title : cmd.title?.value ?? "";
    const category = typeof cmd.category === "string" ? cmd.category : cmd.category?.value;
    contents.commands.push({
      command: cmd.command,
      title,
      category,
      icon: cmd.icon,
    });
  }

  // 14. Extract keybindings
  const keybindingContribs = (contributes.keybindings ?? []) as Array<{
    command: string;
    key: string;
    mac?: string;
    linux?: string;
    win?: string;
    when?: string;
  }>;
  for (const kb of keybindingContribs) {
    contents.keybindings.push({
      command: kb.command,
      key: kb.key,
      mac: kb.mac,
      linux: kb.linux,
      win: kb.win,
      when: kb.when,
    });
  }

  // 15. Extract configuration (settings)
  const configContribs = contributes.configuration;
  if (configContribs) {
    const configs = Array.isArray(configContribs) ? configContribs : [configContribs];
    for (const cfg of configs as Array<{ title?: string; properties?: Record<string, ExtConfigurationProperty> }>) {
      if (cfg.properties && typeof cfg.properties === "object") {
        contents.configurations.push({
          title: cfg.title,
          properties: cfg.properties,
        });
      }
    }
  }

  // 16. Extract color contributions
  const colorContribs = (contributes.colors ?? []) as Array<{
    id: string;
    description: string;
    defaults: { dark: string; light: string; highContrast?: string; highContrastLight?: string };
  }>;
  for (const color of colorContribs) {
    contents.colors.push({
      id: color.id,
      description: color.description,
      defaults: {
        dark: color.defaults?.dark ?? "#000000",
        light: color.defaults?.light ?? "#ffffff",
        highContrast: color.defaults?.highContrast,
        highContrastLight: color.defaults?.highContrastLight,
      },
    });
  }

  // 17. Extract custom icon contributions (font-based)
  const iconContribs = contributes.icons as Record<string, {
    description?: string;
    default?: { fontPath?: string; fontCharacter?: string };
  }> | undefined;
  if (iconContribs && typeof iconContribs === "object") {
    for (const [name, icon] of Object.entries(iconContribs)) {
      contents.icons.push({
        name,
        description: icon.description,
        fontPath: icon.default?.fontPath,
        fontCharacter: icon.default?.fontCharacter,
      });
    }
  }

  // 18. Extract JSON validation schemas
  const jsonValidationContribs = (contributes.jsonValidation ?? []) as Array<{
    fileMatch: string | string[];
    url: string;
  }>;
  for (const jv of jsonValidationContribs) {
    let schema: Record<string, unknown> | undefined;
    // If url is a local path (starts with ./ or not http), try to read from VSIX
    if (jv.url && !jv.url.startsWith("http")) {
      schema = (await readJsonFile(zip, jv.url)) ?? undefined;
    }
    contents.jsonValidation.push({
      fileMatch: jv.fileMatch,
      url: jv.url,
      schema,
    });
  }

  return contents;
}
