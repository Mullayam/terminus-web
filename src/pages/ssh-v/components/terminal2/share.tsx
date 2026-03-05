
import { Button } from "@/components/ui/button";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Globe, Copy, Check, ShieldBan, UserX, Eye, Pencil } from 'lucide-react';

import { CollabClientEvent } from "@/modules/collab-terminal/types/events";
import { useState } from "react";
import { useSSHStore } from "@/store/sshStore";
import { useTerminalStore } from '@/store/terminalStore';
import { toast } from "@/hooks/use-toast";

type SocketPermission = '400' | '700';

const PERMISSION_LABELS: Record<string, { label: string; description: string; color: string }> = {
    '400': { label: 'Read-only', description: 'Can see output, cannot type', color: 'text-yellow-400' },
    '700': { label: 'Write', description: 'Can type, subject to auto-lock', color: 'text-green-400' },
    '777': { label: 'Admin', description: 'Full access, immune to all locks', color: 'text-blue-400' },
};

const TerminalShare = () => {
    const { sessions, activeTabId } = useSSHStore()
    const { sessionInfo, addPermissions, deleteSharedSession, deletePermission } = useTerminalStore()
    const [isCopied, setIsCopied] = useState(false)
    const [selectedSocketId, setSelectedSocketId] = useState<string | null>(null)
    const info = sessionInfo?.shared_sessions[activeTabId!]
    const socket = sessions[activeTabId!].socket

    const handleCreateShareTerminalClick = () => {
        handleCopySessionLink();
        toast({
            title: "Shared Terminal URL Copied",
            description: "Paste URL in browser tab",
        })
    }

    /** Set collaborator to read-only "400" */
    const handleSetReadOnly = (socketId: string) => {
        socket?.emit(CollabClientEvent.CHANGE_PERMISSION, {
            sessionId: activeTabId!,
            targetSocketId: socketId,
            permission: '400',
        });
        addPermissions(activeTabId!, socketId, '400');
        toast({ title: "User set to read-only (400)" });
    }

    /** Kick user — they CAN rejoin */
    const handleKick = (socketId: string) => {
        socket?.emit(CollabClientEvent.KICK_USER, {
            sessionId: activeTabId!,
            targetSocketId: socketId,
            message: 'Removed by admin.',
        });
        deleteSharedSession(activeTabId!, socketId);
        deletePermission(activeTabId!, socketId);
        if (selectedSocketId === socketId) setSelectedSocketId(null);
        toast({ title: "User kicked (can rejoin)" });
    }

    /** Block user — IP banned, CANNOT rejoin this session */
    const handleBlock = (socketId: string) => {
        socket?.emit(CollabClientEvent.BLOCK_USER, {
            sessionId: activeTabId!,
            targetSocketId: socketId,
            message: 'Blocked by admin.',
        });
        deleteSharedSession(activeTabId!, socketId);
        deletePermission(activeTabId!, socketId);
        if (selectedSocketId === socketId) setSelectedSocketId(null);
        toast({ title: "User blocked (cannot rejoin)", variant: "destructive" });
    }

    const handleCopySessionLink = () => {
        const link = `${window.location.origin}/collab/terminal/${activeTabId}`;
        navigator.clipboard.writeText(link);
        setIsCopied(true);
        const timer = setTimeout(() => {
            setIsCopied(false);
        }, 2000);
        return () => clearTimeout(timer);
    };

    const getUserPermission = (socketId: string): string => {
        return info?.permissions?.[socketId] || '400';
    };

    const updateSessionPermission = (socketId: string, permissions: SocketPermission) => {
        socket?.emit(CollabClientEvent.CHANGE_PERMISSION, {
            sessionId: activeTabId!,
            targetSocketId: socketId,
            permission: permissions,
        });
        addPermissions(activeTabId!, socketId, permissions);
        const label = PERMISSION_LABELS[permissions]?.label || permissions;
        toast({ title: `Permission updated to ${permissions} — ${label}` });
    }

    return (
        <div className="p-4">
            <div className="flex flex-col w-full gap-3">
                {info?.socketIds.length > 0 ? (
                    <div className="flex flex-col gap-3">
                        <h3 className="text-lg font-semibold text-gray-300">
                            Terminal Sharing
                            <span className="ml-2 text-sm font-normal text-gray-500">
                                {info.socketIds.length} {info.socketIds.length === 1 ? 'user' : 'users'}
                            </span>
                        </h3>

                        {info.socketIds.map((session) => {
                            const perm = getUserPermission(session);
                            const permInfo = PERMISSION_LABELS[perm] || PERMISSION_LABELS['400'];
                            const isSelected = selectedSocketId === session;

                            return (
                                <div
                                    onClick={() => setSelectedSocketId(isSelected ? null : session)}
                                    key={session}
                                    className={`rounded-lg p-3 border transition-colors cursor-pointer ${
                                        isSelected
                                            ? 'border-blue-500 bg-slate-800/50'
                                            : 'border-gray-700 hover:border-gray-500 bg-transparent'
                                    }`}
                                >
                                    <div className="flex items-center justify-between mb-2">
                                        <code className="text-xs text-gray-400 font-mono truncate flex-1 mr-2">
                                            {session}
                                        </code>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleCopySessionLink();
                                            }}
                                            className={`p-1 rounded transition-colors ${isCopied
                                                ? 'bg-green-900/40 text-green-400'
                                                : 'bg-gray-700 hover:bg-gray-600 text-gray-400'
                                            }`}
                                        >
                                            {isCopied ? <Check size={12} /> : <Copy size={12} />}
                                        </button>
                                    </div>

                                    {/* Permission badge */}
                                    <div className="flex items-center gap-1.5 mb-2">
                                        {perm === '400' ? <Eye size={12} className="text-yellow-400" /> : <Pencil size={12} className="text-green-400" />}
                                        <span className={`text-xs font-medium ${permInfo.color}`}>
                                            {perm} — {permInfo.label}
                                        </span>
                                        <span className="text-[10px] text-gray-500">
                                            ({permInfo.description})
                                        </span>
                                    </div>

                                    {/* Action buttons */}
                                    <div className="flex space-x-2">
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleSetReadOnly(session);
                                            }}
                                            title="Set to read-only (400)"
                                            className="flex-1 bg-yellow-900/30 hover:bg-yellow-900/50 text-yellow-400 py-1 px-2 rounded text-xs font-medium transition-colors"
                                        >
                                            Read-only
                                        </button>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleKick(session);
                                            }}
                                            title="Kick user — they can rejoin"
                                            className="flex-1 bg-orange-900/30 hover:bg-orange-900/50 text-orange-400 py-1 px-2 rounded text-xs font-medium transition-colors flex items-center justify-center gap-1"
                                        >
                                            <UserX size={11} />
                                            Kick
                                        </button>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleBlock(session);
                                            }}
                                            title="Block user — IP banned, cannot rejoin"
                                            className="flex-1 bg-red-900/30 hover:bg-red-900/50 text-red-400 py-1 px-2 rounded text-xs font-medium transition-colors flex items-center justify-center gap-1"
                                        >
                                            <ShieldBan size={11} />
                                            Block
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <div className="text-center py-8 w-full rounded-lg border border-gray-700">
                        <Globe size={32} className="mx-auto text-gray-300 mb-2" />
                        <h4 className="text-sm font-medium text-gray-300 mb-1">No sessions</h4>
                        <p className="text-xs text-gray-500 mb-3">Create your first session</p>
                        <Button
                            variant={"outline"}
                            onClick={handleCreateShareTerminalClick}
                            className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
                        >
                            Create Session
                        </Button>
                    </div>
                )}
            </div>

            {/* Permission control for selected user */}
            {selectedSocketId && info?.socketIds.includes(selectedSocketId) && (
                <div className="mt-4 p-3 rounded-lg border border-gray-700 bg-slate-800/30 space-y-3">
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium text-slate-300">
                            Change permission:
                        </label>
                        <p className="text-[10px] text-gray-500">
                            Cannot promote to 777 (Admin). Cannot change own permission.
                        </p>
                        <Select
                            value={getUserPermission(selectedSocketId)}
                            onValueChange={(value) => updateSessionPermission(selectedSocketId, value as SocketPermission)}
                        >
                            <SelectTrigger className="w-full bg-slate-800 text-gray-200 border-slate-700">
                                <SelectValue placeholder="Select permission" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="400">
                                    <span className="flex items-center gap-2">
                                        <Eye size={12} className="text-yellow-400" />
                                        400 — Read-only
                                    </span>
                                </SelectItem>
                                <SelectItem value="700">
                                    <span className="flex items-center gap-2">
                                        <Pencil size={12} className="text-green-400" />
                                        700 — Write
                                    </span>
                                </SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TerminalShare;
