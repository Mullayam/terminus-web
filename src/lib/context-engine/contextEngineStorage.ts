/**
 * @module lib/context-engine/contextEngineStorage
 *
 * Dexie IndexedDB storage for @enjoys/context-engine data.
 * Separate database from the extension storage.
 *
 * Two databases:
 *   - terminus-context-languages  : completions, definitions, hover per language
 *   - terminus-context-commands   : terminal command context per category
 */
import Dexie, { type EntityTable } from "dexie";
import { PROVIDER_TYPES, type ProviderType, type LanguageDataResult } from "./contextEngineApi";

/* ── Record Types ──────────────────────────────────────────── */

/** A single installed language context pack */
export interface ContextLanguagePack {
    /** language id, e.g. "bash", "python" */
    id: string;
    name: string;
    installedAt: number;
}

/** Stored provider data JSON blob for a language */
export interface ContextLanguageData {
    /** "completion::bash", "definition::bash", etc. */
    id: string;
    languageId: string;
    type: ProviderType;
    /** The raw JSON payload from CDN */
    data: unknown;
}

/** A terminal command category */
export interface ContextCommandCategory {
    /** category name as id */
    id: string;
    category: string;
    context: string[];
    files: string[];
    installedAt?: number;
}

/** Individual terminal command file data */
export interface ContextCommandData {
    /** "category::filename" e.g. "Cloud CLIs::aws.json" */
    id: string;
    categoryId: string;
    fileName: string;
    /** Raw JSON data (array of command completions) */
    data: unknown;
}

/* ── Language Context DB ───────────────────────────────────── */

class ContextLanguageDB extends Dexie {
    languages!: EntityTable<ContextLanguagePack, "id">;
    data!: EntityTable<ContextLanguageData, "id">;

    constructor() {
        super("terminus-context-languages");
        this.version(1).stores({
            languages: "id, name",
            data: "id, languageId, type",
        });
    }
}

/* ── Terminal Commands DB ──────────────────────────────────── */

class ContextCommandDB extends Dexie {
    categories!: EntityTable<ContextCommandCategory, "id">;
    commands!: EntityTable<ContextCommandData, "id">;

    constructor() {
        super("terminus-context-commands");
        this.version(1).stores({
            categories: "id, category",
            commands: "id, categoryId, fileName",
        });
    }
}

/* ── Singleton instances ───────────────────────────────────── */

export const langDb = new ContextLanguageDB();
export const cmdDb = new ContextCommandDB();

/* ── Language Pack CRUD ────────────────────────────────────── */

export async function saveLanguagePack(
    id: string,
    name: string,
    data: LanguageDataResult,
): Promise<void> {
    await langDb.transaction("rw", [langDb.languages, langDb.data], async () => {
        await langDb.languages.put({ id, name, installedAt: Date.now() });
        const records = PROVIDER_TYPES
            .filter((type) => data[type] != null)
            .map((type) => ({
                id: `${type}::${id}`,
                languageId: id,
                type,
                data: data[type],
            }));
        await langDb.data.bulkPut(records);
    });
}

export async function removeLanguagePack(id: string): Promise<void> {
    await langDb.transaction("rw", [langDb.languages, langDb.data], async () => {
        await langDb.languages.delete(id);
        await langDb.data.where("languageId").equals(id).delete();
    });
}

export async function getInstalledLanguages(): Promise<ContextLanguagePack[]> {
    return langDb.languages.toArray();
}

export async function isLanguageInstalled(id: string): Promise<boolean> {
    return (await langDb.languages.get(id)) !== undefined;
}

export async function getLanguageData(
    languageId: string,
    type: ProviderType,
): Promise<unknown | undefined> {
    const record = await langDb.data.get(`${type}::${languageId}`);
    return record?.data;
}

export async function getAllLanguageCompletions(): Promise<ContextLanguageData[]> {
    return langDb.data.where("type").equals("completion").toArray();
}

/* ── Terminal Command CRUD ─────────────────────────────────── */

export async function saveCommandCategory(
    category: ContextCommandCategory,
    commandFiles: { fileName: string; data: unknown }[],
): Promise<void> {
    await cmdDb.transaction("rw", [cmdDb.categories, cmdDb.commands], async () => {
        await cmdDb.categories.put({
            ...category,
            installedAt: Date.now(),
        });
        await cmdDb.commands.bulkPut(
            commandFiles.map((f) => ({
                id: `${category.id}::${f.fileName}`,
                categoryId: category.id,
                fileName: f.fileName,
                data: f.data,
            })),
        );
    });
}

export async function removeCommandCategory(id: string): Promise<void> {
    await cmdDb.transaction("rw", [cmdDb.categories, cmdDb.commands], async () => {
        await cmdDb.categories.delete(id);
        await cmdDb.commands.where("categoryId").equals(id).delete();
    });
}

export async function getInstalledCategories(): Promise<ContextCommandCategory[]> {
    return cmdDb.categories.toArray();
}

export async function isCategoryInstalled(id: string): Promise<boolean> {
    return (await cmdDb.categories.get(id)) !== undefined;
}

export async function getCommandDataForCategory(categoryId: string): Promise<ContextCommandData[]> {
    return cmdDb.commands.where("categoryId").equals(categoryId).toArray();
}

export async function getAllCommandData(): Promise<ContextCommandData[]> {
    return cmdDb.commands.toArray();
}

export async function clearAllLanguageData(): Promise<void> {
    await langDb.transaction("rw", [langDb.languages, langDb.data], async () => {
        await langDb.languages.clear();
        await langDb.data.clear();
    });
}

export async function clearAllCommandData(): Promise<void> {
    await cmdDb.transaction("rw", [cmdDb.categories, cmdDb.commands], async () => {
        await cmdDb.categories.clear();
        await cmdDb.commands.clear();
    });
}
