/* eslint-disable @typescript-eslint/no-explicit-any */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { FilesIcon, TerminalIcon, Settings, HelpCircle, Menu, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { SidebarContent } from './Sidebar';
import {ReconnectButton} from "./ReconnectButton";
import ServerStatus from './ServerStatus';
import { useSockets } from '@/hooks/use-sockets'
import { NavLink } from 'react-router-dom';


export function Dashboard({ children }: { children: React.ReactNode }) {
   const {  isConnected } =useSockets()

    const [activeSidebarItem, setActiveSidebarItem] = useState('SSH');
    const [isProfileOpen, setIsProfileOpen] = useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const sidebarItems = [
        { icon: <TerminalIcon size={18} />, label: 'SSH', href: '/ssh/connect' },
        { icon: <FilesIcon size={18} />, label: 'SFTP', href: '/ssh/sftp' },
        { icon: <Settings size={18} />, label: 'Settings', href: '/ssh/settings' },
    ];


    return (
        <div className="flex h-screen bg-[#0A0A0A] text-white font-sans">
            {/* Sidebar for desktop */}
            <div className="hidden md:flex w-64 bg-[#111111] py-6 px-4 flex-col">
              <NavLink to="/"><h1 className="text-xl font-bold">TerminusWeb</h1></NavLink>
                <SidebarContent
                    sidebarItems={sidebarItems}
                    isProfileOpen={isProfileOpen}
                    setIsProfileOpen={setIsProfileOpen}
                    signOut={() => { }}
                />
            </div>

            {/* Main content */}
            <div className="flex-1 flex flex-col">
                {/* Header */}
                <header className="flex justify-between items-center p-4 border-b border-gray-800 md:justify-end">
                    <div className="md:hidden flex items-center">
                        <h1 className="text-xl font-bold mr-4">TerminusWeb</h1>
                        <Button variant="ghost" size="icon" onClick={() => setIsMobileMenuOpen(true)}>
                            <Menu className="h-6 w-6" />
                        </Button>
                    </div>
                    <div className="md:flex space-x-2 items-center"> 
                        <ServerStatus />
                        <Button variant="ghost" className="flex items-center text-gray-400 hover:text-white text-sm">
                            <HelpCircle size={16} />
                            <span className="ml-2">Help</span>
                        </Button>
                    </div>

                </header>

                {/* Content area */}
                <main className="flex-1 overflow-auto">
                    {children}
                    {!isConnected && <ReconnectButton />}                   
                </main>
            </div>

            {/* Mobile menu */}
            <AnimatePresence>
                {isMobileMenuOpen && (
                    <motion.div
                        initial={{ x: '-100%' }}
                        animate={{ x: 0 }}
                        exit={{ x: '-100%' }}
                        transition={{ type: 'tween' }}
                        className="fixed inset-0 bg-[#111111] z-50 md:hidden"
                    >
                        <div className="flex justify-between items-center p-4 border-b border-gray-800">
                            <h1 className="text-xl font-bold">TerminusWeb</h1>
                            <Button variant="ghost" size="icon" onClick={() => setIsMobileMenuOpen(false)}>
                                <X className="h-6 w-6" />
                            </Button>
                        </div>
                        <div className="p-4">
                            <SidebarContent
                                sidebarItems={sidebarItems}
                                activeSidebarItem={activeSidebarItem}
                                setActiveSidebarItem={(item: any) => {
                                    setActiveSidebarItem(item);
                                    setIsMobileMenuOpen(false);
                                }}
                                isProfileOpen={isProfileOpen}
                                setIsProfileOpen={setIsProfileOpen}
                            />
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}



