/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useState } from 'react';
import { Copy, Download, Upload, FileDown, FileUp, ShieldAlert, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { toast } from '@/hooks/use-toast';
import { idb } from '@/lib/idb';
import { HostsObject } from '@/pages';
import { decodeHosts, dedupeAgainst, encodeHosts, encodeHostsJson } from '@/lib/hostTransfer';

type Mode = 'export' | 'import' | null;

/**
 * Import / Export controls for saved hosts. Shared by the SSH and SFTP host
 * pickers (both read the same `hosts` IndexedDB table). Export produces a
 * copy-paste Base64 string; import accepts that string (or raw JSON).
 */
export function HostImportExport({ onImported }: { onImported?: () => void }) {
    const [mode, setMode] = useState<Mode>(null);
    const [exportText, setExportText] = useState('');
    const [importText, setImportText] = useState('');
    const [copied, setCopied] = useState(false);
    const [busy, setBusy] = useState(false);

    const close = useCallback(() => {
        setMode(null);
        setImportText('');
        setCopied(false);
    }, []);

    const handleExport = useCallback(async () => {
        const hosts = (await idb.getAllItems('hosts')) as HostsObject[];
        if (!hosts || hosts.length === 0) {
            toast({ title: 'Nothing to export', description: 'You have no saved hosts yet.' });
            return;
        }
        const encoded = encodeHosts(hosts);
        setExportText(encoded);
        setMode('export');
        setCopied(false);
        try {
            await navigator.clipboard.writeText(encoded);
            setCopied(true);
            toast({ title: 'Exported', description: `${hosts.length} host(s) copied to clipboard.` });
        } catch {
            /* clipboard may be blocked; user can copy manually from the dialog */
        }
    }, []);

    const handleCopy = useCallback(async () => {
        try {
            await navigator.clipboard.writeText(exportText);
            setCopied(true);
            toast({ title: 'Copied', description: 'Export string copied to clipboard.' });
        } catch {
            toast({ title: 'Copy failed', description: 'Select the text and copy manually.', variant: 'destructive' });
        }
    }, [exportText]);

    const handleDownload = useCallback(async () => {
        const hosts = (await idb.getAllItems('hosts')) as HostsObject[];
        const blob = new Blob([encodeHostsJson(hosts)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `terminus-hosts-${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
    }, []);

    const handleImport = useCallback(async () => {
        setBusy(true);
        try {
            const incoming = decodeHosts(importText);
            const existing = (await idb.getAllItems('hosts')) as HostsObject[];
            const { toAdd, skipped } = dedupeAgainst(incoming, existing || []);
            if (toAdd.length > 0) {
                await idb.bulkAddItems('hosts', toAdd);
            }
            toast({
                title: 'Import complete',
                description:
                    `${toAdd.length} host(s) added` +
                    (skipped > 0 ? `, ${skipped} duplicate(s) skipped.` : '.'),
            });
            onImported?.();
            close();
        } catch (err: any) {
            toast({
                title: 'Import failed',
                description: err?.message || 'Could not read the import data.',
                variant: 'destructive',
            });
        } finally {
            setBusy(false);
        }
    }, [importText, onImported, close]);

    const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => setImportText(String(reader.result || ''));
        reader.readAsText(file);
        e.target.value = '';
    }, []);

    return (
        <>
            <div className="flex items-center gap-1.5">
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleExport}
                    className="h-8 gap-1.5 text-xs text-gray-300 hover:text-white hover:bg-white/[0.06]"
                    title="Export saved hosts"
                >
                    <FileDown className="w-3.5 h-3.5" />
                    Export
                </Button>
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setMode('import')}
                    className="h-8 gap-1.5 text-xs text-gray-300 hover:text-white hover:bg-white/[0.06]"
                    title="Import hosts"
                >
                    <FileUp className="w-3.5 h-3.5" />
                    Import
                </Button>
            </div>

            <Dialog open={mode !== null} onOpenChange={(o) => (!o ? close() : null)}>
                <DialogContent className="sm:max-w-[520px] bg-[#0A0A0A] border-white/[0.08] text-gray-200">
                    {mode === 'export' ? (
                        <>
                            <DialogHeader>
                                <DialogTitle className="flex items-center gap-2 text-gray-100">
                                    <Download className="w-4 h-4 text-emerald-400" />
                                    Export Hosts
                                </DialogTitle>
                                <DialogDescription className="text-gray-500">
                                    Copy this string and paste it into Import on another device.
                                </DialogDescription>
                            </DialogHeader>

                            <div className="flex items-start gap-2 rounded-lg border border-amber-500/20 bg-amber-500/10 p-2.5 text-xs text-amber-300">
                                <ShieldAlert className="w-4 h-4 mt-0.5 shrink-0" />
                                <span>
                                    This contains your passwords / private keys as encoded (not encrypted) text.
                                    Keep it private and share only over trusted channels.
                                </span>
                            </div>

                            <Textarea
                                readOnly
                                value={exportText}
                                onFocus={(e) => e.currentTarget.select()}
                                className="h-40 font-mono text-[11px] bg-white/[0.03] border-white/[0.08] text-gray-300 resize-none break-all"
                            />

                            <DialogFooter className="gap-2 sm:gap-2">
                                <Button
                                    variant="outline"
                                    onClick={handleDownload}
                                    className="gap-1.5 border-white/[0.1] bg-white/[0.02] hover:bg-white/[0.06] text-gray-300"
                                >
                                    <Download className="w-4 h-4" />
                                    Download .json
                                </Button>
                                <Button onClick={handleCopy} className="gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white">
                                    {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                                    {copied ? 'Copied' : 'Copy'}
                                </Button>
                            </DialogFooter>
                        </>
                    ) : (
                        <>
                            <DialogHeader>
                                <DialogTitle className="flex items-center gap-2 text-gray-100">
                                    <Upload className="w-4 h-4 text-emerald-400" />
                                    Import Hosts
                                </DialogTitle>
                                <DialogDescription className="text-gray-500">
                                    Paste an export string (or JSON), or upload a .json file. Duplicates are skipped.
                                </DialogDescription>
                            </DialogHeader>

                            <Textarea
                                autoFocus
                                value={importText}
                                onChange={(e) => setImportText(e.target.value)}
                                placeholder="Paste exported hosts string here..."
                                className="h-40 font-mono text-[11px] bg-white/[0.03] border-white/[0.08] text-gray-300 resize-none break-all"
                            />

                            <DialogFooter className="gap-2 sm:gap-2">
                                <label className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md cursor-pointer border border-white/[0.1] bg-white/[0.02] hover:bg-white/[0.06] text-sm text-gray-300">
                                    <Upload className="w-4 h-4" />
                                    Upload file
                                    <input type="file" accept=".json,.txt,application/json" onChange={handleFileUpload} className="hidden" />
                                </label>
                                <Button
                                    onClick={handleImport}
                                    disabled={busy || !importText.trim()}
                                    className="gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-50"
                                >
                                    <FileUp className="w-4 h-4" />
                                    Import
                                </Button>
                            </DialogFooter>
                        </>
                    )}
                </DialogContent>
            </Dialog>
        </>
    );
}

export default HostImportExport;
