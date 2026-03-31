/**
 * @module extension-host/installer/extension-installer
 *
 * Validates, installs, and manages extension packages.
 * Extensions are stored in IndexedDB for persistence.
 */

import type {
    Disposable,
    ExtensionInfo,
    ExtensionManifest,
    ExtensionStatus,
} from "../types";

// ─── IDB Storage ─────────────────────────────────────────────

const DB_NAME = "terminus-extensions";
const DB_VERSION = 1;
const STORE_MANIFESTS = "manifests";
const STORE_FILES = "files";

function openDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = () => {
            const db = req.result;
            if (!db.objectStoreNames.contains(STORE_MANIFESTS)) {
                db.createObjectStore(STORE_MANIFESTS, { keyPath: "id" });
            }
            if (!db.objectStoreNames.contains(STORE_FILES)) {
                db.createObjectStore(STORE_FILES);
            }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

async function idbPut(
    store: string,
    key: string | undefined,
    value: unknown,
): Promise<void> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(store, "readwrite");
        const s = tx.objectStore(store);
        // If keyPath is set (manifests), key is inside value
        if (key === undefined) {
            s.put(value);
        } else {
            s.put(value, key);
        }
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
}

async function idbGet<T>(store: string, key: string): Promise<T | undefined> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(store, "readonly");
        const req = tx.objectStore(store).get(key);
        req.onsuccess = () => resolve(req.result as T | undefined);
        req.onerror = () => reject(req.error);
    });
}

async function idbGetAll<T>(store: string): Promise<T[]> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(store, "readonly");
        const req = tx.objectStore(store).getAll();
        req.onsuccess = () => resolve(req.result as T[]);
        req.onerror = () => reject(req.error);
    });
}

async function idbDelete(store: string, key: string): Promise<void> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(store, "readwrite");
        tx.objectStore(store).delete(key);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
}

// ─── Validation ──────────────────────────────────────────────

/** Allowlist of APIs extensions can use. Anything else is blocked. */
const ALLOWED_APIS = new Set([
    "vscode.commands",
    "vscode.window",
    "vscode.workspace",
    "vscode.languages",
]);

export interface ValidationResult {
    valid: boolean;
    errors: string[];
    warnings: string[];
}

export function validateManifest(manifest: unknown): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!manifest || typeof manifest !== "object") {
        return { valid: false, errors: ["Manifest is not an object"], warnings };
    }

    const m = manifest as Record<string, unknown>;

    if (!m.name || typeof m.name !== "string") {
        errors.push("Missing or invalid 'name'");
    }
    if (!m.version || typeof m.version !== "string") {
        errors.push("Missing or invalid 'version'");
    }
    if (!m.main || typeof m.main !== "string") {
        errors.push("Missing or invalid 'main' entry point");
    }

    // Validate name format (alphanumeric + hyphens)
    if (typeof m.name === "string" && !/^[a-z0-9][a-z0-9._-]*$/i.test(m.name)) {
        errors.push(
            "Extension name must be alphanumeric with dots, hyphens, or underscores",
        );
    }

    // Warn about missing activation events
    if (!m.activationEvents || !Array.isArray(m.activationEvents)) {
        warnings.push(
            "No activationEvents defined — extension will only activate on '*'",
        );
    }

    return { valid: errors.length === 0, errors, warnings };
}

// ─── Installer ───────────────────────────────────────────────

export class ExtensionInstaller implements Disposable {
    /** In-memory registry of installed extensions. */
    private installed = new Map<string, ExtensionInfo>();
    private initialized = false;

    /** Load all installed extensions from IDB. */
    async init(): Promise<void> {
        if (this.initialized) return;
        const stored = await idbGetAll<ExtensionInfo>(STORE_MANIFESTS);
        for (const info of stored) {
            this.installed.set(info.id, { ...info, status: "installed" });
        }
        this.initialized = true;
    }

    /**
     * Install an extension from a manifest + bundled source.
     * @param manifest Parsed package.json
     * @param source   Bundled JS source code (the `main` entry)
     */
    async install(
        manifest: ExtensionManifest,
        source: string,
    ): Promise<ExtensionInfo> {
        const validation = validateManifest(manifest);
        if (!validation.valid) {
            throw new Error(
                `Invalid manifest: ${validation.errors.join("; ")}`,
            );
        }

        const id = extensionId(manifest);
        const installPath = `/extensions/${id}`;

        const info: ExtensionInfo = {
            id,
            manifest,
            status: "installed",
            installPath,
        };

        // Store manifest
        await idbPut(STORE_MANIFESTS, undefined, info);

        // Store source bundle
        await idbPut(STORE_FILES, `${installPath}/${manifest.main}`, source);

        this.installed.set(id, info);
        return info;
    }

    /** Uninstall an extension. */
    async uninstall(id: string): Promise<void> {
        const info = this.installed.get(id);
        if (!info) return;

        await idbDelete(STORE_MANIFESTS, id);
        await idbDelete(
            STORE_FILES,
            `${info.installPath}/${info.manifest.main}`,
        );
        this.installed.delete(id);
    }

    /** Get info for an installed extension. */
    get(id: string): ExtensionInfo | undefined {
        return this.installed.get(id);
    }

    /** List all installed extensions. */
    getAll(): ExtensionInfo[] {
        return [...this.installed.values()];
    }

    /** Update extension status in memory. */
    setStatus(id: string, status: ExtensionStatus, error?: string): void {
        const info = this.installed.get(id);
        if (!info) return;
        info.status = status;
        info.error = error;
        if (status === "active") info.activatedAt = Date.now();
    }

    /** Load the extension's source code from IDB. */
    async loadSource(id: string): Promise<string | undefined> {
        const info = this.installed.get(id);
        if (!info) return undefined;
        return idbGet<string>(
            STORE_FILES,
            `${info.installPath}/${info.manifest.main}`,
        );
    }

    dispose(): void {
        this.installed.clear();
    }
}

// ─── Helpers ─────────────────────────────────────────────────

function extensionId(manifest: ExtensionManifest): string {
    const publisher = manifest.publisher ?? "local";
    return `${publisher}.${manifest.name}`;
}

export { ALLOWED_APIS };
