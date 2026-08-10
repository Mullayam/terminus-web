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
    // Index of the highlighted suggestion during keyboard navigation (-1 = none)
    const [activeIndex, setActiveIndex] = useState(-1);
    const inputRef = useRef<HTMLInputElement>(null);
    const itemRefs = useRef<(HTMLDivElement | null)[]>([]);

    const splitedPath = currentPath.split('/').filter(Boolean);

    // Keep a stable ref to the latest fetchFolderSuggestions so the
    // debounced callback never captures a stale closure.
    const fetchRef = useRef(fetchFolderSuggestions);
    fetchRef.current = fetchFolderSuggestions;

    const debouncedFetchSuggestions = useRef(
        async (query: string) => {
            if (!query) return;
            const results = await fetchRef.current(query);
            setSuggestions(results);
            setShowSuggestions(true);
        }
    ).current;

    useEffect(() => {
        if (editMode && tempPath) {
            debouncedFetchSuggestions(tempPath);
        }
    }, [tempPath, editMode]);

    // Reset the highlight whenever the suggestion list changes
    useEffect(() => {
        setActiveIndex(-1);
    }, [suggestions]);

    // Keep the highlighted suggestion visible while navigating with the keyboard
    useEffect(() => {
        if (activeIndex >= 0) {
            itemRefs.current[activeIndex]?.scrollIntoView({ block: 'nearest' });
        }
    }, [activeIndex]);

    const handleDoubleClick = () => {
        setTempPath(currentPath);
        setEditMode(true);
        setTimeout(() => inputRef.current?.focus(), 0);
    };

    const handleInputBlur = () => {
        setTimeout(() => {
            setEditMode(false);
            setShowSuggestions(false);
            // Only navigate if the path actually changed
            if (tempPath !== currentPath) {
                handleSetCurrentDir(tempPath);
            }
        }, 100); // delay to allow click on suggestion
    };

    const handleSuggestionClick = (folder: string) => {
        setTempPath(folder);
        setEditMode(false);
        setShowSuggestions(false);
        handleSetCurrentDir(folder);
    };

    const handleInputKeyDown = (e: React.KeyboardEvent) => {
        const hasSuggestions = showSuggestions && suggestions.length > 0;

        if (e.key === 'ArrowDown' && hasSuggestions) {
            e.preventDefault();
            setActiveIndex((i) => (i + 1) % suggestions.length);
        } else if (e.key === 'ArrowUp' && hasSuggestions) {
            e.preventDefault();
            setActiveIndex((i) => (i <= 0 ? suggestions.length - 1 : i - 1));
        } else if (e.key === 'Enter') {
            e.preventDefault();
            const target = activeIndex >= 0 ? suggestions[activeIndex] : tempPath;
            handleSetCurrentDir(target);
            setEditMode(false);
            setShowSuggestions(false);
        } else if (e.key === 'Escape') {
            e.preventDefault();
            setShowSuggestions(false);
            setActiveIndex(-1);
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
                            className="border px-2 py-1 font-mono whitespace-nowrap rounded w-96 text-green-600 bg-background "
                        />
                    ) :
                        <div className='flex items-center  justify-center gap-4'>
                            <div className='border p-1 bg-[#2a2b36] rounded-lg font-mono whitespace-nowrap '>
                                {
                                    splitedPath.map((item: string, index: number) => {
                                        const fullPath = splitedPath.slice(0, index + 1).join('/');
                                        return (
                                            <React.Fragment key={fullPath}>
                                                <span
                                                    onClick={() => handleSetCurrentDir(`/${fullPath}`)}
                                                    className={`hover:underline cursor-pointer   hover:text-green-600 ${index === splitedPath.length - 1 ? 'font-semibold text-green-400' : ''
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
                <div className="scrollbar-green absolute z-50 mt-1 w-96 bg-[#1a1b26] border border-[#2c2d3c] rounded-lg text-green-400 p-2 max-h-60 overflow-y-auto">
                    {suggestions.map((suggestion, index) => (
                        <div
                            key={suggestion}
                            ref={(el) => (itemRefs.current[index] = el)}
                            onClick={() => handleSuggestionClick(suggestion)}
                            onMouseEnter={() => setActiveIndex(index)}
                            className={`group flex justify-between items-center font-mono whitespace-nowrap overflow-hidden px-2 py-1 rounded text-xs transition-colors duration-150 border-b border-[#2a2b36] last:border-b-0 cursor-pointer ${index === activeIndex
                                ? 'bg-[#2a2b36] text-green-300'
                                : 'text-green-400 hover:bg-[#2a2b36] hover:text-green-300'
                                }`}
                        >
                            {suggestion}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
