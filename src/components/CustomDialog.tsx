/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  Dialog,
  DialogContent,
  DialogTrigger,
} from "@/components/ui/dialog"

export function CusotmDialog({ children, trigger }: { trigger: any, children: React.ReactNode }) {
  return (
    <Dialog>
      <DialogTrigger>
        {trigger}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[450px]">
        {children}
      </DialogContent>
    </Dialog>
  )
}
