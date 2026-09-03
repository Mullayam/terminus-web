import { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, Copy, Download, ShieldAlert } from 'lucide-react';
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
import { HostsObject } from '@/pages';
import { encodeHosts, encodeHostsJson } from '@/lib/hostTransfer';

/**
 * Export dialog for one or many hosts. Shared by the bulk Export button and the
 * per-host export action on a host card.
 */
export function HostExportDialog({
    hosts,
    onClose,
    filename,
}: {
    /** `null` keeps the dialog closed. */
    hosts: HostsObject[] | null;
    onClose: () => void;
    filename?: string;
}) {
    const [copied, setCopied] = useState(false);
    // The `hosts` array is a fresh reference on every parent render and
    // encodeHosts() embeds a live timestamp, so memoizing on `hosts` produces a
    // new string each render — which would re-fire the auto-copy effect (and its
    // toast) in a loop. Key the memo on the host ids instead so `encoded` is
    // stable while the dialog stays open.
    const hostKey = hosts ? hosts.map((h) => h.id).join('|') : '';
    // eslint-disable-next-line react-hooks/exhaustive-deps
    const encoded = useMemo(() => (hosts ? encodeHosts(hosts) : ''), [hostKey]);

    // Copy as soon as the dialog opens so a single click is usually enough.
    useEffect(() => {
        if (!encoded) return;
        const count = hosts?.length ?? 0;
        setCopied(false);
        navigator.clipboard
            .writeText(encoded)
            .then(() => {
                setCopied(true);
                toast({ title: 'Exported', description: `${count} host(s) copied to clipboard.` });
            })
            .catch(() => {
                /* clipboard may be blocked; user can copy manually from the dialog */
            });
    }, [encoded]);

    const handleCopy = useCallback(async () => {
        try {
            await navigator.clipboard.writeText(encoded);
            setCopied(true);
            toast({ title: 'Copied', description: 'Export string copied to clipboard.' });
        } catch {
            toast({ title: 'Copy failed', description: 'Select the text and copy manually.', variant: 'destructive' });
        }
    }, [encoded]);

    const handleDownload = useCallback(() => {
        if (!hosts) return;
        const blob = new Blob([encodeHostsJson(hosts)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${filename ?? `terminus-hosts-${new Date().toISOString().slice(0, 10)}`}.json`;
        a.click();
        URL.revokeObjectURL(url);
    }, [hosts, filename]);

    return (
        <Dialog open={hosts !== null} onOpenChange={(o) => (!o ? onClose() : null)}>
            <DialogContent className="sm:max-w-[520px] bg-[#0A0A0A] border-white/[0.08] text-gray-200">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-gray-100">
                        <Download className="w-4 h-4 text-emerald-400" />
                        Export {hosts?.length === 1 ? 'Host' : 'Hosts'}
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
                    value={encoded}
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
            </DialogContent>
        </Dialog>
    );
}

export default HostExportDialog;
