import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Copy, Share2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { SocketEventConstants } from "@/lib/sockets/event-constants";
import { useEffect } from "react";
import { useSSHStore } from "@/store/sshStore";
import { useTerminalStore } from '@/store/terminalStore';
import { toast } from "@/hooks/use-toast";
const TerminalShare = () => {
    const { sessions, activeTabId } = useSSHStore()
    const { sessionInfo, addSharedSession } = useTerminalStore()

    const socket = sessions[activeTabId!].socket
    const handleCreateShareTerminalClick = () => {
        socket?.emit(SocketEventConstants.CreateTerminal, activeTabId);

    }
    useEffect(() => {
        socket?.on(SocketEventConstants.join_terminal, () => {
            addSharedSession(activeTabId!)
            toast({
                title: "Terminal shared",
                description: "Terminal shared successfully",
            })
        })
        return () => {
            socket?.off(SocketEventConstants.join_terminal);
        }
    }, [socket])
    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h2 className="text-sm font-medium">Terminal sharing</h2>
                {sessionInfo?.shared_sessions?.includes(activeTabId!) ? (
                    <Avatar className="h-6 w-6 bg-red-500 items-center justify-center">
                        <span className="text-xs">T</span>
                    </Avatar>
                ) : (
                    <Button
                        onClick={handleCreateShareTerminalClick}
                        className="flex items-center gap-2"
                    >
                        {" "}
                        <Share2 className="h-4 w-4" />
                    </Button>
                )}
            </div>
            {sessionInfo?.shared_sessions?.includes(activeTabId!) && (
                <>
                    <div className="space-y-2">
                        <label className="text-sm text-slate-400">
                            Viewers permissions:
                        </label>
                        <Select
                            disabled
                            defaultValue="view"
                            onValueChange={(value) => {

                            }}
                        >
                            <SelectTrigger
                                className="w-full bg-slate-800 text-gray-200 border-slate-700"
                                defaultValue={"read"}
                            >
                                <SelectValue placeholder="Select permission" />
                            </SelectTrigger>
                            <SelectContent defaultValue={"read"}>
                                <SelectItem value="read">view only</SelectItem>
                                <SelectItem value="write">can edit</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="flex items-center gap-2 bg-slate-800 rounded-md p-2">
                        <div className="space-y-2">
                            <div className="flex items-center gap-2 rounded bg-zinc-900 px-2 py-1.5 text-sm max-w-full">
                                <input
                                    className="truncate text-emerald-500 overflow-x-auto"
                                    value={`${window.location.origin}/ssh/terminal/${activeTabId!}`}
                                    readOnly
                                />
                            </div>
                        </div>
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 px-2"
                            onClick={() => navigator.clipboard.writeText(`${window.location.origin}/ssh/terminal/${activeTabId}`)}
                        >
                            <Copy className="h-4 w-4" />
                        </Button>
                    </div>

                    {/* Autocomplete Setting */}
                    <div className="flex items-center justify-between">
                        <span className="text-sm">Autocomplete</span>
                        <Badge variant="outline" className="bg-slate-800 text-slate-300">
                            Disabled
                        </Badge>
                    </div>
                </>
            )}
        </div>
    );
};

export default TerminalShare;
// import React, { useState } from 'react';
// import { useTabStore } from '../store/tabStore';
// import { Share, Users, Plus, Play, Pause, Square, Clock, Globe, Copy, Check } from 'lucide-react';

// export default function SharingTab() {
//   const { sharingSessions, createSharingSession } = useTabStore();
//   const [newSessionName, setNewSessionName] = useState('');
//   const [showNewSessionForm, setShowNewSessionForm] = useState(false);
//   const [copiedIds, setCopiedIds] = useState<Set<string>>(new Set());

//   const handleCreateSession = (e: React.FormEvent) => {
//     e.preventDefault();
//     if (newSessionName.trim()) {
//       createSharingSession(newSessionName.trim());
//       setNewSessionName('');
//       setShowNewSessionForm(false);
//     }
//   };

//   const handleCopySessionLink = (sessionId: string) => {
//     const link = `https://terminal-share.app/session/${sessionId}`;
//     navigator.clipboard.writeText(link);
//     setCopiedIds(prev => new Set([...prev, sessionId]));
//     setTimeout(() => {
//       setCopiedIds(prev => {
//         const newSet = new Set(prev);
//         newSet.delete(sessionId);
//         return newSet;
//       });
//     }, 2000);
//   };

//   const getStatusColor = (status: 'active' | 'paused' | 'ended') => {
//     switch (status) {
//       case 'active': return 'text-green-600 bg-green-100';
//       case 'paused': return 'text-yellow-600 bg-yellow-100';
//       case 'ended': return 'text-gray-600 bg-gray-100';
//       default: return 'text-gray-600 bg-gray-100';
//     }
//   };

//   const getStatusIcon = (status: 'active' | 'paused' | 'ended') => {
//     switch (status) {
//       case 'active': return Play;
//       case 'paused': return Pause;
//       case 'ended': return Square;
//       default: return Square;
//     }
//   };

//   const formatTimeAgo = (date: Date) => {
//     const now = new Date();
//     const diff = now.getTime() - date.getTime();
//     const minutes = Math.floor(diff / (1000 * 60));
//     const hours = Math.floor(diff / (1000 * 60 * 60));
    
