/**
 * @module monaco-editor/plugins/emmet-plugin
 *
 * Provides Emmet abbreviation expansion for HTML, CSS, JSX, and TSX.
 * Trigger: Tab key when cursor is at end of an Emmet abbreviation.
 */

import type { MonacoPlugin, PluginContext } from "../types";

import { EMMET_LANGUAGES, EMMET_STYLE_LANGUAGES } from "../lib/language-groups";

/**
 * Minimal Emmet-like expansion engine.
 * Supports: tag, tag.class, tag#id, tag*n, tag>child, tag+sibling,
 * tag[attr=val], tag{text}, and combinations.
 */
function expandAbbreviation(abbr: string, isCSS: boolean): string | null {
  if (!abbr || abbr.length > 200) return null;

  if (isCSS) {
    return expandCSSAbbr(abbr);
  }

  return expandHTMLAbbr(abbr);
}

/** Simple CSS property abbreviations */
const CSS_ABBRS: Record<string, string> = {
  m: "margin: ;", mt: "margin-top: ;", mr: "margin-right: ;",
  mb: "margin-bottom: ;", ml: "margin-left: ;", mx: "margin-inline: ;",
  my: "margin-block: ;",
  p: "padding: ;", pt: "padding-top: ;", pr: "padding-right: ;",
  pb: "padding-bottom: ;", pl: "padding-left: ;", px: "padding-inline: ;",
  py: "padding-block: ;",
  w: "width: ;", h: "height: ;", mw: "max-width: ;", mh: "max-height: ;",
  d: "display: ;", db: "display: block;", df: "display: flex;",
  dg: "display: grid;", di: "display: inline;", dn: "display: none;",
  dib: "display: inline-block;",
  pos: "position: ;", posa: "position: absolute;", posr: "position: relative;",
  posf: "position: fixed;", poss: "position: sticky;",
  t: "top: ;", r: "right: ;", b: "bottom: ;", l: "left: ;",
  fl: "float: ;", fll: "float: left;", flr: "float: right;",
  fw: "font-weight: ;", fwb: "font-weight: bold;",
  fs: "font-size: ;", ff: "font-family: ;",
  ta: "text-align: ;", tac: "text-align: center;",
  tal: "text-align: left;", tar: "text-align: right;",
  td: "text-decoration: ;", tdn: "text-decoration: none;",
  tt: "text-transform: ;", ttu: "text-transform: uppercase;",
  bg: "background: ;", bgc: "background-color: ;",
  c: "color: ;", op: "opacity: ;",
  bd: "border: ;", bdn: "border: none;",
  br: "border-radius: ;",
  bs: "box-shadow: ;", bsn: "box-shadow: none;",
  z: "z-index: ;", ov: "overflow: ;", ovh: "overflow: hidden;",
  ovs: "overflow: scroll;", ova: "overflow: auto;",
  cur: "cursor: ;", curp: "cursor: pointer;",
  trs: "transition: ;", ani: "animation: ;",
  fx: "flex: ;", fxd: "flex-direction: ;", fxw: "flex-wrap: ;",
  jc: "justify-content: ;", ai: "align-items: ;",
  ac: "align-content: ;", as: "align-self: ;",
  g: "gap: ;",
};

function expandCSSAbbr(abbr: string): string | null {
  // Check direct matches
  if (CSS_ABBRS[abbr]) return CSS_ABBRS[abbr];

  // Check with number suffix: m10 → margin: 10px;
  const numMatch = abbr.match(/^([a-z]+?)(\d+)$/);
  if (numMatch) {
    const base = CSS_ABBRS[numMatch[1]];
    if (base) {
      return base.replace(";", `${numMatch[2]}px;`);
    }
  }

  return null;
}

/** Self-closing tags */
const VOID_TAGS = new Set([
  "area", "base", "br", "col", "embed", "hr", "img", "input",
  "link", "meta", "param", "source", "track", "wbr",
]);

/** Common tag shortcuts */
const TAG_ALIASES: Record<string, string> = {
  bq: "blockquote", btn: "button", hdr: "header", ftr: "footer",
  fig: "figure", figc: "figcaption", pic: "picture",
  inp: "input", sel: "select", opt: "option", tarea: "textarea",
  sect: "section", art: "article",
};

function expandHTMLAbbr(abbr: string): string | null {
  // Skip if it looks like regular code
  if (/\s/.test(abbr) || /^[0-9]/.test(abbr)) return null;

  try {
    return parseHTMLNode(abbr);
  } catch {
    return null;
  }
}

