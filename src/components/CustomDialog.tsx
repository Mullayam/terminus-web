/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"

export function CusotmDialog({ children, open }: { open: boolean, children: React.ReactNode }) {
  return (
    <Dialog open={open}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogTitle>Are you sure absolutely sure?</DialogTitle>
      <DialogContent className="sm:max-w-[450px]">
        {children}
      </DialogContent>
    </Dialog>
  )
}
