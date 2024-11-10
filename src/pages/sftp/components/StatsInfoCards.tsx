import React from 'react';
import { FileIcon, Clock, User, Users, HardDrive } from 'lucide-react';
import { RootObject } from './FileList';

interface SystemInfoProps {
  data: RootObject | null;
}

const formatBytes = (bytes: number): string => {
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  if (bytes === 0) return '0 Bytes';
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${sizes[i]}`;
};

const formatDate = (timestamp: number): string => {
  return new Date(timestamp).toLocaleString();
};

export function StatsInfoCard({ data }: SystemInfoProps) {
  return (
    <div className=" rounded-xl shadow-lg p-6 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-semibold text-gray-200">System Information</h2>
        <FileIcon className="h-6 w-6 text-blue-500" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* File Type Information */}
        {data ?
          <>
            <div className="space-y-3">
              <h3 className="text-lg font-medium text-gray-200 mb-2">File Properties</h3>
              <div className="space-y-2">
                <div className="flex items-center text-gray-400">
                  <HardDrive className="h-4 w-4 mr-2" />
                  <span className="font-medium">Type:</span>
                  <span className="ml-2">
                    {data.isDirectory ? 'Directory' :
                      data.isFile ? 'File' :
                        data.isSymbolicLink ? 'Symbolic Link' :
                          data.isSocket ? 'Socket' :
                            data.isFIFO ? 'FIFO' :
                              data.isBlockDevice ? 'Block Device' :
                                data.isCharacterDevice ? 'Character Device' : 'Unknown'}
                  </span>
                </div>
                <div className="flex items-center text-gray-400">
                  <span className="font-medium">Mode:</span>
                  <code className="ml-2 px-2 py-0.5 bg-slate-800 rounded">{data.mode.toString(8)}</code>
                </div>
                <div className="flex items-center text-gray-400">
                  <span className="font-medium">Size:</span>
                  <span className="ml-2">{formatBytes(data.size)}</span>
                </div>
              </div>
            </div>


            <div className="space-y-3">
              <h3 className="text-lg font-medium text-gray-200 mb-2">Ownership</h3>
              <div className="space-y-2">
                <div className="flex items-center text-gray-400">
                  <User className="h-4 w-4 mr-2" />
                  <span className="font-medium">UID:</span>
                  <span className="ml-2">{data.uid}</span>
                </div>
                <div className="flex items-center text-gray-400">
                  <Users className="h-4 w-4 mr-2" />
                  <span className="font-medium">GID:</span>
                  <span className="ml-2">{data.gid}</span>
                </div>
              </div>
            </div>

            <div className="space-y-3 md:col-span-2">
              <h3 className="text-lg font-medium text-gray-200 mb-2">Timestamps</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center text-gray-400">
                  <Clock className="h-4 w-4 mr-2" />
                  <span className="font-medium">Last Access:</span>
                  <span className="ml-2">{formatDate(data.accessTime)}</span>
                </div>
                <div className="flex items-center text-gray-400">
                  <Clock className="h-4 w-4 mr-2" />
                  <span className="font-medium">Last Modified:</span>
                  <span className="ml-2">{formatDate(data.modifyTime)}</span>
                </div>
              </div>
            </div></>
          : <div className="text-center text-gray-500">
            No system information available.
          </div>
        }

      </div>
    </div>
  );
}