import {
    Sheet,
    SheetContent,
    SheetTrigger,
} from "@/components/ui/sheet"
import { SidebarTabs } from "./sidebar-tabs"
import { LayoutDashboard } from "lucide-react"
import { Button } from "@/components/ui/button"

export function SideBarSheet() {
    return (
        <Sheet>
            <SheetTrigger asChild>
                <Button variant={"ghost"}>
                <LayoutDashboard className="h-4 w-4 text-gray-400" />
                </Button>
            </SheetTrigger>
            <SheetContent >
                <div className="mt-4">
                    <SidebarTabs />
                </div>
            </SheetContent>
        </Sheet>
    )
}
