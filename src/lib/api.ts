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
}