/* eslint-disable @typescript-eslint/no-explicit-any */

import { useEffect, useRef, useState } from "react"
import ServerStatus from './ServerStatus'
import { NavLink } from "react-router-dom"
import { SquareTerminal, FilesIcon, Settings2, ChevronDown, Heart } from "lucide-react"

const navItems = [
    {
        title: "SSH",
        url: "/ssh/connect",
        icon: SquareTerminal,
        external: false,
    },
    {
        title: "SFTP",
        url: "/ssh/sftp",
        icon: FilesIcon,
        external: false,
    },
    {
        title: "More",
        url: "https://github.com/Mullayam",
        icon: Settings2,
        external: true,
    },
]

const AUTO_HIDE_DELAY = 10_000

export function Dashboard({ children }: { children: React.ReactNode }) {
    const [headerVisible, setHeaderVisible] = useState(true)
    const [autoHide, setAutoHide] = useState(true)
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

    const clearTimer = () => {
        if (timerRef.current) {
            clearTimeout(timerRef.current)
            timerRef.current = null
        }
    }

    const startTimer = () => {
        clearTimer()
        timerRef.current = setTimeout(() => setHeaderVisible(false), AUTO_HIDE_DELAY)
    }

    const showHeader = () => {
        setHeaderVisible(true)
        if (autoHide) startTimer()
    }

    useEffect(() => {
        if (autoHide && headerVisible) {
            startTimer()
        } else {
            clearTimer()
            if (!autoHide) setHeaderVisible(true)
        }
        return clearTimer
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [autoHide])

    useEffect(() => {
        if (autoHide) startTimer()
        return clearTimer
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    return (
        <div
            className="flex flex-col h-screen"
            style={{
                // CSS var tracks the header height so children can respond
                ['--header-h' as any]: headerVisible ? '3.5rem' : '0px',
            } as React.CSSProperties}
        >

            {/* ── Header ── */}
            <header
                className={`relative flex h-14 items-center justify-between shrink-0 border-b gap-2
                    transition-all duration-300 ease-in-out overflow-hidden
                    ${headerVisible ? "max-h-14 opacity-100" : "max-h-0 opacity-0 border-b-0"}`}
            >
                {/* Left: nav items */}
                <div className="flex items-center gap-2 px-4">
                    <nav className="flex items-center gap-1">
                        {navItems.map((item) =>
                            item.external ? (
                                <a
                                    key={item.title}
                                    href={item.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                                >
                                    <item.icon className="h-4 w-4" />
                                    {item.title}
                                </a>
                            ) : (
                                <NavLink
                                    key={item.title}
                                    to={item.url}
                                    className={({ isActive }) =>
                                        `flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md transition-colors ${isActive
                                            ? "bg-accent text-foreground font-medium"
                                            : "text-muted-foreground hover:text-foreground hover:bg-accent"
                                        }`
                                    }
                                >
                                    <item.icon className="h-4 w-4" />
                                    {item.title}
                                </NavLink>
                            )
                        )}
                    </nav>
                </div>

                {/* Centre: auto-hide toggle */}
                <div className="absolute left-1/2 -translate-x-1/2 flex items-center">
                    <label className="flex items-center gap-1.5 cursor-pointer select-none text-xs text-muted-foreground">
                        <span>Auto-hide</span>
                        <button
                            role="switch"
                            aria-checked={autoHide}
                            onClick={() => setAutoHide(v => !v)}
                            className={`relative inline-flex h-4 w-7 shrink-0 rounded-full border transition-colors duration-200 focus:outline-none
                                ${autoHide ? "bg-primary border-primary" : "bg-muted border-border"}`}
                        >
                            <span className={`inline-block h-3 w-3 rounded-full bg-white shadow transition-transform duration-200 mt-0.5
                                ${autoHide ? "translate-x-3.5" : "translate-x-0.5"}`} />
                        </button>
                    </label>
                    <span className="flex items-center gap-1 text-xs text-muted-foreground whitespace-nowrap">
                        Made by <span className="font-semibold text-foreground">Enjoys</span> with
                        <Heart className="h-3 w-3 fill-rose-500 text-rose-500 animate-pulse" />
                    </span>
                </div>

                {/* Right: credits + server status */}
                <div className="flex items-center gap-3 mr-3">
                    
                    <ServerStatus />
                </div>
            </header>

            {/* ── Reveal bar — shown only when header is hidden ── */}
            <div
                className={`flex justify-center transition-all duration-300 ${headerVisible ? "h-0 overflow-hidden" : "h-auto"}`}
            >
                <button
                    onClick={showHeader}
                    aria-label="Show header"
                    className="flex items-center gap-1 px-4 py-0.5 text-xs text-muted-foreground bg-accent/60 hover:bg-accent border-b border-x rounded-b-md transition-colors"
                >
                    <ChevronDown className="h-3.5 w-3.5" />
                    <span>Show toolbar</span>
                </button>
            </div>

            {/* ── Page content ── */}
            <div
                className="flex flex-col overflow-hidden bg-[#0A0A0A] transition-all duration-300 ease-in-out"
                style={{ height: 'calc(100vh - var(--header-h, 3.5rem))' }}
            >
                {children}
            </div>
        </div>
    )
}
