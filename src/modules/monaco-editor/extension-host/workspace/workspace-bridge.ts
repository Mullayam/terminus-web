/**
 * @module extension-host/workspace/workspace-bridge
 *
 * Bridges workspace file system calls from extensions (via RPC)
 * to the actual FileSystemProvider on the main thread.
 *
 * This module runs on the MAIN THREAD and registers RPC handlers
 * so that extensions in the worker can read/write files.
 */

import type { RPCChannel } from "../rpc/rpc-protocol";
import type { Disposable } from "../types";

/**
 * Minimal file system interface that the workspace bridge requires.
 * This is intentionally decoupled from the concrete FileSystemProvider
 * so the extension host doesn't depend on the full FS module.
 */
export interface WorkspaceFileSystem {
    readFile(path: string): Promise<string>;
    writeFile(path: string, content: string): Promise<void>;
    readDirectory(path: string): Promise<Array<[string, "file" | "directory"]>>;
    deleteFile(path: string, options?: { recursive?: boolean }): Promise<void>;
    rename(oldPath: string, newPath: string): Promise<void>;
}

export class WorkspaceBridge implements Disposable {
    private subscriptions: Disposable[] = [];

    constructor(
        private rpc: RPCChannel,
        private fs: WorkspaceFileSystem,
        private workspaceRoot?: string,
    ) {
        this.registerHandlers();
    }

    private registerHandlers(): void {
        this.subscriptions.push(
            this.rpc.onRequest("workspace/readFile", async (uri: unknown) => {
                return this.fs.readFile(uri as string);
            }),

            this.rpc.onRequest(
                "workspace/writeFile",
                async (uri: unknown, content: unknown) => {
                    await this.fs.writeFile(uri as string, content as string);
                },
            ),

            this.rpc.onRequest(
                "workspace/readDirectory",
                async (uri: unknown) => {
                    return this.fs.readDirectory(uri as string);
                },
            ),

            this.rpc.onRequest(
                "workspace/deleteFile",
                async (uri: unknown, options: unknown) => {
                    await this.fs.deleteFile(
                        uri as string,
                        options as { recursive?: boolean },
                    );
                },
            ),

            this.rpc.onRequest(
                "workspace/rename",
                async (oldUri: unknown, newUri: unknown) => {
                    await this.fs.rename(oldUri as string, newUri as string);
                },
            ),

            this.rpc.onRequest("workspace/getWorkspaceFolder", async () => {
                return this.workspaceRoot;
            }),
        );
    }

    /** Update the workspace root (e.g., when connecting to a new host). */
    setWorkspaceRoot(root: string): void {
        this.workspaceRoot = root;
    }

    dispose(): void {
        for (const sub of this.subscriptions) {
            sub.dispose();
        }
        this.subscriptions = [];
    }
}
