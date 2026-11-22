import { useState } from 'react';
import { Check, FolderOpen, LayoutTemplate, Pencil, Plus, RefreshCw, SquareTerminal, Trash2, X } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useSSHStore } from '@/store/sshStore';
import { useWorkspaceStore, type Workspace } from '@/store/workspaceStore';
import { captureWorkspace, restoreWorkspace } from '../workspaces';

function timeAgo(ts: number): string {
  const s = Math.round((Date.now() - ts) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  if (s < 86400) return `${Math.round(s / 3600)}h ago`;
  return `${Math.round(s / 86400)}d ago`;
}

/**
 * Save the open SSH tabs (+ SFTP tabs, folders, open panels) as a named
 * workspace and restore it later in one click.
 */
export function WorkspacesMenu({ variant = 'topbar' }: { variant?: 'topbar' | 'page' }) {
  const workspaces = useWorkspaceStore((s) => s.workspaces);
  const save = useWorkspaceStore((s) => s.save);
  const rename = useWorkspaceStore((s) => s.rename);
  const remove = useWorkspaceStore((s) => s.remove);
  const tabCount = useSSHStore((s) => s.tabs.length);
  const { toast } = useToast();

  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [editing, setEditing] = useState<{ id: string; name: string } | null>(null);
  const [confirmDel, setConfirmDel] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const saveCurrent = () => {
    const n = name.trim() || `Workspace ${workspaces.length + 1}`;
    const ws = captureWorkspace(n);
    if (!ws.tabs.length) return;
    save(ws);
    setName('');
    toast({ description: `Saved "${n}" with ${ws.tabs.length} tab${ws.tabs.length === 1 ? '' : 's'}.` });
  };

  const update = (w: Workspace) => {
    const ws = captureWorkspace(w.name, w.id);
    if (!ws.tabs.length) return;
    save(ws);
    toast({ description: `Updated "${w.name}" with the current ${ws.tabs.length} tab${ws.tabs.length === 1 ? '' : 's'}.` });
  };

  const openWs = async (w: Workspace) => {
    setBusy(w.id);
    const res = await restoreWorkspace(w);
    setBusy(null);
    setOpen(false);
    toast({
      title: `Opened "${w.name}"`,
      description: res.needLogin.length
        ? `${res.opened} tabs. No saved login for ${res.needLogin.join(', ')} — enter it in that tab.`
        : `${res.opened} tab${res.opened === 1 ? '' : 's'}; each connects when you open it.`,
    });
  };

  const trigger = variant === 'page' ? (
    <Button variant="ghost" className="text-sm text-gray-300 hover:text-white gap-1.5">
      <LayoutTemplate className="h-4 w-4" /> Workspaces
    </Button>
  ) : (
    <Button variant="ghost" size="icon" className="h-8 w-8" title="Workspaces">
      <LayoutTemplate className="h-4 w-4 text-gray-400" />
    </Button>
  );

  return (
    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setEditing(null); setConfirmDel(null); } }}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent align="start" className="w-[360px] p-0 bg-[#141414] border-gray-800 text-gray-200">
        <div className="px-3 pt-3 pb-2 border-b border-gray-800">
          <div className="flex items-center gap-2 mb-2">
            <LayoutTemplate className="h-4 w-4 text-sky-400" />
            <span className="text-sm font-semibold">Workspaces</span>
            <span className="text-[11px] text-gray-500">tabs, SFTP tabs, folders & panels</span>
          </div>
          <div className="flex gap-1.5">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') saveCurrent(); }}
              placeholder={tabCount ? `Name for these ${tabCount} tab${tabCount === 1 ? '' : 's'}` : 'Open some tabs first'}
              disabled={!tabCount}
              className="flex-1 min-w-0 rounded-md border border-gray-700 bg-black/40 px-2 py-1 text-xs outline-none focus:border-sky-600 disabled:opacity-50"
            />
            <Button size="sm" onClick={saveCurrent} disabled={!tabCount} className="h-7 gap-1 bg-sky-600 hover:bg-sky-700 text-white text-xs">
              <Plus className="h-3.5 w-3.5" /> Save
            </Button>
          </div>
        </div>

        <div className="max-h-[360px] overflow-y-auto p-1.5 scrollbar-green">
          {workspaces.length === 0 ? (
            <p className="text-xs text-gray-500 text-center py-6 px-4">
              No workspaces yet. Open the tabs you use together, then save them here.
            </p>
          ) : workspaces.map((w) => {
            const hosts = [...new Set(w.tabs.map((t) => t.host))];
            const files = w.tabs.filter((t) => t.filesOpen).length;
            return (
              <div key={w.id} className="group rounded-md px-2 py-1.5 hover:bg-white/5">
                {confirmDel === w.id ? (
                  <div className="flex items-center gap-2 text-xs">
                    <span className="flex-1">Delete "{w.name}"?</span>
                    <Button size="sm" className="h-6 px-2 text-xs bg-red-600 hover:bg-red-700 text-white" onClick={() => { remove(w.id); setConfirmDel(null); }}>Delete</Button>
                    <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={() => setConfirmDel(null)}>Cancel</Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <div className="min-w-0 flex-1">
                      {editing?.id === w.id ? (
                        <div className="flex items-center gap-1">
                          <input
                            autoFocus
                            value={editing.name}
                            onChange={(e) => setEditing({ id: w.id, name: e.target.value })}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && editing.name.trim()) { rename(w.id, editing.name.trim()); setEditing(null); }
                              if (e.key === 'Escape') setEditing(null);
                            }}
                            className="flex-1 min-w-0 rounded border border-gray-700 bg-black/40 px-1.5 py-0.5 text-xs outline-none"
                          />
                          <button className="p-0.5 text-green-400" onClick={() => { if (editing.name.trim()) rename(w.id, editing.name.trim()); setEditing(null); }}><Check className="h-3.5 w-3.5" /></button>
                          <button className="p-0.5 text-gray-400" onClick={() => setEditing(null)}><X className="h-3.5 w-3.5" /></button>
                        </div>
                      ) : (
                        <p className="text-xs font-medium truncate">{w.name}</p>
                      )}
                      <p className="text-[11px] text-gray-500 truncate" title={hosts.join(', ')}>
                        <SquareTerminal className="inline h-3 w-3 mr-0.5 -mt-0.5" />{w.tabs.length}
                        {files > 0 && <><FolderOpen className="inline h-3 w-3 ml-1.5 mr-0.5 -mt-0.5" />{files}</>}
                        <span className="ml-1.5">{hosts.slice(0, 3).join(', ')}{hosts.length > 3 ? ` +${hosts.length - 3}` : ''}</span>
                        <span className="ml-1.5 text-gray-600">· {timeAgo(w.updatedAt)}</span>
                      </p>
                    </div>
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button title="Update with the current tabs" disabled={!tabCount} onClick={() => update(w)} className="p-1 rounded text-gray-400 hover:text-gray-100 disabled:opacity-30"><RefreshCw className="h-3.5 w-3.5" /></button>
                      <button title="Rename" onClick={() => setEditing({ id: w.id, name: w.name })} className="p-1 rounded text-gray-400 hover:text-gray-100"><Pencil className="h-3.5 w-3.5" /></button>
                      <button title="Delete" onClick={() => setConfirmDel(w.id)} className="p-1 rounded text-gray-400 hover:text-red-400"><Trash2 className="h-3.5 w-3.5" /></button>
                    </div>
                    <Button size="sm" disabled={busy === w.id} onClick={() => void openWs(w)} className="h-6 px-2.5 text-xs bg-green-600 hover:bg-green-700 text-white">
                      Open
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <p className="px-3 py-2 border-t border-gray-800 text-[10.5px] text-gray-500">
          Passwords are never saved here. Tabs reconnect with your saved hosts; others ask for the login.
        </p>
      </PopoverContent>
    </Popover>
  );
}
