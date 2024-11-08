/* eslint-disable @typescript-eslint/no-explicit-any */
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Filter, HomeIcon, MoreVertical, Search } from "lucide-react";
import { FileList } from "./FileList";
import React, { useState, useEffect } from "react";
import { SFTP_FILES_LIST } from "./interface";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiCore } from "@/lib/api";
import { toast } from "@/hooks/use-toast";

export function FilePane({ title, files, path, handleSetCurrentDir, handleSetLoading, loading }: any) {
    const splitedPath = path.split("/") as string[];
    const [filteredFiles, setFilteredFiles] = useState(files);
    const [transferProgress, setTransferProgress] = useState(0)
    const [dragOver, setDragOver] = useState(false);
    const [uploadFileName, setUploadFileName] = useState<string | null>(null);
    const [uploadFileSize, setUploadFileSize] = useState(0);
    const [uploadSpeed, setUploadSpeed] = useState('');
    const [remainingTime, setRemainingTime] = useState('');
    const handleDragOver = (e: any) => {
        e.preventDefault();
        setDragOver(true);
    };

    const handleDragLeave = () => {
        setDragOver(false);
    };

    const handleDrop = (e: any) => {
        e.preventDefault();
        setDragOver(false);

        const file = e.dataTransfer.files[0];
        if (file) {
            setUploadFileName(file.name);
            setUploadFileSize(file.size);
            startUpload(file);
        }
    };

    const startUpload = (file: any) => {
        const totalSize = file.size;
        let uploaded = 0;
        const uploadSpeed = 58600; // Approximate speed (bytes per second) - adjust as needed
        setUploadSpeed(`${(uploadSpeed / 1024).toFixed(1)} kB/s`);

        const interval = setInterval(async () => {
            uploaded += uploadSpeed;
            const progress = Math.min((uploaded / totalSize) * 100, 100);
            setTransferProgress(progress);
            const remainingBytes = totalSize - uploaded;
            setRemainingTime(`about ~${Math.ceil(remainingBytes / uploadSpeed)} seconds remaining`);
            const data = await ApiCore.uploadFile(file, path)
            if (!data.success) {
                toast({
                    title: 'Error',
                    description: data.message,
                })
            }
            clearInterval(interval);
            setRemainingTime('');
            setUploadFileName(null)
        }, 1000);
    };


    const handleFilterChange = (fileName: string) => {
        if (!fileName) {
            setFilteredFiles(files);
        } else {
            setFilteredFiles(
                files.filter((file: SFTP_FILES_LIST) => file.name.includes(fileName))
            );
        }
    };

    useEffect(() => {
        setFilteredFiles(files);
        setTimeout(() => handleSetLoading(false), 1000);
    }, [files, handleSetLoading]);

    return (
        <div className="flex flex-col h-full">
            <div className="flex justify-between items-center p-2 bg-primary/10">
                <div className="flex items-center space-x-2">
                    <span className="font-semibold">SFTP {title}</span>
                    <div className="flex items-center space-x-1 text-sm text-muted-foreground">
                        <span>
                            {!loading ? splitedPath.map((item: any) =>
                                <React.Fragment key={item}>
                                    <span
                                        key={item}
                                        className={`hover:underline cursor-pointer hover:text-green-600 ${item === splitedPath[splitedPath.length - 1] ? "font-semibold text-green-400" : ""}`}
                                        onClick={() => handleSetCurrentDir(splitedPath.slice(0, splitedPath.indexOf(item) + 1).join("/"))}>{item}</span>{"/"}</React.Fragment>)
                                : <Skeleton className="h-6 w-96 bg-gray-400" />}
                        </span>
                    </div>
                </div>
                <div className="flex items-center space-x-2">
                    <HomeIcon className="h-4 w-4 cursor-pointer" onClick={() => handleSetCurrentDir("")} />
                    <Search className="h-4 w-4" />
                    <Input
                        type="text"
                        placeholder="Filter"
                        onChange={(e) => handleFilterChange(e.target.value)}
                        className="h-8 w-40"
                    />
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                        <Filter className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreVertical className="h-4 w-4" />
                    </Button>
                </div>
            </div>
            <ScrollArea className="flex-grow relative h-[720px]" onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}>
                {loading ? (
                    <div className="absolute inset-0 bg-black opacity-75 flex items-center justify-center">
                        <div className="text-white font-semibold">Loading...</div>
                    </div>
                ) : (
                    <FileList files={filteredFiles} currentDir={path} />
                )}
                {dragOver && (
                    <div className="absolute inset-0 bg-black opacity-75 flex items-center justify-center">
                        <div className="bg-gray-900 text-white p-4 rounded-lg">
                            <p>Drop file to upload</p>
                        </div>
                    </div>
                )}
            </ScrollArea>

            {
                uploadFileName && (
                    <div className="p-2 bg-gray-900 text-sm">
                        <div className="flex justify-between items-center">
                            <span>{uploadFileName}</span>
                            <span>
                                {`${(transferProgress * uploadFileSize / 100 / 1024).toFixed(1)} kB/${(uploadFileSize / 1024).toFixed(1)} kB, ${uploadSpeed}, ${remainingTime}`}
                            </span>
                        </div>
                        <div className="w-full bg-primary/80 rounded-full h-1.5 mt-1">
                            <div
                                className="bg-primary h-1.5 rounded-full"
                                style={{ width: `${transferProgress}%` }}
                            ></div>
                        </div>
                    </div>
                )
            }
        </div>
    );
}
