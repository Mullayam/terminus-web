/* eslint-disable @typescript-eslint/no-explicit-any */
import { ScrollArea } from "@/components/ui/scroll-area"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Filter, MoreVertical, Search } from "lucide-react"
import { FileList } from './FileList'
import { useState } from "react"
import { SFTP_FILES_LIST } from './interface';

export function FilePane({ title, files, path}: any) { 
    const [filteredFiles, setFilteredFiles] = useState(files);

    const handleFilterChange = (fileName: string) => {
        if (!fileName) {
            setFilteredFiles(files);
        } else {
            setFilteredFiles(files.filter((file:SFTP_FILES_LIST) => file.name.includes(fileName)));
        }
    };
    return (
        <div className="flex flex-col h-full">
            <div className="flex justify-between items-center p-2 bg-primary/10">
                <div className="flex items-center space-x-2">
                    <span className="font-semibold">{title}</span>
                    <div className="flex items-center space-x-1 text-sm text-muted-foreground">                        
                        <span>{path}</span>
                    </div>
                </div>
                <div className="flex items-center space-x-2">
                    <Search className="h-4 w-4" />
                    <Input type="text" placeholder="Filter"
                    onChange={(e) => handleFilterChange(e.target.value)}
                    className="h-8 w-40" />
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                        <Filter className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreVertical className="h-4 w-4" />
                    </Button>
                </div>
            </div>
            <ScrollArea className="flex-grow">
                <FileList files={filteredFiles} currentDir={path} />
            </ScrollArea>
        </div>
    )
}