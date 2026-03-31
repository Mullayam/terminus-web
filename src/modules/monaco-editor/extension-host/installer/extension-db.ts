/**
 * @module extension-host/installer/extension-db
 *
 * Dexie.js database for indexing and searching extensions.
 * Provides fast full-text search over extension metadata, commands, and files.
 */

import Dexie from "dexie";
import type { ExtensionManifest } from "../types";

// ─── Table schemas ───────────────────────────────────────────

/** Stored extension record. */
export interface ExtensionRecord {
    /** Primary key: publisher.name */
    id: string;
    name: string;
    displayName: string;
    publisher: string;
    version: string;
    description: string;
    /** Serialized manifest. */
    manifest: ExtensionManifest;
    /** Installation timestamp. */
    installedAt: number;
    /** Whether extension is currently enabled. */
    enabled: boolean;
    /** Tags for search (extracted from manifest). */
    tags: string[];
}

/** Indexed command record. */
export interface CommandRecord {
    /** Auto-incremented. */
    id?: number;
    /** Command string ID (e.g. "myExt.doThing"). */
    commandId: string;
    title: string;
    category: string;
    extensionId: string;
}

/** Indexed file record — tracks files stored in OPFS. */
export interface FileRecord {
    /** Auto-incremented. */
    id?: number;
    /** Extension that owns this file. */
    extensionId: string;
    /** Relative path within extension directory. */
    path: string;
    /** File size in bytes. */
    size: number;
    /** MIME type if known. */
    mimeType: string;
    /** Last modified timestamp. */
    modifiedAt: number;
}

// ─── Database ────────────────────────────────────────────────

class ExtensionDatabase extends Dexie {
    extensions!: Dexie.Table<ExtensionRecord, string>;
    commands!: Dexie.Table<CommandRecord, number>;
    files!: Dexie.Table<FileRecord, number>;

    constructor() {
        super("terminus-ext-index");

        this.version(1).stores({
            // Primary key + indexed fields
            extensions:
                "id, name, publisher, version, *tags, installedAt, enabled",
            commands: "++id, commandId, extensionId, title, category",
            files: "++id, extensionId, path, mimeType, modifiedAt",
        });
    }
}

/** Singleton database instance. */
let _db: ExtensionDatabase | null = null;

export function getExtensionDB(): ExtensionDatabase {
    if (!_db) {
        _db = new ExtensionDatabase();
    }
    return _db;
}

// ─── Extension CRUD ──────────────────────────────────────────

export async function indexExtension(
    manifest: ExtensionManifest,
): Promise<void> {
    const db = getExtensionDB();
    const id = `${manifest.publisher ?? "local"}.${manifest.name}`;

    const tags = extractTags(manifest);

    await db.extensions.put({
        id,
        name: manifest.name,
        displayName: manifest.displayName ?? manifest.name,
        publisher: manifest.publisher ?? "local",
        version: manifest.version,
        description: manifest.description ?? "",
        manifest,
        installedAt: Date.now(),
        enabled: true,
        tags,
    });

    // Index contributed commands
    if (manifest.contributes?.commands) {
        const cmdRecords: CommandRecord[] = manifest.contributes.commands.map(
            (c) => ({
                commandId: c.command,
                title: c.title,
                category: c.category ?? "",
                extensionId: id,
            }),
        );
        await db.commands.bulkPut(cmdRecords);
    }
}

export async function removeExtensionIndex(
    extensionId: string,
): Promise<void> {
    const db = getExtensionDB();
    await db.extensions.delete(extensionId);
    await db.commands.where("extensionId").equals(extensionId).delete();
    await db.files.where("extensionId").equals(extensionId).delete();
}

export async function setExtensionEnabled(
    extensionId: string,
    enabled: boolean,
): Promise<void> {
    const db = getExtensionDB();
    await db.extensions.update(extensionId, { enabled });
}

// ─── File index ──────────────────────────────────────────────

export async function indexFile(
    extensionId: string,
    path: string,
    size: number,
    mimeType = "",
): Promise<void> {
    const db = getExtensionDB();

    // Upsert: check if path exists for this extension
    const existing = await db.files
        .where("[extensionId+path]")
        .equals([extensionId, path])
        .first()
        .catch(() => undefined);

    if (existing?.id) {
        await db.files.update(existing.id, {
            size,
            mimeType,
            modifiedAt: Date.now(),
        });
    } else {
        await db.files.add({
            extensionId,
            path,
            size,
            mimeType,
            modifiedAt: Date.now(),
        });
    }
}

export async function removeFileIndex(
    extensionId: string,
    path: string,
): Promise<void> {
    const db = getExtensionDB();
    await db.files
        .where("extensionId")
        .equals(extensionId)
        .and((f) => f.path === path)
        .delete();
}

// ─── Search ──────────────────────────────────────────────────

export interface SearchResult {
    extensions: ExtensionRecord[];
    commands: CommandRecord[];
}

/**
 * Full-text search across extensions and commands.
 * Matches against name, displayName, description, tags, command titles.
 */
export async function searchExtensions(
    query: string,
    limit = 20,
): Promise<SearchResult> {
    const db = getExtensionDB();
    const q = query.toLowerCase();

    const extensions = await db.extensions
        .filter(
            (ext) =>
                ext.name.toLowerCase().includes(q) ||
                ext.displayName.toLowerCase().includes(q) ||
                ext.description.toLowerCase().includes(q) ||
                ext.tags.some((t) => t.toLowerCase().includes(q)),
        )
        .limit(limit)
        .toArray();

    const commands = await db.commands
        .filter(
            (cmd) =>
                cmd.commandId.toLowerCase().includes(q) ||
                cmd.title.toLowerCase().includes(q) ||
                cmd.category.toLowerCase().includes(q),
        )
        .limit(limit)
        .toArray();

    return { extensions, commands };
}

/** List all installed extensions. */
export async function listExtensions(options?: {
    enabledOnly?: boolean;
    sortBy?: "name" | "installedAt";
}): Promise<ExtensionRecord[]> {
    const db = getExtensionDB();
    let collection = db.extensions.toCollection();

    if (options?.enabledOnly) {
        collection = db.extensions.where("enabled").equals(1 as unknown as string);
    }

    const results = await collection.toArray();

    if (options?.sortBy === "installedAt") {
        results.sort((a, b) => b.installedAt - a.installedAt);
    } else {
        results.sort((a, b) => a.name.localeCompare(b.name));
    }

    return results;
}

/** Get files for an extension. */
export async function listExtensionFiles(
    extensionId: string,
): Promise<FileRecord[]> {
    const db = getExtensionDB();
    return db.files.where("extensionId").equals(extensionId).toArray();
}

// ─── Helpers ─────────────────────────────────────────────────

function extractTags(manifest: ExtensionManifest): string[] {
    const tags: string[] = [];

    if (manifest.publisher) tags.push(manifest.publisher);
    tags.push(manifest.name);

    // Extract language IDs from contributions
    if (manifest.contributes?.languages) {
        for (const lang of manifest.contributes.languages) {
            tags.push(lang.id);
            if (lang.aliases) tags.push(...lang.aliases);
        }
    }

    // Extract command categories
    if (manifest.contributes?.commands) {
        const categories = new Set(
            manifest.contributes.commands
                .map((c) => c.category)
                .filter(Boolean) as string[],
        );
        tags.push(...categories);
    }

    // Activation events as tags
    if (manifest.activationEvents) {
        for (const ev of manifest.activationEvents) {
            if (ev.startsWith("onLanguage:")) {
                tags.push(ev.slice("onLanguage:".length));
            }
        }
    }

    return [...new Set(tags)];
}
