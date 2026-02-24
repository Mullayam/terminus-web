/**
 * @module editor/components/FileIcon
 * Tiny file-type icon based on extension. Uses Lucide icons.
 */
import { memo } from "react";
import {
    FileCode, FileText, FileJson, FileType, FileCog, File,
    FileImage, FileArchive, FileSpreadsheet,
} from "lucide-react";

const EXT_MAP: Record<string, React.FC<{ className?: string; style?: React.CSSProperties }>> = {
    ts: FileCode, tsx: FileCode, js: FileCode, jsx: FileCode,
    py: FileCode, rb: FileCode, go: FileCode, rs: FileCode,
    java: FileCode, kt: FileCode, swift: FileCode, c: FileCode,
    cpp: FileCode, h: FileCode, cs: FileCode, php: FileCode,
    json: FileJson, jsonc: FileJson,
    md: FileText, txt: FileText, log: FileText, csv: FileSpreadsheet,
    yaml: FileCog, yml: FileCog, toml: FileCog, ini: FileCog, env: FileCog,
    dockerfile: FileCog,
    html: FileType, htm: FileType, xml: FileType, svg: FileType,
    css: FileType, scss: FileType, less: FileType,
    png: FileImage, jpg: FileImage, jpeg: FileImage, gif: FileImage, webp: FileImage,
    zip: FileArchive, tar: FileArchive, gz: FileArchive,
};

export const FileIcon = memo(function FileIcon(props: { fileName: string; className?: string }) {
    const ext = props.fileName.split(".").pop()?.toLowerCase() ?? "";
    const name = props.fileName.toLowerCase();
    const Icon = (name.startsWith("dockerfile") ? FileCog : EXT_MAP[ext]) ?? File;

    return <Icon className={props.className ?? "w-4 h-4 shrink-0"} style={{ color: "var(--editor-accent)" }} />;
});
