import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { getOrCreateSocket } from "@/store/sftpStore";
import { FileEditor } from "./FileEditor";
import { Loader2 } from "lucide-react";
import type { Socket } from "socket.io-client";

/**
 * Standalone full-screen file editor page.
 * URL: /ssh/sftp/edit?path=/some/file.txt&tabId=abc123
 *
 * Reuses the existing persistent socket for the given tabId.
 */
export default function FileEditorPage() {
    const [params] = useSearchParams();
    const filePath = params.get("path") ?? "";
    const tabId = params.get("tabId") ?? "";
    const fileName = filePath.split("/").pop() ?? "untitled";

    const [socket, setSocket] = useState<Socket | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!tabId) {
            setError("Missing tabId in URL");
            return;
        }
        if (!filePath) {
            setError("Missing file path in URL");
            return;
        }

        try {
            const sock = getOrCreateSocket(tabId);
            setSocket(sock);
        } catch (e) {
            setError("Failed to connect to session");
        }
    }, [tabId, filePath]);

    // Update document title
    useEffect(() => {
        document.title = `${fileName} — Terminus Editor`;
        return () => { document.title = "Terminus"; };
    }, [fileName]);

    if (error) {
        return (
            <div className="flex items-center justify-center h-screen bg-[#0d0e14]">
                <div className="text-center space-y-2">
                    <p className="text-red-400 text-sm">{error}</p>
                    <p className="text-gray-600 text-xs">Check the URL parameters and try again.</p>
                </div>
            </div>
        );
    }

    if (!socket) {
        return (
            <div className="flex items-center justify-center h-screen bg-[#0d0e14]">
                <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
            </div>
        );
    }

    return (
        <div className="h-screen w-screen bg-[#0d0e14] overflow-hidden">
            <FileEditor
                filePath={filePath}
                fileName={fileName}
                socket={socket}
                fullScreen
            />
        </div>
    );
}
