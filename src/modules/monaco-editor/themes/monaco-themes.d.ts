/**
 * Type declarations for the `monaco-themes` package.
 * The package ships raw JSON theme files without TypeScript declarations.
 */

// Main theme list JSON (kebab-case id → display name)
declare module "monaco-themes/themes/themelist.json" {
    const value: Record<string, string>;
    export default value;
}

// Wildcard module for all individual theme JSON files
declare module "monaco-themes/themes/*.json" {
    const value: {
        base: "vs" | "vs-dark" | "hc-black" | "hc-light";
        inherit: boolean;
        rules: Array<{
            token: string;
            foreground?: string;
            background?: string;
            fontStyle?: string;
        }>;
        colors: Record<string, string>;
    };
    export default value;
}
