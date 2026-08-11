import { useEffect, useState } from 'react';
import { Server, User, Hash, Lock, KeyRound, Save, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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

type AuthMethod = 'password' | 'privateKey';

/**
 * Edit an existing saved host and persist the changes to the `hosts` IDB table.
 * Self-contained (does not touch the connect flow); parent passes the host to
 * edit and refreshes its list via `onSaved`.
 */
export function HostEditDialog({
    host,
    onClose,
    onSaved,
}: {
    host: HostsObject | null;
    onClose: () => void;
    onSaved?: () => void;
}) {
    const [localName, setLocalName] = useState('');
    const [hostAddr, setHostAddr] = useState('');
    const [port, setPort] = useState('22');
    const [username, setUsername] = useState('');
    const [authMethod, setAuthMethod] = useState<AuthMethod>('password');
    const [password, setPassword] = useState('');
    const [privateKeyText, setPrivateKeyText] = useState('');
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        if (!host) return;
        setLocalName(host.localName || '');
        setHostAddr(host.host || '');
        setPort(String(host.port ?? 22));
        setUsername(host.username || '');
        setAuthMethod(host.authMethod === 'privateKey' ? 'privateKey' : 'password');
        setPassword(host.password || '');
        setPrivateKeyText(host.privateKeyText || '');
    }, [host]);

    const handleSave = async () => {
        if (!host) return;
        if (!hostAddr.trim() || !username.trim()) {
            toast({ title: 'Missing fields', description: 'Host and username are required.', variant: 'destructive' });
            return;
        }
        setBusy(true);
        try {
            await idb.updateItem('hosts', host.id, {
                localName: localName.trim(),
                host: hostAddr.trim(),
                port: Number(port) || 22,
                username: username.trim(),
                authMethod,
                password: authMethod === 'password' ? password : '',
                privateKeyText: authMethod === 'privateKey' ? privateKeyText : '',
            } as HostsObject);
            toast({ title: 'Saved', description: 'Host updated.' });
            onSaved?.();
            onClose();
        } catch {
            toast({ title: 'Update failed', description: 'Could not save changes.', variant: 'destructive' });
        } finally {
            setBusy(false);
        }
    };

    return (
        <Dialog open={host !== null} onOpenChange={(o) => (!o ? onClose() : null)}>
            <DialogContent className="sm:max-w-[480px] bg-[#0A0A0A] border-white/[0.08] text-gray-200">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-gray-100">
                        <Save className="w-4 h-4 text-emerald-400" />
                        Edit Host
                    </DialogTitle>
                    <DialogDescription className="text-gray-500">
                        Update the saved connection details.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-3">
                    <div className="space-y-1.5">
                        <label className="text-xs text-gray-400">Connection Name</label>
                        <Input
                            value={localName}
                            onChange={(e) => setLocalName(e.target.value)}
                            placeholder="My Ubuntu Server"
                            className="bg-white/[0.03] border-white/[0.08] focus:border-emerald-500/50 text-gray-200 placeholder:text-gray-600"
                        />
                    </div>

                    <div className="grid grid-cols-[1fr_110px] gap-2">
                        <div className="space-y-1.5">
                            <label className="text-xs text-gray-400 flex items-center gap-1.5">
                                <Server size={12} /> Host
                            </label>
                            <Input
                                value={hostAddr}
                                onChange={(e) => setHostAddr(e.target.value)}
                                placeholder="192.168.1.10 or example.com"
                                className="bg-white/[0.03] border-white/[0.08] focus:border-emerald-500/50 text-gray-200 placeholder:text-gray-600"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-xs text-gray-400 flex items-center gap-1.5">
                                <Hash size={12} /> Port
                            </label>
                            <Input
                                type="number"
                                value={port}
                                onChange={(e) => setPort(e.target.value)}
                                placeholder="22"
                                className="bg-white/[0.03] border-white/[0.08] focus:border-emerald-500/50 text-gray-200 placeholder:text-gray-600"
                            />
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-xs text-gray-400 flex items-center gap-1.5">
                            <User size={12} /> Username
                        </label>
                        <Input
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            placeholder="root, ubuntu, ec2-user..."
                            className="bg-white/[0.03] border-white/[0.08] focus:border-emerald-500/50 text-gray-200 placeholder:text-gray-600"
                        />
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-xs text-gray-400">Authentication</label>
                        <div className="flex gap-2 pt-1">
                            <button
                                type="button"
                                onClick={() => setAuthMethod('password')}
                                className={`flex-1 flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-all ${authMethod === 'password'
                                    ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400'
                                    : 'border-white/[0.08] bg-white/[0.02] text-gray-400 hover:border-white/[0.15]'
                                    }`}
                            >
                                <Lock size={14} /> Password
                            </button>
                            <button
                                type="button"
                                onClick={() => setAuthMethod('privateKey')}
                                className={`flex-1 flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-all ${authMethod === 'privateKey'
                                    ? 'border-amber-500/40 bg-amber-500/10 text-amber-400'
                                    : 'border-white/[0.08] bg-white/[0.02] text-gray-400 hover:border-white/[0.15]'
                                    }`}
                            >
                                <KeyRound size={14} /> Private Key
                            </button>
                        </div>
                    </div>

                    {authMethod === 'password' ? (
                        <div className="space-y-1.5">
                            <label className="text-xs text-gray-400">Password</label>
                            <Input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="••••••••"
                                className="bg-white/[0.03] border-white/[0.08] focus:border-emerald-500/50 text-gray-200 placeholder:text-gray-600"
                            />
                        </div>
                    ) : (
                        <div className="space-y-1.5">
                            <label className="text-xs text-gray-400">Private Key</label>
                            <Textarea
                                value={privateKeyText}
                                onChange={(e) => setPrivateKeyText(e.target.value)}
                                placeholder="-----BEGIN OPENSSH PRIVATE KEY-----"
                                className="h-28 font-mono text-[11px] bg-white/[0.03] border-white/[0.08] focus:border-emerald-500/50 text-gray-200 placeholder:text-gray-600 resize-none"
                            />
                        </div>
                    )}
                </div>

                <DialogFooter className="gap-2 sm:gap-2">
                    <Button
                        variant="outline"
                        onClick={onClose}
                        disabled={busy}
                        className="border-white/[0.1] bg-white/[0.02] hover:bg-white/[0.06] text-gray-300"
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={handleSave}
                        disabled={busy}
                        className="gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-50"
                    >
                        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        Save Changes
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
