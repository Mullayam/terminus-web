/* eslint-disable @typescript-eslint/no-explicit-any */
import { ScrollArea } from "@/components/ui/scroll-area"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ChevronLeft, ChevronRight, Filter, MoreVertical, Search } from "lucide-react"
import { FileList } from './FileList'
export function FilePane({ title, files, path }: any) {
    return (
        <div className="flex flex-col h-full">
            <div className="flex justify-between items-center p-2 bg-primary/10">
                <div className="flex items-center space-x-2">
                    <span className="font-semibold">{title}</span>
                    <div className="flex items-center space-x-1 text-sm text-muted-foreground">
                        <ChevronLeft className="h-4 w-4" />
                        <ChevronRight className="h-4 w-4" />
                        <span>{path}</span>
                    </div>
                </div>
                <div className="flex items-center space-x-2">
                    <Search className="h-4 w-4" />
                    <Input type="text" placeholder="Filter" className="h-8 w-40" />
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                        <Filter className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreVertical className="h-4 w-4" />
                    </Button>
                </div>
            </div>
            <ScrollArea className="flex-grow">
                <FileList files={files} isLocal={title === "Local"} />
            </ScrollArea>
        </div>
    )
}