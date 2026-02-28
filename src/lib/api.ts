import { __config } from "./config";

const API_URL = __config.API_URL + "/api/upload";
export class ApiCore {

    static async uploadFile(file: File & { path?: string } | Array<File & { path?: string }>, path: string) {
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

        const response = await fetch(API_URL, {
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