import React, { useState, useEffect, useRef } from 'react';
// import { debounce } from 'lodash'; // or write your own
import { Skeleton } from '@/components/ui/skeleton';
import { Pencil } from 'lucide-react';

interface Props {
    currentPath: string;
    loading: boolean;
    handleSetCurrentDir: (path: string) => void;
    fetchFolderSuggestions: (path: string) => Promise<string[]>; // you provide this
}

export default function PathBreadcrumb({
    currentPath,
    loading,
    handleSetCurrentDir,
    fetchFolderSuggestions
}: Props) {
    const [editMode, setEditMode] = useState(false);
    const [tempPath, setTempPath] = useState(currentPath);
    const [suggestions, setSuggestions] = useState<string[]>([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    const splitedPath = currentPath.split('/').filter(Boolean);

    // Debounced fetch
    const debouncedFetchSuggestions = useRef(
        // debounce(
        async (query: string) => {
            if (!query) return;
            const results = await fetchFolderSuggestions(query);
            setSuggestions(results);
            setShowSuggestions(true);
        }
        // , 300)
    ).current;

    useEffect(() => {
        if (editMode && tempPath) {
            debouncedFetchSuggestions(tempPath);
        }
    }, [tempPath, editMode]);

    const handleDoubleClick = () => {
        setTempPath(currentPath);
        setEditMode(true);
        setTimeout(() => inputRef.current?.focus(), 0);
    };

    const handleInputBlur = () => {
        setTimeout(() => {
            setEditMode(false);
            setShowSuggestions(false);
            handleSetCurrentDir(tempPath);
        }, 100); // delay to allow click on suggestion
    };

    const handleSuggestionClick = (folder: string) => {
        setTempPath(folder);
        setEditMode(false);
        setShowSuggestions(false);
        handleSetCurrentDir(folder);
    };

    const handleInputKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleSetCurrentDir(tempPath);
            setEditMode(false);
            setShowSuggestions(false);
        }
    };

    return (
        <div className="relative">

            <div className="flex items-center space-x-1 text-sm text-muted-foreground">
                {!loading ? (
                    editMode ? (
                        <input
                            ref={inputRef}
                            value={tempPath}
                            onChange={(e) => setTempPath(e.target.value)}
                            onBlur={handleInputBlur}
                            onKeyDown={handleInputKeyDown}
                            className="border px-2 py-1 rounded w-96 text-green-600 bg-background"
                        />
                    ) :
                        <div className='flex items-center  justify-center gap-4'>
                            <div>
                                {
                                    splitedPath.map((item: string, index: number) => {
                                        const fullPath = splitedPath.slice(0, index + 1).join('/');
                                        return (
                                            <React.Fragment key={fullPath}>
                                                <span
                                                    onClick={() => handleSetCurrentDir(`/${fullPath}`)}

                                                    className={`hover:underline cursor-pointer hover:text-green-600 ${index === splitedPath.length - 1 ? 'font-semibold text-green-400' : ''
                                                        }`}
                                                >
                                                    {item}
                                                </span>
                                                {'/'}

                                            </React.Fragment>
                                        );
                                    })
                                }
                            </div>

                            <Pencil
                                onClick={() => handleDoubleClick()}
                                className="cursor-pointer items-baseline hover:text-green-600 w-4 h-4"
                            />
                        </div>
                ) : (
                    <Skeleton className="h-6 w-96 bg-gray-400" />
                )}
            </div>

            {/* Autocomplete Suggestions */}
            {editMode && showSuggestions && suggestions.length > 0 && (
                <div className="absolute z-50 mt-1 w-96 bg-neutral-600 shadow-md rounded border border-gray-300 max-h-60 overflow-y-auto">
                    {suggestions.map((suggestion) => (
                        <div
                            key={suggestion}
                            onClick={() => handleSuggestionClick(suggestion)}
                            className="px-3 py-2 hover:bg-green-100 cursor-pointer"
                        >
                            {suggestion}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