//     if (minutes < 60) return `${minutes}m ago`;
//     if (hours < 24) return `${hours}h ago`;
//     return `${Math.floor(hours / 24)}d ago`;
//   };

//   return (
//     <div className="space-y-4">
//       {/* Header */}
//       <div className="flex items-center justify-between">
//         <div>
//           <h3 className="text-lg font-semibold text-gray-900">Sharing</h3>
//           <p className="text-sm text-gray-600">Terminal sessions</p>
//         </div>
//         <button
//           onClick={() => setShowNewSessionForm(true)}
//           className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center space-x-1"
//         >
//           <Plus size={14} />
//           <span>New</span>
//         </button>
//       </div>

//       {/* New Session Form */}
//       {showNewSessionForm && (
//         <div className="bg-white border border-gray-200 rounded-lg p-4">
//           <h4 className="text-sm font-semibold text-gray-900 mb-3">Create Session</h4>
//           <form onSubmit={handleCreateSession} className="space-y-3">
//             <input
//               type="text"
//               value={newSessionName}
//               onChange={(e) => setNewSessionName(e.target.value)}
//               placeholder="Session name"
//               className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
//               autoFocus
//             />
//             <div className="flex space-x-2">
//               <button
//                 type="submit"
//                 className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
//               >
//                 Create
//               </button>
//               <button
//                 type="button"
//                 onClick={() => setShowNewSessionForm(false)}
//                 className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
//               >
//                 Cancel
//               </button>
//             </div>
//           </form>
//         </div>
//       )}

//       {/* Sessions List */}
//       <div className="space-y-3">
//         {sharingSessions.length === 0 ? (
//           <div className="text-center py-8 bg-white rounded-lg border border-gray-200">
//             <Globe size={32} className="mx-auto text-gray-300 mb-2" />
//             <h4 className="text-sm font-medium text-gray-900 mb-1">No sessions</h4>
//             <p className="text-xs text-gray-500 mb-3">Create your first session</p>
//             <button
//               onClick={() => setShowNewSessionForm(true)}
//               className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
//             >
//               Create Session
//             </button>
//           </div>
//         ) : (
//           sharingSessions.map((session) => {
//             const StatusIcon = getStatusIcon(session.status);
//             const isCopied = copiedIds.has(session.id);
            
//             return (
//               <div
//                 key={session.id}
//                 className="bg-white rounded-lg p-4 border border-gray-200 hover:border-blue-300 transition-colors"
//               >
//                 <div className="flex items-start justify-between mb-3">
//                   <div className="flex items-center space-x-2">
//                     <div className="w-6 h-6 rounded bg-blue-100 flex items-center justify-center">
//                       <Share size={12} className="text-blue-600" />
//                     </div>
//                     <div>
//                       <h4 className="font-medium text-gray-900 text-sm">{session.name}</h4>
//                       <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(session.status)}`}>
//                         <StatusIcon size={10} className="mr-1" />
//                         {session.status}
//                       </span>
//                     </div>
//                   </div>
//                 </div>

//                 <div className="space-y-2">
//                   <div className="flex items-center justify-between text-xs">
//                     <div className="flex items-center space-x-1 text-gray-600">
//                       <Users size={12} />
//                       <span>{session.participants} participant{session.participants !== 1 ? 's' : ''}</span>
//                     </div>
//                     <div className="flex items-center space-x-1 text-gray-500">
//                       <Clock size={12} />
//                       <span>{formatTimeAgo(session.createdAt)}</span>
//                     </div>
//                   </div>

//                   <div className="bg-gray-50 rounded p-2">
//                     <div className="flex items-center justify-between">
//                       <code className="text-xs text-gray-600 font-mono truncate flex-1 mr-2">
//                         terminal-share.app/session/{session.id}
//                       </code>
//                       <button
//                         onClick={() => handleCopySessionLink(session.id)}
//                         className={`p-1 rounded transition-colors ${
//                           isCopied 
//                             ? 'bg-green-100 text-green-600' 
//                             : 'bg-gray-200 hover:bg-gray-300 text-gray-600'
//                         }`}
//                       >
//                         {isCopied ? <Check size={12} /> : <Copy size={12} />}
//                       </button>
//                     </div>
//                   </div>

//                   <div className="flex space-x-2 pt-1">
//                     {session.status === 'active' && (
//                       <button className="flex-1 bg-yellow-100 hover:bg-yellow-200 text-yellow-700 py-1 px-2 rounded text-xs font-medium transition-colors">
//                         Pause
//                       </button>
//                     )}
//                     {session.status === 'paused' && (
//                       <button className="flex-1 bg-green-100 hover:bg-green-200 text-green-700 py-1 px-2 rounded text-xs font-medium transition-colors">
//                         Resume
//                       </button>
//                     )}
//                     <button className="flex-1 bg-red-100 hover:bg-red-200 text-red-700 py-1 px-2 rounded text-xs font-medium transition-colors">
//                       End
//                     </button>
//                   </div>
//                 </div>
//               </div>
//             );
//           })
//         )}
//       </div>
//     </div>
//   );
// }