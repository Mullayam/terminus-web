/**
 * @module pages/sftp/components/FileEditorModulePage
 *
 * Thin page wrapper that reads URL search params and mounts the
 * modular <FileEditor> component from `@/modules/editor`.
 *
 * Route: /ssh/sftp/editor?sessionId=xxx&path=/remote/path
 *
 * This does NOT replace the existing FileEditorApiPage at /ssh/sftp/edit.
 */
import { useMemo, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { BaseContentProvider, FileEditor, createAllBuiltinPlugins } from "@/modules/editor";
import { createAllMockPlugins } from "@/modules/editor/plugins/mock";
import { ApiCore } from "@/lib/api";
import { __config } from "@/lib/config";
import { getIconForFile } from "vscode-icons-js";

const ICON_CDN = "https://raw.githubusercontent.com/vscode-icons/vscode-icons/master/icons";

// ═══════════════════════════════════════════════════════════════
//  API Content Provider  (REST)
// ═══════════════════════════════════════════════════════════════

export class ApiContentProvider extends BaseContentProvider {
    async fetchContent(
        sessionId: string,
        filePath: string,
    ): Promise<{ content: string; error?: string }> {
        try {
            const data = await ApiCore.fetchFileContent(sessionId, filePath);
            if (!data.status) {
                return { content: "", error: data.message || "Failed to load file content" };
            }
            return { content: data.result };
        } catch (e: unknown) {
            return {
                content: "",
                error: e instanceof Error ? e.message : "Network error while fetching file",
            };
        }
    }

    async saveContent(
        sessionId: string,
        filePath: string,
        content: string,
    ): Promise<{ success: boolean; error?: string }> {
        try {
            await ApiCore.saveFileContent(sessionId, filePath, content);
            return { success: true };
        } catch (e: unknown) {
            return {
                success: false,
                error: e instanceof Error ? e.message : "Network error while saving file",
            };
        }
    }
}
export default function FileEditorModulePage() {
    const [params] = useSearchParams();
    const navigate = useNavigate();

    const sessionId = params.get("tabId") ?? "";
    const remotePath = params.get("path") ?? "";
    const fileName = remotePath.split("/").pop() || "Untitled";

    useEffect(() => {
        document.title = `${fileName} — Terminus Editor`;

        // Set favicon to the file-type icon
        const iconFile = getIconForFile(fileName);
        const iconUrl = iconFile
            ? `${ICON_CDN}/${iconFile}`
            : `${ICON_CDN}/default_file.svg`;

        let link = document.querySelector<HTMLLinkElement>("link[rel~='icon']");
        const previousHref = link?.href;
        if (!link) {
            link = document.createElement("link");
            link.rel = "icon";
            document.head.appendChild(link);
        }
        link.href = iconUrl;

        return () => {
            document.title = "Terminus";
            if (link && previousHref) link.href = previousHref;
        };
    }, [fileName]);

    // Extract the directory from the remote file path (strip the filename)
    const terminalCwd = useMemo(() => {
        if (!remotePath) return "/";
        const dir = remotePath.replace(/\/[^/]*$/, "");
        return dir || "/";
    }, [remotePath]);

    const provider = useMemo(() => new ApiContentProvider(), []);
    
    // Memoize plugins so they are created once and not re-created on every render
    const plugins = useMemo(() => [...createAllMockPlugins(), ...createAllBuiltinPlugins()], []);

    if (!sessionId || !remotePath) {
        return (
            <div className="flex items-center justify-center h-screen bg-[#282a36] text-[#f8f8f2]">
                <div className="text-center space-y-3">
                    <h2 className="text-lg font-semibold">Missing Parameters</h2>
                    <p className="text-sm text-[#6272a4]">
                        Both <code className="px-1 py-0.5 rounded bg-[#44475a]">tabId</code> and{" "}
                        <code className="px-1 py-0.5 rounded bg-[#44475a]">path</code> URL parameters are required.
                    </p>
                    <button
                        onClick={() => navigate(-1)}
                        className="px-4 py-1.5 rounded text-sm bg-[#6272a4] text-white border-none cursor-pointer"
                    >
                        Go Back
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="editor-page-wrapper">
            <FileEditor
                plugins={plugins}
                sessionId={sessionId}
                remotePath={remotePath}
                provider={provider}
                themeId="vs-dark"
                wordWrap
                terminalSocketUrl={`${__config.API_URL}/dedicated-terminal`}
                terminalCwd={terminalCwd}
            />
        </div>
    );
}
