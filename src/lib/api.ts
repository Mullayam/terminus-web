import { __config } from "./config";
import { extractPath } from "./utils";

const API_URL = __config.API_URL + "/api/upload";
export class ApiCore {

    static async uploadFile(file: File & { path?: string } | Array<File & { path?: string }>, path: string) {
        let dir = path
        const formData = new FormData();
        if (Array.isArray(file)) {
            file.forEach((f, index) => {
                formData.append(`file[${index}]`, f);
                dir = extractPath(path + f.path)
            });
        } else {
            formData.append("file", file); // Append a single file
        }
        formData.append("path", dir);

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
        name
    }: {
        remotePath: string,
        type: string
        name: string
    }) {
        const response = await fetch(__config.API_URL + "/api/download", {
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