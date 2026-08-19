import { Check, Pencil, Play, Plus, Terminal, Trash } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { useCommandStore } from '@/store';
import React, { memo, useCallback, useMemo, useRef, useState } from 'react';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { useSessionTheme } from '@/hooks/useSessionTheme';

type CommandItem = { name: string; command: string };

interface CommandRowProps {
  cmd: CommandItem;
  foreground: string;
  onClick: (e: React.MouseEvent<HTMLButtonElement>, command: string) => void;
  onRun: (command: string) => void;
  onEdit: (cmd: CommandItem) => void;
  onDelete: (command: string) => void;
}

/** Memoized row so the search box / add form doesn't re-render the whole command list. */
const CommandRow = memo(function CommandRow({ cmd, foreground, onClick, onRun, onEdit, onDelete }: CommandRowProps) {
  return (
    <div className="group w-80">
      <div className="flex items-center mb-1 min-w-0">
        <Button
          variant="ghost"
          onClick={(e) => onClick(e, cmd.command)}
          className="min-w-0 flex-1 justify-start text-left hover:text-white"
          style={{ color: `${foreground}cc` }}
          title={cmd.name}
        >
          <Terminal className="h-4 w-4 mr-2 shrink-0" />
          <span className="w-0 flex-grow truncate text-sm">{cmd.name}</span>
        </Button>

        <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onRun(cmd.command)}
            className="text-gray-400 hover:text-green-400 h-7 w-7"
            title="Run command"
          >
            <Play className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onEdit(cmd)}
            className="text-gray-400 hover:text-white h-7 w-7"
            title="Edit command"
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onDelete(cmd.command)}
            className="text-gray-400 hover:text-red-400 h-7 w-7"
            title="Delete command"
          >
            <Trash className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {cmd.command && (
        <p className="text-sm text-gray-500 ml-6 mb-2 font-mono truncate" title={cmd.command}>
          {cmd.command}
        </p>
      )}
    </div>
  );
});


export function CommandList() {
  // Individual selectors so the list only re-renders when `allCommands` changes,
  // not on every setCommand / shellHistory update elsewhere in the store.
  const allCommands = useCommandStore((s) => s.allCommands)
  const setCommand = useCommandStore((s) => s.setCommand)
  const addToAllCommands = useCommandStore((s) => s.addToAllCommands)
  const removeFromAllCommands = useCommandStore((s) => s.removeFromAllCommands)
  const resetToDefaults = useCommandStore((s) => s.resetToDefaults)
  const hydrate = useCommandStore((s) => s.hydrate)
  const { colors } = useSessionTheme();
  const clickTimerRef = useRef<NodeJS.Timeout | null>(null);


  const [query, setQuery] = useState("")
  const [sniphet, setSniphet] = useState({
    name: "",
    command: ""
  })
  const [isEditing, setIsEditing] = useState(false);
  const filteredCommands = useMemo(() => {
    return allCommands.filter((command) => command.name.toLowerCase().includes(query));
  }, [allCommands, query])
  const handleMouseClick = useCallback((e: React.MouseEvent<HTMLButtonElement>, command: string) => {
    if (clickTimerRef.current) {
      clearTimeout(clickTimerRef.current);
      clickTimerRef.current = null;
      setCommand(command, "double");
    } else {
      clickTimerRef.current = setTimeout(() => {
        setCommand(command, "single");
        clickTimerRef.current = null;
      }, 350);
    }
  }, [setCommand]);

  const handleRun = useCallback((command: string) => setCommand(command, "double"), [setCommand]);
  const handleEdit = useCallback((cmd: CommandItem) => {
    setIsEditing(true);
    setSniphet(cmd);
  }, []);


  const handleAddNewSnippet = () => {
    setIsEditing(false);
    addToAllCommands(sniphet)
    setSniphet({
      name: "",
      command: ""
    })
  }
  React.useEffect(() => {

    hydrate();
    return () => {
      if (clickTimerRef.current) clearTimeout(clickTimerRef.current);
    }
  }, [])
  return (
    <div className="border-l flex flex-col h-full overflow-hidden" style={{ borderColor: `${colors.foreground}15`, backgroundColor: colors.background }}>
      {/* Fixed Search & Input Section */}
      <div className="px-4 py-3 border-b relative" style={{ borderColor: `${colors.foreground}15` }}>
        <Input
          placeholder="Search commands..."
          value={query}
          onChange={(e) => setQuery(e.target.value.toLowerCase())}
          className="border-gray-700 pr-16 focus:outline-none focus:ring-0"
          style={{ backgroundColor: `${colors.foreground}10` }}
        />

        {/* Toggle Button Inside Input */}
        <div className="absolute right-6 top-5 flex items-center gap-1">
          {allCommands.length > 0 && (
            <button
              onClick={() => { if (confirm("Reset to default commands?")) resetToDefaults(); }}
              className="hover:text-red-400"
              style={{ color: `${colors.foreground}80` }}
              type="button"
              title="Clear all commands"
            >
              <Trash className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={() => setIsEditing(!isEditing)}
            className="hover:text-white"
            style={{ color: `${colors.foreground}80` }}
            type="button"
          >
            {!isEditing && <Plus className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Conditional Command Add/Edit Card */}
      {isEditing && (
        <div className="p-4 border-b" style={{ borderColor: `${colors.foreground}15` }}>
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
                className="border-gray-700 pr-10 focus:outline-none focus:ring-0 focus:border-gray-700"
                style={{ backgroundColor: `${colors.foreground}10` }}
              />
            </div>
            <Textarea
              rows={4}
              value={sniphet.command}
              onChange={(e) =>
                setSniphet({ ...sniphet, command: e.target.value })
              }
              placeholder="Command"
              className="border-gray-700 pr-10 focus:outline-none focus:ring-0 focus:border-gray-700 resize-none font-mono whitespace-pre text-sm"
              style={{ backgroundColor: `${colors.foreground}10` }}
            />
          </Card>
        </div>
      )}

      {/* Scrollable Command List */}
      <ScrollArea className="flex-1">
        <div className="px-4 py-3 pt-0">
          {filteredCommands.map((cmd, index) => (
            <React.Fragment key={index}>
              <CommandRow
                cmd={cmd}
                foreground={colors.foreground}
                onClick={handleMouseClick}
                onRun={handleRun}
                onEdit={handleEdit}
                onDelete={removeFromAllCommands}
              />
              {index < filteredCommands.length - 1 && (
                <Separator className="my-2" style={{ backgroundColor: `${colors.foreground}15` }} />
              )}
            </React.Fragment>
          ))}
        </div>
      </ScrollArea>
    </div>

  );
}