function parseHTMLNode(expr: string): string {
  // Handle sibling operator +
  if (expr.includes("+")) {
    const parts = splitTopLevel(expr, "+");
    if (parts.length > 1) {
      return parts.map(parseHTMLNode).join("\n");
    }
  }

  // Handle child operator >
  if (expr.includes(">")) {
    const parts = splitTopLevel(expr, ">");
    if (parts.length > 1) {
      const parent = parseHTMLNode(parts[0]);
      const children = parts.slice(1).reduce((parent, child) => {
        const childHtml = parseHTMLNode(child);
        const indent = "  ";
        const indented = childHtml.split("\n").map((l) => indent + l).join("\n");
        return parent.replace("$CHILD$", "\n" + indented + "\n");
      }, parent);
      return children.replace(/\$CHILD\$/g, "");
    }
  }

  // Handle multiply operator *
  const multiMatch = expr.match(/^(.+)\*(\d+)$/);
  if (multiMatch) {
    const count = parseInt(multiMatch[2]);
    return Array.from({ length: count }, () => parseHTMLNode(multiMatch[1])).join("\n");
  }

  // Parse single element: tag#id.class[attr]{text}
  const tagMatch = expr.match(/^([a-zA-Z][a-zA-Z0-9-]*)?/);
  let tag = tagMatch?.[1] ?? "div";
  tag = TAG_ALIASES[tag] ?? tag;

  let rest = expr.slice(tagMatch?.[0].length ?? 0);

  // ID
  let id = "";
  const idMatch = rest.match(/^#([a-zA-Z_][\w-]*)/);
  if (idMatch) {
    id = idMatch[1];
    rest = rest.slice(idMatch[0].length);
  }

  // Classes
  const classes: string[] = [];
  while (rest.startsWith(".")) {
    const clsMatch = rest.match(/^\.([a-zA-Z_][\w-]*)/);
    if (clsMatch) {
      classes.push(clsMatch[1]);
      rest = rest.slice(clsMatch[0].length);
    } else break;
  }

  // Attributes
  let attrs = "";
  if (rest.startsWith("[")) {
    const end = rest.indexOf("]");
    if (end > 0) {
      attrs = " " + rest.slice(1, end);
      rest = rest.slice(end + 1);
    }
  }

  // Text content
  let text = "";
  if (rest.startsWith("{")) {
    const end = rest.lastIndexOf("}");
    if (end > 0) {
      text = rest.slice(1, end);
    }
  }

  // Build opening tag
  let open = `<${tag}`;
  if (id) open += ` id="${id}"`;
  if (classes.length) open += ` class="${classes.join(" ")}"`;
  if (attrs) open += attrs;

  if (VOID_TAGS.has(tag)) {
    return open + " />";
  }

  const content = text || "$CHILD$";
  return `${open}>${content}</${tag}>`;
}

/** Split string by a delimiter, respecting brackets/braces */
function splitTopLevel(str: string, delim: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = "";
  for (const ch of str) {
    if (ch === "(" || ch === "[" || ch === "{") depth++;
    if (ch === ")" || ch === "]" || ch === "}") depth--;
    if (ch === delim && depth === 0) {
      parts.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  if (current) parts.push(current);
  return parts;
}

export const emmetPlugin: MonacoPlugin = {
  id: "builtin-emmet",
  name: "Emmet",
  version: "1.0.0",
  description: "Emmet abbreviation expansion for HTML/CSS",

  onMount(ctx: PluginContext) {
    /* Register as completion provider for trigger on Tab */
    ctx.registerCompletionProvider([...EMMET_LANGUAGES], {
      triggerCharacters: [">", "+", "*", ".", "#", "]", "}"],

      provideCompletionItems(model, position) {
        const line = model.getLineContent(position.lineNumber);
        const textBefore = line.substring(0, position.column - 1).trim();

        if (!textBefore) return { suggestions: [] };

        // Extract the abbreviation (last non-space token)
        const abbrMatch = textBefore.match(/([a-zA-Z][a-zA-Z0-9.#>+*\[\]{}="' -]*)$/);
        if (!abbrMatch) return { suggestions: [] };

        const abbr = abbrMatch[1];
        const lang = model.getLanguageId();
        const isCSS = ["css", "scss", "less", "stylus"].includes(lang);

        const expanded = expandAbbreviation(abbr, isCSS);
        if (!expanded || expanded === abbr) return { suggestions: [] };

        const range = {
          startLineNumber: position.lineNumber,
          startColumn: position.column - abbr.length,
          endLineNumber: position.lineNumber,
          endColumn: position.column,
        };

        // Place cursor at $CHILD$ or end of first empty value
        const insertText = expanded
          .replace(/\$CHILD\$/g, "")
          .replace(/: ;/, ": $1;");

        return {
          suggestions: [
            {
              label: `Emmet: ${abbr}`,
              kind: 15, // Snippet
              insertText,
              insertTextRules: 4, // InsertAsSnippet
              range,
              detail: "Emmet abbreviation",
              documentation: { value: "```html\n" + expanded.replace(/\$CHILD\$/g, "") + "\n```" },
              sortText: "0",
            },
          ],
        };
      },
    });

    /* Register Tab as expansion trigger via action */
    ctx.addAction({
      id: "emmet.expand",
      label: "Emmet: Expand Abbreviation",
      keybindings: [
        ctx.monaco.KeyMod.CtrlCmd | ctx.monaco.KeyMod.Shift | ctx.monaco.KeyCode.KeyE,
      ],
      run(editor) {
        const position = editor.getPosition();
        const model = editor.getModel();
        if (!position || !model) return;

        const line = model.getLineContent(position.lineNumber);
        const textBefore = line.substring(0, position.column - 1).trim();
        const abbrMatch = textBefore.match(/([a-zA-Z][a-zA-Z0-9.#>+*\[\]{}="' -]*)$/);
        if (!abbrMatch) return;

        const abbr = abbrMatch[1];
        const lang = model.getLanguageId();
        const isCSS = ["css", "scss", "less", "stylus"].includes(lang);
        const expanded = expandAbbreviation(abbr, isCSS);
        if (!expanded) return;

        const clean = expanded.replace(/\$CHILD\$/g, "");
        const range = new (ctx as any).monaco.Range(
          position.lineNumber,
          position.column - abbr.length,
          position.lineNumber,
          position.column,
        );

        editor.executeEdits("emmet", [{ range, text: clean }]);
      },
    });
  },
};
