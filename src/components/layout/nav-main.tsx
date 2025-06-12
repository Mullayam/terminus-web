import { ChevronRight } from "lucide-react"
import {
  Settings2,
  SquareTerminal,
} from "lucide-react"
import { FilesIcon, } from 'lucide-react';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar"
import { NavLink } from "react-router-dom"

export function NavMain() {

  const navItems = [
    {
      title: "SSH",
      url: "/ssh",
      icon: SquareTerminal,
      isActive: true,

    },
    {
      title: "SFTP",
      url: "/ssh/sftp",
      icon: FilesIcon,
      isActive: false,

    },
    {
      title: "More",
      url: "#",
      icon: Settings2,
      items: [
        {
          title: "Github",
          url: "#",
        },
      ],
    },
  ]




  return (
    <SidebarGroup>
      <SidebarGroupLabel>Platform</SidebarGroupLabel>
      <SidebarMenu>
        {navItems.map((item) => (
          <Collapsible
            key={item.title}
            asChild
            defaultOpen={item.isActive}
            className="group/collapsible"
          >
            <SidebarMenuItem>
              <CollapsibleTrigger asChild>
                <NavLink to={item.url}>
                  <SidebarMenuButton tooltip={item.title}>
                    {item.icon && <item.icon />}
                    {item.title}
                    {item?.items && <ChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />}

                  </SidebarMenuButton>
                </NavLink>
              </CollapsibleTrigger>
              {
                item?.items && (
                  <CollapsibleContent>
                    <SidebarMenuSub>
                      {item.items?.map((subItem) => (
                        <SidebarMenuSubItem key={subItem.title}>
                          <SidebarMenuSubButton asChild>
                            <a href={subItem.url}>
                              <span>{subItem.title}</span>
                            </a>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                      ))}
                    </SidebarMenuSub>
                  </CollapsibleContent>
                )
              }

            </SidebarMenuItem>
          </Collapsible>
        ))}
      </SidebarMenu>
    </SidebarGroup>
  )
}
