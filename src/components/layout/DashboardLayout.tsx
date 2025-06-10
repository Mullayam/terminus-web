/* eslint-disable @typescript-eslint/no-explicit-any */

import ServerStatus from './ServerStatus';

import { AppSidebar } from "./app-sidebar"

import {
    SidebarInset,
    SidebarProvider,
    SidebarTrigger,
} from "@/components/ui/sidebar"



export function Dashboard({ children }: { children: React.ReactNode }) {
    return (

        <SidebarProvider>
            <AppSidebar />
            <SidebarInset>
                <header className="flex h-14 items-center justify-between shrink-0 border-b gap-2 transition-[width,height] ease-linear group-has-[[data-collapsible=icon]]/sidebar-wrapper:h-12">
                    <div className="flex items-center gap-2 px-4">
                        <SidebarTrigger className="-ml-1" />
                    </div>
                    <div className="md:flex mr-2 items-center">
                        <ServerStatus />
                    </div>
                </header>
                <div className="flex flex-1 flex-col   pt-0 bg-[#0A0A0A]">
                    {children}

                </div>
            </SidebarInset>
        </SidebarProvider>


    );
}
