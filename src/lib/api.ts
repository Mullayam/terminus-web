import { __config } from "./config";

const API_URL = __config.API_URL + "/api/upload";
export class ApiCore {

    static async uploadFile(file: File & { path?: string } | Array<File & { path?: string }>, path: string, sessionId?: string) {
        const formData = new FormData();
        if (Array.isArray(file)) {
            file.forEach((f, index) => {
                formData.append(`file[${index}]`, f);
                // Send each file's relative path so the server can
                // reconstruct nested directories (e.g. test/test2/test.sh)
                const relativePath = f.path || (f as any).webkitRelativePath || '';
                if (relativePath) {
                    formData.append(`relativePath[${index}]`, relativePath);
                }
            });
        } else {
            formData.append("file", file); // Append a single file
        }
        formData.append("path", path);
        // The server requires a session identifier to know which SFTP
        // connection to upload into ("sftpSessionId or sessionId is required").
        if (sessionId) {
            formData.append("sessionId", sessionId);
        }

        const url = new URL(API_URL);
        if (sessionId) {
            url.searchParams.set("sessionId", sessionId);
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