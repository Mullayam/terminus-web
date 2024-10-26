import { Terminal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import { cn } from '@/lib/utils';

interface NavItem {
  icon: typeof Terminal;
  label: string;
  color?: string;
}

export function Sidebar() {
  const [activeItem, setActiveItem] = useState('Terminal');

  const navItems: NavItem[] = [
    { icon: Terminal, label: 'Terminal', },
  ];

  return (
    <div className="w-16 flex flex-col items-center py-4 border-r border-gray-800 bg-[#1a1b26] shrink-0">
      {navItems.map((item) => (
        <Button
          key={item.label}
          variant="ghost"
          size="icon"
          className={cn(
            "mb-4 relative group",
            activeItem === item.label && "bg-[#24253a]"
          )}
          onClick={() => setActiveItem(item.label)}
        >
          <item.icon
            className={cn(
              "h-5 w-5",
              item.color || "text-gray-400",
              activeItem === item.label && "text-orange-500"
            )}
          />    
        </Button>
      ))}
    </div>
  );
}