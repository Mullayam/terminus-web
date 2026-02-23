import { Loader2 } from 'lucide-react'
import { useState, useEffect } from 'react'

export function FullScreenLoader({text}: {text?: string}) {
  const [dots, setDots] = useState('.')

  useEffect(() => {
    const interval = setInterval(() => {
      setDots(prev => prev.length < 3 ? prev + '.' : '.')
    }, 500)

    return () => clearInterval(interval)
  }, [])

  return (
    <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm">
      <Loader2 className="h-10 w-10 text-green-500 animate-spin" />
      <p className="mt-3 text-sm text-gray-300">Connecting to server{dots}</p>
      <p className="mt-1 text-xs text-gray-500">{text}</p>
    </div>
  )
}