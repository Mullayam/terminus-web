
import {
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
} from "@/components/ui/tabs"
import { Clock, Command, Rocket } from "lucide-react"
import { CommandList } from "./commandList"
import TerminalShare from "./share"

export function SidebarTabs() {
    return (
        <Tabs defaultValue="snippets" className="mx-2 py-1 w-96 p-4">
            <TabsList className="grid w-full grid-cols-3 bg-[#1a1b26] ">
                <TabsTrigger value="snippets" className="data-[state=active]:bg-[#0a0a0f]"><Command /></TabsTrigger>
                <TabsTrigger value="share" className="data-[state=active]:bg-[#0a0a0f]"><Rocket /></TabsTrigger>
                <TabsTrigger value="recent" className="data-[state=active]:bg-[#0a0a0f]"><Clock /></TabsTrigger>
            </TabsList>
            <TabsContent value="snippets">
                <CommandList />
            </TabsContent>
            <TabsContent value="share">
                <TerminalShare />
            </TabsContent>
            <TabsContent value="recent">
            </TabsContent>
        </Tabs>
    )
}
