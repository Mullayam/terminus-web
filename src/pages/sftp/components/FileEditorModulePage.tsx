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
import { useMemo } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { FileEditor, ApiContentProvider } from "@/modules/editor";

export default function FileEditorModulePage() {
    const [params] = useSearchParams();
    const navigate = useNavigate();

    const sessionId = params.get("tabId") ?? "";
    const remotePath = params.get("path") ?? "";

    const provider = useMemo(() => new ApiContentProvider(), []);

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
                sessionId={sessionId}
                remotePath={remotePath}
                provider={provider}
                themeId="vs-dark"
                wordWrap
            />
        </div>
    );
}
