import { Check, Pencil, Plus, Terminal, Trash } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { useCommandStore } from '@/store';
import React, { useMemo, useState } from 'react';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';



export function CommandList() {
  const { setCommand, allCommands, addToAllCommands } = useCommandStore()
  const [loadingState, setLoadingState] = useState(true);
  let clickTimer: NodeJS.Timeout | null = null;


  const [query, setQuery] = useState("")
  const [sniphet, setSniphet] = useState({
    name: "",
    command: ""
  })
  const [isEditing, setIsEditing] = useState(false);
  const filteredCommands = useMemo(() => {
    return allCommands.filter((command) => command.name.toLowerCase().includes(query));
  }, [allCommands, query])
  const handleMouseClick = (e: React.MouseEvent<HTMLButtonElement>, command: string) => {
    if (clickTimer) {
      clearTimeout(clickTimer);
      clickTimer = null;
      setCommand(command, "double");
    } else {
      clickTimer = setTimeout(() => {
        setCommand(command, "single");
        clickTimer = null;
      }, 350);
    }

  };


  const handleAddNewSnippet = () => {
    setIsEditing(false);
    addToAllCommands(sniphet)
    setSniphet({
      name: "",
      command: ""
    })
  }
  React.useEffect(() => {
    setLoadingState(false);
    return () => {
      clickTimer && clearTimeout(clickTimer);
    }
  }, [])
  return (
    <div className="border-l border-gray-800 bg-[#1e1f2e] flex flex-col h-full mr-2">
      {/* Fixed Search & Input Section */}
      <div className="p-4 border-b border-gray-800 relative">
        <Input
          placeholder="Search commands..."
          value={query}
          onChange={(e) => setQuery(e.target.value.toLowerCase())}
          className="bg-[#24253a] border-gray-700 pr-10 focus:outline-none focus:ring-0"
        />

        {/* Toggle Button Inside Input */}
        <button
          onClick={() => setIsEditing(!isEditing)}
          className="absolute right-6 top-6 text-gray-400 hover:text-white"
          type="button"
        >
          {!isEditing && <Plus className="w-4 h-4" />}
        </button>
      </div>

      {/* Conditional Command Add/Edit Card */}
      {isEditing && (
        <div className="p-4 border-b border-gray-800">
          <Card className="p-4 flex gap-2 flex-col">
            <div className="flex flex-col gap-2">
              <div className="flex flex-row justify-between items-center">
                <Label className="text-sm font-medium leading-none">
                  Add New Command
                </Label>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    type="button"
                    className="text-gray-400 hover:text-white"
                    onClick={() => setIsEditing(false)}
                  >
                    <Trash className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    type="button"
                    className="text-gray-400 hover:text-white"
                    onClick={handleAddNewSnippet}
                  >
                    <Check className="w-4 h-4" />
                  </Button>
                </div>
              </div>
              <Input
                value={sniphet.name}
                onChange={(e) =>
                  setSniphet({ ...sniphet, name: e.target.value })
                }
                placeholder="Snippet Name"
                className="bg-[#24253a] border-gray-700 pr-10 focus:outline-none focus:ring-0 focus:border-gray-700"
              />
            </div>
            <Textarea
              rows={4}
              value={sniphet.command}
              onChange={(e) =>
                setSniphet({ ...sniphet, command: e.target.value })
              }
              placeholder="Command"
              className="bg-[#24253a] border-gray-700 pr-10 focus:outline-none focus:ring-0 focus:border-gray-700 resize-none font-mono whitespace-pre text-sm"
            />
          </Card>
        </div>
      )}

      {/* Scrollable Command List */}
      <ScrollArea className="flex-1">
        <div className="p-4 pt-0">
          {filteredCommands.map((cmd, index) => (
            <div key={index} className="group">
              <div className="flex justify-between items-center w-full mb-1">
                <Button
                  variant="ghost"
                  onClick={(e) => handleMouseClick(e, cmd.command)}
                  className="flex-1 justify-start text-left text-gray-300 hover:text-white hover:bg-[#24253a]"
                >
                  <Terminal className="h-4 w-4 mr-2" />
                  {cmd.name}
                </Button>

                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    setIsEditing(true);
                    setSniphet(cmd);
                  }}
                  className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 hover:text-white"
                >
                  <Pencil className="h-4 w-4" />
                </Button>
              </div>

              {cmd.command && (
                <div className="text-sm text-gray-500 ml-6 mb-2 font-mono">
                  {cmd.command}
                </div>
              )}

              {index < filteredCommands.length - 1 && (
                <Separator className="my-2 bg-gray-800" />
              )}
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>

  );
}