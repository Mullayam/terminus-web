
import * as React from "react"
import {
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"


export function FilterDropdown({ children, menu }: { children: React.ReactNode, menu: { label: string, action: () => void, disabled?: boolean }[] }) {

    return (
        <DropdownMenu >
            <DropdownMenuTrigger asChild>
                {children}
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56 mr-8">
                <DropdownMenuLabel>Filter Options</DropdownMenuLabel>
                <DropdownMenuSeparator />

                {menu.map((item, i) => (
                    <DropdownMenuCheckboxItem
                        key={i}
                        onClick={item.action}
                        disabled={item?.disabled}
                        className="cursor-pointer"
                    >
                        {item.label}
                    </DropdownMenuCheckboxItem>
                ))}

            </DropdownMenuContent>
        </DropdownMenu>
    )
}
