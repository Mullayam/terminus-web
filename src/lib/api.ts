import { __config } from "./config";

const API_URL = __config.API_URL + "/api/upload";
export class ApiCore {

    /**
     * Upload to the SFTP session behind `sftpSessionId` (must match the /sftp
     * socket handshake id so progress routes back to that panel).
     *  - single File / archive (.zip/.tar.gz/.tgz/.gz) → `file`
     *  - folder / multi-file (array)                    → `files` + `paths`
     * `name` doubles as the cancel key (@@CANCEL_UPLOADING).
     */
    static async uploadFile(
        file: (File & { path?: string }) | Array<File & { path?: string }>,
        path: string,
        sftpSessionId?: string,
        name?: string,
    ) {
        const formData = new FormData();
        // Unwrap a single, non-nested item so the server treats it as `file`
        // (single-file streaming + archive extraction). Real folders or
        // multi-selections use files[] with a matching JSON `paths` array.
        const arr = Array.isArray(file) ? file : null;
        const singleNonNested =
            !!arr &&
            arr.length === 1 &&
            !(arr[0].path || (arr[0] as any).webkitRelativePath || "").includes("/");
        const single = !arr ? file : singleNonNested ? arr[0] : null;

        if (single) {
            formData.append("file", single); // single file or archive
        } else {
            // Folder upload: files[] plus a JSON array of relative paths (same order)
            const paths: string[] = [];
            arr!.forEach((f) => {
                formData.append("files", f);
                paths.push(f.path || (f as any).webkitRelativePath || f.name);
            });
            formData.append("paths", JSON.stringify(paths));
        }
        formData.append("path", path);

        const label = name || (single ? single.name : `${arr?.length ?? 0} items`);
        if (label) formData.append("name", label);

        if (sftpSessionId) formData.append("sftpSessionId", sftpSessionId);

        const url = new URL(API_URL);
        if (sftpSessionId) {
            url.searchParams.set("sftpSessionId", sftpSessionId);
        }

        const response = await fetch(url.toString(), {
            method: "POST",
            body: formData,
        });
        const data = await response.json();
        return data;
    }
    static async download({
        remotePath,
        type,
        name,
        sessionId
    }: {
        remotePath: string,
        type: string
        name: string
        sessionId?: string
    }) {
        const url = new URL(__config.API_URL + "/api/download");
        if (sessionId) {
            url.searchParams.set("sessionId", sessionId);
        }
        const response = await fetch(url.toString(), {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                remotePath,
                type,
                name
            })
        });


        return response;
    }

    /**
     * Extract the download filename from a response's `Content-Disposition`
     * header, falling back to the provided name when the header is missing
     * or not exposed to JavaScript (e.g. cross-origin without
     * `Access-Control-Expose-Headers: Content-Disposition`).
     */
    static getFilenameFromResponse(response: Response, fallback: string): string {
        const cd = response.headers.get("content-disposition") || "";
        // Prefer RFC 5987 `filename*=UTF-8''...` then plain `filename="..."`.
        const utf8Match = cd.match(/filename\*=(?:UTF-8'')?["']?([^"';]+)["']?/i);
        const plainMatch = cd.match(/filename=["']?([^"';]+)["']?/i);
        const raw = (utf8Match?.[1] ?? plainMatch?.[1])?.trim();
        if (raw) {
            try {
                return decodeURIComponent(raw);
            } catch {
                return raw;
            }
        }
        return fallback;
    }

    /**
     * Save a Blob to disk by triggering a temporary anchor download.
     */
    static triggerBlobDownload(blob: Blob, filename: string): void {
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.setAttribute("download", filename);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }

    /**
     * Download a remote file/directory and save it to disk, honoring the
     * server's `Content-Disposition` filename when available and falling
     * back to `name` (with a `.zip` extension for directories).
     */
    static async downloadToDisk(opts: {
        remotePath: string;
        type: string;
        name: string;
        sessionId?: string;
    }): Promise<void> {
        const response = await ApiCore.download(opts);
        if (!response.ok) {
            throw new Error("Failed to download");
        }
        const blob = await response.blob();
        const fallback = opts.type === "dir" ? `${opts.name}.zip` : opts.name;
        const filename = ApiCore.getFilenameFromResponse(response, fallback);
        ApiCore.triggerBlobDownload(blob, filename);
    }

    /**
     * Fetch the content of a remote file via REST API.
     */
    static async fetchFileContent(sessionId: string, remotePath: string): Promise<{status:boolean,message:string, result: string }> {
        const response = await fetch(__config.API_URL + "/api/file/read", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sessionId, path: remotePath }),
        });
        if (!response.ok) {
            const err = await response.json().catch(() => ({ message: response.statusText }));
            throw new Error(err.message ?? "Failed to fetch file content");
        }
        return response.json();
    }

    /**
     * Save / update the content of a remote file via REST API.
     */
    static async saveFileContent(sessionId: string, remotePath: string, content: string): Promise<{ status: boolean,message:string, result: string  }> {
        const response = await fetch(__config.API_URL + "/api/file/write", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sessionId, path: remotePath, content }),
        });
        if (!response.ok) {
            const err = await response.json().catch(() => ({ message: response.statusText }));
            throw new Error(err.message ?? "Failed to save file");
        }
        return response.json();
    }
}