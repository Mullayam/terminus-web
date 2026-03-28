/**
 * @module editor/plugins/builtin/spell-check
 *
 * Basic spell-check for comments and strings
 * using a common English word list.
 */
import type { ExtendedEditorPlugin, ExtendedPluginAPI, Diagnostic } from "../types";

// Common misspellings and their corrections
const COMMON_TYPOS: Record<string, string> = {
    "teh": "the", "adn": "and", "hte": "the", "taht": "that",
    "wiht": "with", "waht": "what", "recieve": "receive",
    "occured": "occurred", "seperate": "separate", "definately": "definitely",
    "accomodate": "accommodate", "occurence": "occurrence",
    "neccessary": "necessary", "succesful": "successful",
    "independant": "independent", "refered": "referred",
    "enviroment": "environment", "goverment": "government",
    "begining": "beginning", "beleive": "believe",
    "calender": "calendar", "catagory": "category",
    "commited": "committed", "comparision": "comparison",
    "concious": "conscious", "consistant": "consistent",
    "developement": "development", "dissapear": "disappear",
    "existance": "existence", "foriegn": "foreign",
    "guarentee": "guarantee", "immediatly": "immediately",
    "knowlege": "knowledge", "occurrance": "occurrence",
    "persistant": "persistent", "priviledge": "privilege",
    "recomend": "recommend", "refrence": "reference",
    "relevent": "relevant", "suprise": "surprise",
    "untill": "until", "wierd": "weird",
};

function checkSpelling(content: string): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];
    const lines = content.split("\n");

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        // Only check comments and strings
        const isComment = line.trim().startsWith("//") || line.trim().startsWith("#") || line.trim().startsWith("*");
        if (!isComment) continue;

        const words = line.match(/\b[a-zA-Z]+\b/g) || [];
        for (const word of words) {
            const lower = word.toLowerCase();
            if (COMMON_TYPOS[lower]) {
                const col = line.indexOf(word);
                diagnostics.push({
                    id: `spell-check:${i + 1}:${col}`,
                    line: i + 1,
                    startCol: col,
                    endCol: col + word.length,
                    message: `Possible typo: "${word}" → "${COMMON_TYPOS[lower]}"`,
                    severity: "info",
                    source: "spell-check",
                    fixes: [
                        {
                            label: `Change to "${COMMON_TYPOS[lower]}"`,
                            apply: () => {
                                // Fix handled by diagnostic fix system
                            },
                        },
                    ],
                });
            }
        }
    }

    return diagnostics;
}

export function createSpellCheckPlugin(): ExtendedEditorPlugin {
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;

    return {
        id: "spell-check",
        name: "Spell Check",
        version: "1.0.0",
        description: "Basic spell-checking for comments using common typo detection",
        category: "validation",
        defaultEnabled: true,

        onContentChange(_content, api) {
            if (debounceTimer) clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => update(api), 800);
        },

        onDeactivate(api) {
            if (debounceTimer) clearTimeout(debounceTimer);
            api.clearDiagnostics("spell-check");
        },
    };
}

function update(api: ExtendedPluginAPI) {
    const content = api.getContent();
    const diags = checkSpelling(content);
    api.setDiagnostics(diags);
}
