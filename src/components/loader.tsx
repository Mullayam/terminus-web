import { useState, useEffect } from 'react'

export   function FullScreenLoader() {
  const [dots, setDots] = useState('.')

  useEffect(() => {
    const interval = setInterval(() => {
      setDots(prev => prev.length < 3 ? prev + '.' : '.')
    }, 500)

    return () => clearInterval(interval)
  }, [])

  return (
    <div className="fixed inset-0 z-40 flex flex-col items-center justify-center bg-black text-white">
      <div className="w-12 h-12 border-t-2 border-r-2 border-white rounded-full animate-spin mb-4"></div>
      <p className="text-lg font-semibold">
        Establishing Connection{dots}
      </p>
    </div>
  )
}