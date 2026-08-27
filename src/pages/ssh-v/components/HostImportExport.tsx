/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useState } from 'react';
import { Upload, FileDown, FileUp } from 'lucide-react';
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
import { decodeHosts, dedupeAgainst } from '@/lib/hostTransfer';
import { HostExportDialog } from './HostExportDialog';

/**
 * Import / Export controls for saved hosts. Shared by the SSH and SFTP host
 * pickers (both read the same `hosts` IndexedDB table). Export produces a
 * copy-paste Base64 string; import accepts that string (or raw JSON).
 */
export function HostImportExport({ onImported }: { onImported?: () => void }) {
    const [importOpen, setImportOpen] = useState(false);
    const [exportHosts, setExportHosts] = useState<HostsObject[] | null>(null);
    const [importText, setImportText] = useState('');
    const [busy, setBusy] = useState(false);

    const close = useCallback(() => {
        setImportOpen(false);
        setImportText('');
    }, []);

    const handleExport = useCallback(async () => {
        const hosts = (await idb.getAllItems('hosts')) as HostsObject[];
        if (!hosts || hosts.length === 0) {
            toast({ title: 'Nothing to export', description: 'You have no saved hosts yet.' });
            return;
        }
        setExportHosts(hosts);
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
                    onClick={() => setImportOpen(true)}
                    className="h-8 gap-1.5 text-xs text-gray-300 hover:text-white hover:bg-white/[0.06]"
                    title="Import hosts"
                >
                    <FileUp className="w-3.5 h-3.5" />
                    Import
                </Button>
            </div>

            <HostExportDialog hosts={exportHosts} onClose={() => setExportHosts(null)} />

            <Dialog open={importOpen} onOpenChange={(o) => (!o ? close() : null)}>
                <DialogContent className="sm:max-w-[520px] bg-[#0A0A0A] border-white/[0.08] text-gray-200">
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
                </DialogContent>
            </Dialog>
        </>
    );
}

export default HostImportExport;
