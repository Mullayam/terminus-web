import { Terminal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { useCommandStore } from '@/store';
import { useMemo, useState } from 'react';

const commands = [

  { name: 'PM2 restart', command: 'pm2 restart' },
  { name: 'PM2 Stop', command: 'pm2 stop' },
  { name: 'PM2 Logs', command: 'pm2 logs' },
  { name: 'Nginx Test', command: 'sudo nginx -t' },
  { name: 'Reload Nginx File', command: 'sudo systemctl reload nginx' },
  { name: 'Stop Nginx', command: 'sudo systemctl stop nginx' },
  { name: 'Restart Nginx', command: 'sudo systemctl restart nginx' },
  { name: 'systemctl', command: 'systemctl' },
];

export function CommandList() {
  const { setCommand } = useCommandStore()
  const [query, setQuery] = useState("")
  const filteredCommands = useMemo(() => {
    return commands.filter((command) => command.name.toLowerCase().includes(query));
  }, [commands, query])
  return (
    <div className="border-l border-gray-800 bg-[#1e1f2e] flex flex-col">
      <div className="p-4">
        <Input
          placeholder="Search commands..."
          value={query}
          onChange={(e) => setQuery((e.target.value).toLowerCase())}
          className="bg-[#24253a] border-gray-700"
        />
      </div>
      <ScrollArea className="h-full">
        <div className="p-4 pt-0">
          {/* <Button
            variant="ghost"

            className="w-full justify-start text-left mb-1 text-gray-300 hover:text-white hover:bg-[#24253a]"
          >
            <Terminal className="h-4 w-4 mr-2" />
            New Snippet
          </Button>
          <Separator className="my-2 bg-gray-800" /> */}
          {filteredCommands.map((cmd, index) => (
            <div key={index}>
              <Button
                variant="ghost"
                onClick={() => setCommand(cmd.command, "single")}
                onDoubleClick={() => setCommand(cmd.command, "double")}
                className="w-full justify-start text-left mb-1 text-gray-300 hover:text-white hover:bg-[#24253a]"
              >
                <Terminal className="h-4 w-4 mr-2" />
                {cmd.name}
              </Button>
              {cmd.command && (
                <div className="text-sm text-gray-500 ml-6 mb-2 font-mono">
                  {cmd.command}
                </div>
              )}
              {index < commands.length - 1 && (
                <Separator className="my-2 bg-gray-800" />
              )}
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}