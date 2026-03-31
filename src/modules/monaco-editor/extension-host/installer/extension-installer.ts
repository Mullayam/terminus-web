/**
 * @module extension-host/installer/extension-installer
 *
 * Validates, installs, and manages extension packages.
 * Storage: OPFS for files, Dexie for index/search.
 */

import type {
    Disposable,
    ExtensionInfo,
    ExtensionManifest,
    ExtensionStatus,
} from "../types";
import { ExtensionOPFS } from "./opfs";
import {
    indexExtension,
    indexFile,
    removeExtensionIndex,
    getExtensionDB,
} from "./extension-db";

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

    readonly opfs = new ExtensionOPFS();

    /** Load all installed extensions from Dexie + OPFS. */
    async init(): Promise<void> {
        if (this.initialized) return;

        // Initialize OPFS
        await this.opfs.init();

        // Load extension index from Dexie
        const db = getExtensionDB();
        const records = await db.extensions.toArray();
        for (const rec of records) {
            this.installed.set(rec.id, {
                id: rec.id,
                manifest: rec.manifest,
                status: rec.enabled ? "installed" : "inactive",
                installPath: `/extensions/${rec.id}`,
            });
        }

        this.initialized = true;
    }

    /**
     * Install an extension from a manifest + bundled source.
     * @param manifest Parsed package.json
     * @param source   Bundled JS source code (the `main` entry)
     * @param extraFiles Optional additional files { path: content }
     */
    async install(
        manifest: ExtensionManifest,
        source: string,
        extraFiles?: Record<string, string>,
    ): Promise<ExtensionInfo> {
        const validation = validateManifest(manifest);
        if (!validation.valid) {
            throw new Error(
                `Invalid manifest: ${validation.errors.join("; ")}`,
            );
        }

        const id = extensionId(manifest);
        const installPath = `/extensions/${id}`;

        // 1. Store files in OPFS
        await this.opfs.writeFile(
            id,
            "package.json",
            JSON.stringify(manifest, null, 2),
        );
        await this.opfs.writeFile(id, manifest.main, source);

        // Store extra files if provided
        if (extraFiles) {
            for (const [path, content] of Object.entries(extraFiles)) {
                await this.opfs.writeFile(id, path, content);
            }
        }

        // 2. Index in Dexie
        await indexExtension(manifest);
        await indexFile(
            id,
            "package.json",
            JSON.stringify(manifest).length,
            "application/json",
        );
        await indexFile(
            id,
            manifest.main,
            source.length,
            "application/javascript",
        );

        if (extraFiles) {
            for (const [path, content] of Object.entries(extraFiles)) {
                await indexFile(id, path, content.length);
            }
        }

        // 3. Update in-memory
        const info: ExtensionInfo = {
            id,
            manifest,
            status: "installed",
            installPath,
        };
        this.installed.set(id, info);

        return info;
    }

    /** Uninstall an extension — removes OPFS files + Dexie index. */
    async uninstall(id: string): Promise<void> {
        const info = this.installed.get(id);
        if (!info) return;

        // Remove from OPFS
        await this.opfs.removeExtension(id);

        // Remove from Dexie index
        await removeExtensionIndex(id);

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

    /** Load the extension's main source code from OPFS. */
    async loadSource(id: string): Promise<string | undefined> {
        const info = this.installed.get(id);
        if (!info) return undefined;
        try {
            return await this.opfs.readFile(id, info.manifest.main);
        } catch {
            return undefined;
        }
    }

    /** Read any file from an extension's OPFS directory. */
    async readExtensionFile(
        extId: string,
        path: string,
    ): Promise<string> {
        return this.opfs.readFile(extId, path);
    }

    /** Write a file to an extension's OPFS directory. */
    async writeExtensionFile(
        extId: string,
        path: string,
        content: string,
    ): Promise<void> {
        await this.opfs.writeFile(extId, path, content);
        await indexFile(extId, path, content.length);
    }

    /** List files in an extension's directory. */
    async listExtensionFiles(
        extId: string,
        subPath = "",
    ): Promise<Array<{ name: string; kind: "file" | "directory" }>> {
        return this.opfs.readdir(extId, subPath);
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
