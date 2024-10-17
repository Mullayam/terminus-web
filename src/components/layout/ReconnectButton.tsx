import { RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useSockets } from '@/hooks/use-sockets'

export  function ReconnectButton() {
   const {  socket } =useSockets()

  const handleReconnect = () => {
    socket.connect()
  }

  return (
    <Button
      variant="outline"
      size="icon"
      className="fixed bottom-4 right-4 rounded-full"
      onClick={handleReconnect}    
    >
      <RefreshCw className={`h-4 w-4 hover:animate-spin`} />
      <span className="sr-only">Reconnect</span>
    </Button>
  )
}