import { __config } from "./config";

const API_URL = __config.API_URL + "/api/upload";
export class ApiCore {
    static async uploadFile(file: File,path:string) {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("path", path);
     
        const response = await fetch(API_URL, {
            method: "POST",
            body: formData,
        });
        const data = await response.json();
        return data;
    }
}