import * as React from "react";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuShortcut,
  ContextMenuTrigger,
  ContextMenuSeparator,
} from "@/components/ui/context-menu";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { ContextMenuLabel } from "@radix-ui/react-context-menu";
import * as VisuallyHidden from "@radix-ui/react-visually-hidden";
import { DialogTitle } from "@/components/ui/dialog";
import { useDialogState } from "@/store";

// ── Context for closing the modal from inside rendered content ──
const ContextModalCloseContext = React.createContext<(() => void) | null>(null);

/**
 * Hook for child components to close the parent ContextModal dialog.
 * Call `closeModal()` after a successful action (rename, delete, etc.)
 */
export function useContextModalClose() {
  return React.useContext(ContextModalCloseContext);
}

interface ContextMenuItemType {
  label: string;
  action?: () => void;
  icon?: React.ReactNode;
  disabled?: boolean;
  shortcut?: string;
  content?: React.ReactNode;
  separator?: boolean;
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
  const { openDialog, setOpenDialog } = useDialogState();
  const [open, setOpen] = React.useState(false);
  const [selectedContent, setSelectedContent] =
    React.useState<React.ReactNode>(null);

  const closeModal = React.useCallback(() => setOpen(false), []);

  return (
    <>
      <ContextMenu>
        <ContextMenuTrigger asChild>{trigger}</ContextMenuTrigger>
        <ContextMenuContent className="w-56 p-1.5 bg-[#1a1b26]/95 backdrop-blur-xl border border-white/[0.08] rounded-xl shadow-2xl shadow-black/40">
          {/* Header */}
          <ContextMenuLabel className="px-2.5 py-1.5 flex items-center gap-2">
            <span className="text-xs font-medium text-gray-400 truncate max-w-[180px]">
              {title}
            </span>
          </ContextMenuLabel>

          <ContextMenuSeparator className="bg-white/[0.06] my-1" />

          {contextItems.map((item, index) => (
            <React.Fragment key={index}>
              <ContextMenuItem
                disabled={item?.disabled}
                className={`
                  relative cursor-pointer rounded-lg mx-0.5 px-2.5 py-2
                  text-[13px] text-gray-300
                  transition-all duration-150
                  focus:bg-white/[0.08] focus:text-white
                  data-[disabled]:text-gray-600 data-[disabled]:pointer-events-none
                  flex items-center gap-2.5
                `}
                onClick={() => {
                  item.action?.();
                  if (item.content || children) {
                    setSelectedContent(item.content || children);
                    setOpen(true);
                  }
                }}
              >
                {item?.icon && (
                  <span className="w-4 h-4 flex items-center justify-center text-gray-500 group-focus:text-gray-300">
                    {item.icon}
                  </span>
                )}
                <span className="flex-1">{item.label}</span>
                {item?.shortcut && (
                  <ContextMenuShortcut className="text-[11px] text-gray-600 ml-auto pl-4 tracking-wide">
                    {item.shortcut}
                  </ContextMenuShortcut>
                )}
              </ContextMenuItem>
              {item.separator && (
                <ContextMenuSeparator className="bg-white/[0.06] my-1" />
              )}
            </React.Fragment>
          ))}
        </ContextMenuContent>
      </ContextMenu>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          className="sm:max-w-[700px] max-h-[85vh] overflow-hidden bg-[#1a1b26]/95 backdrop-blur-xl border border-white/[0.08] rounded-2xl shadow-2xl shadow-black/50"
          aria-describedby={title}
        >
          <VisuallyHidden.Root>
            <DialogTitle>{title}</DialogTitle>
          </VisuallyHidden.Root>
          <ContextModalCloseContext.Provider value={closeModal}>
            {selectedContent}
          </ContextModalCloseContext.Provider>
        </DialogContent>
      </Dialog>
    </>
  );
}
