import { getStatusColor, formatBytes, formatSpeed } from '@/lib/utils';
import { Archive, File, FileText, Image, Music, Video, X } from "lucide-react";
import { useEffect, useState } from "react";
import { DownloadProgressType } from './only-sftp-client';


const getFileIcon = (type: string) => {
    switch (type) {
        case 'document': return <FileText className="w-4 h-4" />;
        case 'image': return <Image className="w-4 h-4" />;
        case 'audio': return <Music className="w-4 h-4" />;
        case 'video': return <Video className="w-4 h-4" />;
        case 'zip': return <Archive className="w-4 h-4" />;
        default: return <File className="w-4 h-4" />;
    }
};
export function ShowProgressBar({ download, onCancel, index }:
    {
        download: DownloadProgressType;
        onCancel: () => void; index: number
    }
) {
    const progressPercentage = Math.round(download.percent);
    const isCompleted = download.status === 'completed';
    const isError = download.status === 'error';
    const [isVisible, setIsVisible] = useState(false);
    const [isRemoving, setIsRemoving] = useState(false);

    useEffect(() => {
        const timer = setTimeout(() => setIsVisible(true), index * 100);
        return () => clearTimeout(timer);
    }, [index]);

    useEffect(() => {

        if (isCompleted) {
            const timer = setTimeout(() => {
                handleRemove();
            }, 3000);
            return () => clearTimeout(timer);
        }
    }, [isCompleted]);

    const handleRemove = () => {
        setIsRemoving(true);

    };

    return (
        <div
            className={`
          fixed right-4 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 
          w-80 p-4 transition-all duration-300 ease-out backdrop-blur-sm bg-white/95 dark:bg-gray-800/95
          ${isVisible && !isRemoving ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'}
          ${isRemoving ? 'scale-95 opacity-0' : ''}
          hover:shadow-2xl hover:scale-[1.02]
        `}
            style={{
                bottom: `${20 + index * 100}px`,
                zIndex: 1000 - index
            }}
        >
            {/* Header */}
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-2 flex-1 min-w-0">
                    <div className={`p-1.5 rounded-md ${isCompleted ? 'bg-green-100 text-green-600 dark:bg-green-900 dark:text-green-400' : isError ? 'bg-red-100 text-red-600 dark:bg-red-900 dark:text-red-400' : 'bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-400'}`}>
                        {getFileIcon("file")}
                    </div>
                    <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                            {download.name}
                        </h3>
                    </div>
                </div>

                <div className="flex items-center space-x-2">
                    <span className={`text-xs font-bold px-2 py-1 rounded-full ${isCompleted ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' : isError ? 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300' : 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'}`}>
                        {isCompleted ? '✓' : isError ? '✗' : `${progressPercentage}%`}
                    </span>
                    <button
                        onClick={onCancel}
                        className="p-1 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 transition-all duration-200"
                        title={isCompleted ? "Dismiss" : "Cancel download"}
                    >
                        <X className="w-3 h-3" />
                    </button>
                </div>
            </div>

            {/* Progress Bar */}
            <div className="mb-2">
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5 overflow-hidden">
                    <div
                        className={`h-full transition-all duration-500 ease-out ${getStatusColor(download.status)} ${download.status === 'downloading' ? 'animate-pulse' : ''}`}
                        style={{ width: `${progressPercentage}%` }}
                    >
                        {download.status === 'downloading' && (
                            <div className="h-full bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer"></div>
                        )}
                    </div>
                </div>
            </div>

            {/* Status Info */}
            <div className="flex justify-between items-center text-xs text-gray-500 dark:text-gray-400">
                <span>
                    {formatBytes(+download.transferred)} / {formatBytes(+download.totalSize)}
                </span>

                {(download.status === 'downloading' || download.status === 'uploading') && (
                    <span className="flex items-center space-x-1">
                        <span>{download.speed.speed}{download.speed.unit}</span>
                        <span>•</span>
                        <span>{download.eta}s left</span>
                    </span>
                )}

                {download.status === 'completed' && (
                    <span className="text-green-600 dark:text-green-400 font-medium">
                        Complete
                    </span>
                )}

                {download.status === 'error' && (
                    <span className="text-red-600 dark:text-red-400 font-medium">
                        Failed
                    </span>
                )}
            </div>
        </div>
    );
}
