/* eslint-disable @typescript-eslint/no-explicit-any */

import { Settings, Moon, Home, User, LogOut, MoreHorizontal } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { NavLink } from 'react-router-dom';

export function SidebarContent({ sidebarItems, isProfileOpen, setIsProfileOpen, signOut }: any) {
    return (
        <>
            <nav className="space-y-2 flex-grow">
                {sidebarItems.map((item: any) => (
                    <SidebarItem
                        key={item.label}
                        icon={item.icon}
                        href={item.href}
                        label={item.label}

                    />
                ))}
            </nav>
            <div className="relative mt-auto pt-4 border-t border-gray-800">
                <div className="flex items-center cursor-pointer" onClick={() => setIsProfileOpen(!isProfileOpen)}>
                    <div className="w-10 h-10 rounded-full bg-gray-700 mr-3 flex items-center justify-center text-sm font-medium">S</div>
                    <span className="text-sm text-gray-400 truncate flex-grow">shubh622005@...</span>
                    <MoreHorizontal size={18} className="text-gray-400" />
                </div>
                <AnimatePresence>
                    {isProfileOpen && (
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 10 }}
                            transition={{ duration: 0.2 }}
                            className="absolute bottom-full left-0 mb-2 w-56 bg-[#1C1C1C] rounded-md shadow-lg py-1 z-10"
                        >
                            <ProfileMenuItem icon={<Moon size={16} />} label="Toggle theme" shortcut="⌘T" />
                            <ProfileMenuItem icon={<Settings size={16} />} label="Onboarding" />
                            <ProfileMenuItem icon={<Home size={16} />} label="Homepage" />
                            <ProfileMenuItem icon={<User size={16} />} label="Profile" />
                            <ProfileMenuItem icon={<LogOut size={16} />} label="Logout" onClick={() => signOut()} />
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </>
    );
}
function SidebarItem({ icon, label, href, onClick }: any) {
    return (
        <NavLink
            to={`${href}`}
            className={({ isActive }: { isActive: boolean }) => `flex items-center space-x-3 px-3 py-2 rounded-md text-sm cursor-pointer transition-colors duration-150 ${isActive ? 'bg-[#1C1C1C] text-white' : 'text-gray-400 hover:bg-[#1C1C1C] hover:text-white'
                }`}
            onClick={onClick}
        >
            {icon}
            <span className="font-medium">{label}</span>
        </NavLink>
    );
}

function ProfileMenuItem({ icon, label, shortcut, onClick }: any) {
    return (
        <div className="px-4 py-2 hover:bg-[#2C2C2C] cursor-pointer flex items-center text-sm" onClick={onClick}>
            {icon && <span className="mr-3 text-gray-400">{icon}</span>}
            <span className="flex-grow">{label}</span>
            {shortcut && <span className="ml-auto text-xs text-gray-500">{shortcut}</span>}
        </div>
    );
}

