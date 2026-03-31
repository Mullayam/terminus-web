/**
 * @module extension-host/installer/opfs
 *
 * Origin Private File System (OPFS) based virtual file system.
 * Each extension gets its own directory: /extensions/{extensionId}/
 *
 * Layout:
 *   /extensions/
 *     publisher.ext-name/
 *       package.json
 *       dist/index.js        (the main bundle)
 *       ... any other files
 */

export class ExtensionOPFS {
    private root: FileSystemDirectoryHandle | null = null;

    /** Initialize OPFS root. Call once on startup. */
    async init(): Promise<void> {
        if (this.root) return;
        const opfsRoot = await navigator.storage.getDirectory();
        this.root = await opfsRoot.getDirectoryHandle("extensions", {
            create: true,
        });
    }

    private assertRoot(): FileSystemDirectoryHandle {
        if (!this.root) throw new Error("OPFS not initialized — call init() first");
        return this.root;
    }

    // ── Directory operations ─────────────────────────────────

    /** Get or create extension directory. */
    async getExtDir(extensionId: string): Promise<FileSystemDirectoryHandle> {
        const root = this.assertRoot();
        return root.getDirectoryHandle(sanitizeName(extensionId), {
            create: true,
        });
    }

    /** Create a subdirectory tree (e.g. "dist/lib"). */
    async mkdir(extensionId: string, path: string): Promise<FileSystemDirectoryHandle> {
        let dir = await this.getExtDir(extensionId);
        for (const segment of splitPath(path)) {
            dir = await dir.getDirectoryHandle(segment, { create: true });
        }
        return dir;
    }

    /** List entries in a directory. */
    async readdir(
        extensionId: string,
        path = "",
    ): Promise<Array<{ name: string; kind: "file" | "directory" }>> {
        const dir = await this.resolve(extensionId, path);
        if (dir.kind !== "directory") throw new Error(`Not a directory: ${path}`);

        const entries: Array<{ name: string; kind: "file" | "directory" }> = [];
        // Cast to AsyncIterable — TS lib doesn't include directory iteration yet
        const dirHandle = dir as FileSystemDirectoryHandle;
        const iterable = dirHandle as unknown as AsyncIterable<[string, FileSystemHandle]>;
        for await (const [name, handle] of iterable) {
            entries.push({ name, kind: handle.kind });
        }
        return entries;
    }

    // ── File operations ──────────────────────────────────────

    /** Write a text file. Creates parent dirs automatically. */
    async writeFile(
        extensionId: string,
        path: string,
        content: string,
    ): Promise<void> {
        const segments = splitPath(path);
        const fileName = segments.pop();
        if (!fileName) throw new Error("Invalid file path");

        // Ensure parent directories
        let dir = await this.getExtDir(extensionId);
        for (const seg of segments) {
            dir = await dir.getDirectoryHandle(seg, { create: true });
        }

        const fileHandle = await dir.getFileHandle(fileName, { create: true });
        const writable = await fileHandle.createWritable();
        await writable.write(content);
        await writable.close();
    }

    /** Write binary data. */
    async writeFileBytes(
        extensionId: string,
        path: string,
        data: ArrayBuffer | Uint8Array,
    ): Promise<void> {
        const segments = splitPath(path);
        const fileName = segments.pop();
        if (!fileName) throw new Error("Invalid file path");

        let dir = await this.getExtDir(extensionId);
        for (const seg of segments) {
            dir = await dir.getDirectoryHandle(seg, { create: true });
        }

        const fileHandle = await dir.getFileHandle(fileName, { create: true });
        const writable = await fileHandle.createWritable();
        await writable.write(new Blob([data as BlobPart]));
        await writable.close();
    }

    /** Read a text file. */
    async readFile(extensionId: string, path: string): Promise<string> {
        const handle = await this.resolve(extensionId, path);
        if (handle.kind !== "file") throw new Error(`Not a file: ${path}`);
        const file = await (handle as FileSystemFileHandle).getFile();
        return file.text();
    }

    /** Read binary data. */
    async readFileBytes(
        extensionId: string,
        path: string,
    ): Promise<ArrayBuffer> {
        const handle = await this.resolve(extensionId, path);
        if (handle.kind !== "file") throw new Error(`Not a file: ${path}`);
        const file = await (handle as FileSystemFileHandle).getFile();
        return file.arrayBuffer();
    }

    /** Delete a file. */
    async unlink(extensionId: string, path: string): Promise<void> {
        const segments = splitPath(path);
        const fileName = segments.pop();
        if (!fileName) throw new Error("Invalid file path");

        let dir = await this.getExtDir(extensionId);
        for (const seg of segments) {
            dir = await dir.getDirectoryHandle(seg);
        }

        await dir.removeEntry(fileName);
    }

    /** Delete a directory recursively. */
    async rmdir(extensionId: string, path: string): Promise<void> {
        const segments = splitPath(path);
        const dirName = segments.pop();
        if (!dirName) {
            // Removing the extension root
            const root = this.assertRoot();
            await root.removeEntry(sanitizeName(extensionId), {
                recursive: true,
            });
            return;
        }

        let parent = await this.getExtDir(extensionId);
        for (const seg of segments) {
            parent = await parent.getDirectoryHandle(seg);
        }
        await parent.removeEntry(dirName, { recursive: true });
    }

    /** Remove entire extension directory. */
    async removeExtension(extensionId: string): Promise<void> {
        const root = this.assertRoot();
        try {
            await root.removeEntry(sanitizeName(extensionId), {
                recursive: true,
            });
        } catch {
            // Already removed or doesn't exist
        }
    }

    /** Check if a file/directory exists. */
    async exists(extensionId: string, path: string): Promise<boolean> {
        try {
            await this.resolve(extensionId, path);
            return true;
        } catch {
            return false;
        }
    }

    // ── Internal ─────────────────────────────────────────────

    /** Resolve a path to a handle. */
    private async resolve(
        extensionId: string,
        path: string,
    ): Promise<FileSystemDirectoryHandle | FileSystemFileHandle> {
        let dir = await this.getExtDir(extensionId);
        const segments = splitPath(path);

        if (segments.length === 0) return dir;

        // Walk directories
        for (let i = 0; i < segments.length - 1; i++) {
            dir = await dir.getDirectoryHandle(segments[i]);
        }

        const last = segments[segments.length - 1];

        // Try as file first, then directory
        try {
            return await dir.getFileHandle(last);
        } catch {
            return await dir.getDirectoryHandle(last);
        }
    }
}

// ─── Helpers ──────────────────────────────────

function splitPath(path: string): string[] {
    return path
        .split("/")
        .filter((s) => s.length > 0 && s !== ".");
}

/** Sanitize extension ID for use as directory name. */
function sanitizeName(name: string): string {
    return name.replace(/[^a-zA-Z0-9._-]/g, "_");
}
