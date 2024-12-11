import * as React from "react";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuShortcut,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { ContextMenuLabel } from "@radix-ui/react-context-menu";
import { Separator } from "./separator";
import * as VisuallyHidden from "@radix-ui/react-visually-hidden";
import { DialogTitle } from "@/components/ui/dialog";
import { useDialogState } from "@/store";

interface ContextMenuItemType {
  label: string;
  action?: () => void;
  icon?: React.ReactNode;
  disabled?: boolean;
  shortcut?: string;
  content?: React.ReactNode;
}

interface ContextModalProps {
  children?: React.ReactNode;
  trigger: React.ReactNode;
  title: string;
  contextItems: ContextMenuItemType[];
}

export function ContextModal({
  children,
  trigger,
  title,
  contextItems,
}: ContextModalProps) {
  const  {openDialog, setOpenDialog} =useDialogState()
  const [open, setOpen] = React.useState(false);
  const [selectedContent, setSelectedContent] = React.useState<React.ReactNode>(null);
  return (
    <>
      <ContextMenu>
        <ContextMenuTrigger asChild>{trigger}</ContextMenuTrigger>
        <ContextMenuContent className="p-2 w-64 bg-[#1c1e26] rounded-lg shadow-lg">
          <ContextMenuLabel>
            <i className="text-sm">{title}</i>
          </ContextMenuLabel>
          <Separator className="mt-1" />
          {contextItems.map((item, index) => (
            <ContextMenuItem
              disabled={item?.disabled}
              key={index}
              className="cursor-pointer"
              onClick={() => {
                item.action?.();
                if (item.content || children) {
                  setSelectedContent(item.content || children);
                  setOpen(true);
                }
              }}
            >
              {item?.icon}
              {item.label}
              {item?.shortcut && (
                <ContextMenuShortcut>{item.shortcut}</ContextMenuShortcut>
              )}
            </ContextMenuItem>
          ))}
        </ContextMenuContent>
      </ContextMenu>

      <Dialog open={open}  onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[500px] bg-[#1c1e26]" aria-describedby={title}>
          <VisuallyHidden.Root>            
            <DialogTitle>{title}</DialogTitle>
          </VisuallyHidden.Root>         
          {selectedContent}
        </DialogContent>
      </Dialog>
    </>
  );
}
