/**
 * @module editor/plugins/builtin/lorem-ipsum
 *
 * Generate lorem ipsum placeholder text.
 */
import type { ExtendedEditorPlugin } from "../types";

const LOREM_WORDS = [
    "lorem", "ipsum", "dolor", "sit", "amet", "consectetur",
    "adipiscing", "elit", "sed", "do", "eiusmod", "tempor",
    "incididunt", "ut", "labore", "et", "dolore", "magna",
    "aliqua", "enim", "ad", "minim", "veniam", "quis",
    "nostrud", "exercitation", "ullamco", "laboris", "nisi",
    "aliquip", "ex", "ea", "commodo", "consequat", "duis",
    "aute", "irure", "in", "reprehenderit", "voluptate",
    "velit", "esse", "cillum", "fugiat", "nulla", "pariatur",
    "excepteur", "sint", "occaecat", "cupidatat", "non",
    "proident", "sunt", "culpa", "qui", "officia", "deserunt",
    "mollit", "anim", "id", "est", "laborum",
];

function generateLorem(wordCount: number): string {
    const words: string[] = [];
    for (let i = 0; i < wordCount; i++) {
        words.push(LOREM_WORDS[i % LOREM_WORDS.length]);
    }
    // Capitalize first word, add period at end
    words[0] = words[0][0].toUpperCase() + words[0].slice(1);

    // Break into sentences every 8-15 words
    const sentences: string[] = [];
    let sentenceLen = 0;
    let start = 0;
    const targetLen = 10;

    for (let i = 0; i < words.length; i++) {
        sentenceLen++;
        if (sentenceLen >= targetLen || i === words.length - 1) {
            const sentence = words.slice(start, i + 1).join(" ") + ".";
            sentences.push(sentence);
            start = i + 1;
            sentenceLen = 0;
            if (start < words.length) {
                words[start] = words[start][0].toUpperCase() + words[start].slice(1);
            }
        }
    }

    return sentences.join(" ");
}

export function createLoremIpsumPlugin(): ExtendedEditorPlugin {
    return {
        id: "lorem-ipsum",
        name: "Lorem Ipsum Generator",
        version: "1.0.0",
        description: "Insert lorem ipsum placeholder text",
        category: "tools",
        defaultEnabled: true,

        onActivate(api) {
            api.registerCommand("lorem.paragraph", () => {
                const text = generateLorem(50);
                api.replaceSelection(text);
            });

            api.registerCommand("lorem.short", () => {
                const text = generateLorem(15);
                api.replaceSelection(text);
            });

            api.registerCommand("lorem.long", () => {
                const paragraphs = Array.from({ length: 3 }, () => generateLorem(50));
                api.replaceSelection(paragraphs.join("\n\n"));
            });

            api.addContextMenuItem({
                label: "Insert Lorem Ipsum",
                action: () => api.executeCommand("lorem.paragraph"),
                priority: 70,
            });
        },
    };
}
