/* eslint-disable @typescript-eslint/no-explicit-any */
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Filter, HomeIcon, MoreVertical, RefreshCwIcon, Search, Upload, File } from 'lucide-react';
import { FileList } from "./FileList";
import React, { useState, useEffect } from "react";
import { SFTP_FILES_LIST } from "./interface";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiCore } from "@/lib/api";
import { toast } from "@/hooks/use-toast";
import { socket } from "@/lib/sockets";
import { SocketEventConstants } from "@/lib/sockets/event-constants";
import { FilterDropdown } from "./FilterDropdown";
import EnhancedFileUploadPopup from "@/components/FileUpload";
import { Progress } from "@/components/ui/progress";
interface FileUploadProgress {
    percentage: string;
    transferred: {
        size: string;
        unit: string;
    };
    length: {
        size: string;
        unit: string;
    };
    remaining: {
        size: string;
        unit: string;
    };
    eta: number;
    runtime: number;
    delta: number;
    speed: {
        speed: string;
        unit: string;
    };
}
export function FilePane({ title, files, path, handleSetCurrentDir, handleSetLoading, loading, hasError }: any) {
    const splitedPath = path.split("/") as string[];
    const [filteredFiles, setFilteredFiles] = useState(files);
    const [dragOver, setDragOver] = useState(false);
    const [open, setOpen] = useState(false);
    const [uploadedFiles, setUploadedFiles] = useState<Array<File & { path?: string }>>([]);
    const [isUploading, setIsUploading] = useState(false);
    const [showHiddenFiles, setShowHiddenFiles] = useState<boolean>(false);
    const [uploadFileName, setUploadFileName] = useState<string | null>(null);

    const [fileUploadProgress, setFileUploadProgress] = useState<FileUploadProgress | null>(null);
    const handleHiddenFilesFilter = () => {
        setShowHiddenFiles(!showHiddenFiles);
        if (!showHiddenFiles) {
            setFilteredFiles(files)
            return
        }
        setFilteredFiles(files.filter((file: SFTP_FILES_LIST) => !file.name.startsWith(".")));
    }
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
            startUpload(file);
        }

    };

    const startUpload = async (file: any) => {

        try {

            const data = await ApiCore.uploadFile(file, path)
            if (!data.status) {
                throw new Error(data.message)
            }
            setOpen(false)
        } catch (error: any) {
            toast({
                variant: 'destructive',
                title: 'Error',
                description: error.message,
            })

        }
    }




    const handleFilterChange = (fileName: string) => {
        if (!fileName) {
            setFilteredFiles(files);
        } else {
            setFilteredFiles(
                files.filter((file: SFTP_FILES_LIST) => file.name.includes(fileName))
            );
        }
    };
    const handleRetrySFTPConnect = () => {
        handleSetLoading(true)
        socket.emit(SocketEventConstants.SFTP_CONNECT)
    }
    useEffect(() => {
        socket.on(SocketEventConstants.FILE_UPLOADED_PROGRESS, (data: FileUploadProgress) => {
            setFileUploadProgress(data)
        })
        socket.on(SocketEventConstants.FILE_UPLOADED, () => {
            setUploadFileName(null)
            setFileUploadProgress(null)
        })
        setFilteredFiles(files.filter((file: SFTP_FILES_LIST) => !file.name.startsWith(".")));
        setTimeout(() => files.length > 0 && handleSetLoading(false), 1000);

    }, [files, handleSetLoading]);
 
    return (
        <>
            <EnhancedFileUploadPopup
                open={open} setOpen={setOpen}
                files={uploadedFiles}
                setFiles={setUploadedFiles}
                isUploading={isUploading}
                setIsUploading={setIsUploading}
                startUpload={startUpload}
            />
            <div className="flex flex-col h-[720px]" onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}>
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

                        {hasError ?
                            <RefreshCwIcon className="h-4 w-4 cursor-pointer" onClick={handleRetrySFTPConnect} /> :
                            <RefreshCwIcon className="h-4 w-4 cursor-pointer" onClick={() => socket.emit(SocketEventConstants.SFTP_GET_FILE, { dirPath: path })} />
                        }

                        {!loading &&
                            <>
                                <HomeIcon className="h-4 w-4 cursor-pointer" onClick={() => handleSetCurrentDir("")} />
                                <Input
                                    type="text"
                                    placeholder="Filter"
                                    onChange={(e) => handleFilterChange(e.target.value)}
                                    className="h-8 w-40"
                                />
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                    <Filter className="h-4 w-4" />
                                </Button>

                                <FilterDropdown
                                    menu={[

                                        {
                                            label: `${showHiddenFiles ? "Hide" : "Show"} Hidden Files`,
                                            action: () => handleHiddenFilesFilter(),
                                            disabled: false
                                        },
                                        {
                                            label: "New File",
                                            action: () => console.log(""),
                                            disabled: true
                                        },
                                        {
                                            label: "New Folder",
                                            action: () => console.log(""),
                                            disabled: true
                                        },
                                        {
                                            label: "Upload File/Folder",
                                            action: () => setOpen(true),
                                        },                                        
                                        {
                                            label: "Download Current Dir Zip",
                                            action: () => console.log(""),

                                        },
                                        {
                                            label: "Refresh",
                                            action: () => socket.emit(SocketEventConstants.SFTP_GET_FILE, { dirPath: path }),

                                        }

                                    ]}
                                >
                                    <Button variant="ghost" size="icon" className="h-8 w-8">
                                        <MoreVertical className="h-4 w-4" />
                                    </Button>
                                </FilterDropdown>

                            </>
                        }


                    </div>
                </div>


                <ScrollArea className="flex-grow relative h-[720px]">
                    {loading ? (
                        <div className="absolute inset-0 bg-black opacity-75 flex items-center justify-center">
                            <div className="text-white font-semibold">Loading...</div>
                        </div>
                    ) : (
                        <FileList files={filteredFiles} currentDir={path} />
                    )}
                    {dragOver && (
                        <div
                            className={`absolute inset-0 border-2 border-dashed rounded-lg p-8  opacity-95 bg-black flex items-center justify-center transition-all duration-200 ease-in-out`}
                        >
                            <input
                                type="file"
                                multiple
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"

                            />

                            <div className="text-center">
                                <Upload className="mx-auto h-12 w-12 text-gray-400" />
                                <p className="mt-2 text-gray-200 font-semibold">Drop your files here</p>
                                <p className="mt-1 text-gray-500">File Will Upload to <b>{path}</b></p>
                            </div>
                        </div>
                    )}
                </ScrollArea>
                {
                    uploadFileName && fileUploadProgress && (
                        <div className="p-2 bg-gray-900 text-sm">
                            <div className="flex justify-between items-center">
                                <span>{uploadFileName}</span>

                                <span>
                                    {fileUploadProgress.percentage},
                                    Transferred:{fileUploadProgress.transferred?.size}{fileUploadProgress.transferred?.unit} {" - "}
                                    Total: {fileUploadProgress.length?.size}{fileUploadProgress.length?.unit}{" - "}
                                    Speed: {fileUploadProgress.speed?.speed}{fileUploadProgress.speed?.unit}{" - "}
                                    Remaining:{fileUploadProgress.remaining?.size}{fileUploadProgress.remaining?.unit}{" - "}
                                    ETA: {fileUploadProgress.eta} seconds
                                </span>
                            </div>
                            <Progress value={parseInt(fileUploadProgress.percentage)} className="h-1.5 w-full" />
                        </div>
                    )
                }
            </div>
        </>
    );
}
