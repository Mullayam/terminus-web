import { Command } from "lucide-react"

import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,

} from "@/components/ui/sidebar"
import { NavLink } from "react-router-dom"

export function TeamSwitcher() {

  return (
    <SidebarMenu>
      <NavLink to={"/"} >
        <SidebarMenuItem>
          <SidebarMenuButton
            size="lg"
            className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
          >
            <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
              <Command className="size-4" />
            </div>
            <div className="grid flex-1 text-left text-sm leading-tight">
              <span className="truncate font-semibold">
                Termius Web
              </span>
              <span className="truncate text-xs">Free</span>
            </div>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </NavLink>
    </SidebarMenu>
  )
}
