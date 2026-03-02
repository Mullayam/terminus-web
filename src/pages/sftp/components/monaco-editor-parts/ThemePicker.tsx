/**
 * Theme picker dropdown for the Monaco editor page.
 * Shows ALL themes from `monaco-themes` + built-in custom themes.
 * Features: search filter, dark/light category tabs, color preview dots.
 *
 * Pure presentational — safe to React.memo.
 */
import React, { useRef, useState, useMemo } from "react";
import { Palette, Check, Search, Sun, Moon } from "lucide-react";
import { BUILT_IN_THEMES } from "@/modules/monaco-editor/themes";
import {
    getAllThemeDisplayInfo,
    type ThemeDisplayInfo,
} from "@/modules/monaco-editor/themes/monaco-themes-catalog";

/* ── Build unified theme list (built-ins first, then package themes) ── */

function buildThemeList(): ThemeDisplayInfo[] {
    // Built-in custom themes
    const builtIn: ThemeDisplayInfo[] = BUILT_IN_THEMES.map((t) => ({
        id: t.id,
        name: t.name,
        isDark: t.base === "vs-dark" || t.base === "hc-black",
        displayColors: [
            t.colors["editor.background"] ?? "#1e1e1e",
            t.colors["editor.foreground"] ?? "#d4d4d4",
            t.colors["editorCursor.foreground"] ?? "#569cd6",
        ],
    }));

    // Add VS Dark / VS Light built-ins
    builtIn.push({
        id: "vs-dark",
        name: "VS Dark (Default)",
        isDark: true,
        displayColors: ["#1e1e1e", "#d4d4d4", "#569cd6"],
    });
    builtIn.push({
        id: "vs",
        name: "VS Light (Default)",
        isDark: false,
        displayColors: ["#ffffff", "#000000", "#0000ff"],
    });

    // monaco-themes package themes
    const packageThemes = getAllThemeDisplayInfo();

    // Merge: built-in IDs win over package duplicates
    const seenIds = new Set(builtIn.map((t) => t.id));
    const merged = [...builtIn];
    for (const t of packageThemes) {
        if (!seenIds.has(t.id)) {
            seenIds.add(t.id);
            merged.push(t);
        }
    }
    return merged;
}

let _cachedList: ThemeDisplayInfo[] | null = null;
function getThemeList(): ThemeDisplayInfo[] {
    if (!_cachedList) _cachedList = buildThemeList();
    return _cachedList;
}

/* ── Exported type & constant ─────────────────────────────── */

export type ThemeId = string;

export const MONACO_THEMES = getThemeList();

/* ── Component ────────────────────────────────────────────── */

type CategoryFilter = "all" | "dark" | "light";

interface ThemePickerProps {
    themeId: ThemeId;
    open: boolean;
    onToggle: () => void;
    onSelect: (id: ThemeId) => void;
}

function ThemePickerInner({ themeId, open, onToggle, onSelect }: ThemePickerProps) {
    const btnRef = useRef<HTMLButtonElement>(null);
    const [search, setSearch] = useState("");
    const [category, setCategory] = useState<CategoryFilter>("all");

    const themes = getThemeList();

    const filtered = useMemo(() => {
        let list = themes;
        if (category === "dark") list = list.filter((t) => t.isDark);
        if (category === "light") list = list.filter((t) => !t.isDark);
        if (search.trim()) {
            const q = search.trim().toLowerCase();
            list = list.filter((t) => t.name.toLowerCase().includes(q) || t.id.toLowerCase().includes(q));
        }
        return list;
    }, [themes, search, category]);

    return (
        <div className="relative">
            <button
                ref={btnRef}
                onClick={onToggle}
                title="Change theme"
                className="p-1.5 rounded-md transition-colors"
                style={{
                    color: open ? "#d4d4d4" : "#808080",
                    background: open ? "#3c3c3c" : "transparent",
                }}
            >
                <Palette className="w-3.5 h-3.5" />
            </button>

            {open && (() => {
                const btnRect = btnRef.current?.getBoundingClientRect();
                const dropdownTop = btnRect ? btnRect.bottom + 4 : 40;
                const dropdownRight = btnRect ? window.innerWidth - btnRect.right : 8;
                return (
                    <div
                        className="fixed z-[9999] w-64 rounded-lg shadow-2xl shadow-black/50 bg-[#252526] border border-[#3c3c3c] flex flex-col"
                        style={{ top: dropdownTop, right: dropdownRight, maxHeight: "min(420px, 70vh)" }}
                    >
                        {/* Search */}
                        <div className="px-2 pt-2 pb-1 shrink-0">
                            <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-[#3c3c3c] border border-[#505050]">
                                <Search className="w-3 h-3 text-gray-400 shrink-0" />
                                <input
                                    autoFocus
                                    type="text"
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    placeholder="Search themes…"
                                    className="bg-transparent text-[12px] text-gray-200 placeholder-gray-500 outline-none w-full"
                                />
                            </div>
                        </div>

                        {/* Category tabs */}
                        <div className="flex items-center gap-0.5 px-2 pb-1 shrink-0">
                            {(["all", "dark", "light"] as const).map((cat) => (
                                <button
                                    key={cat}
                                    onClick={() => setCategory(cat)}
                                    className="flex items-center gap-1 px-2 py-0.5 rounded text-[11px] transition-colors"
                                    style={{
                                        background: category === cat ? "#3c3c3c" : "transparent",
                                        color: category === cat ? "#d4d4d4" : "#808080",
                                    }}
                                >
                                    {cat === "dark" && <Moon className="w-2.5 h-2.5" />}
                                    {cat === "light" && <Sun className="w-2.5 h-2.5" />}
                                    {cat.charAt(0).toUpperCase() + cat.slice(1)}
                                </button>
                            ))}
                            <span className="ml-auto text-[10px] text-gray-500">{filtered.length}</span>
                        </div>

                        {/* Theme list */}
                        <div className="overflow-y-auto flex-1 px-1.5 pb-1.5">
                            {filtered.length === 0 ? (
                                <p className="text-center text-[11px] text-gray-500 py-4">No themes found</p>
                            ) : (
                                filtered.map((t) => {
                                    const isActive = t.id === themeId;
                                    return (
                                        <button
                                            key={t.id}
                                            onClick={() => onSelect(t.id)}
                                            className="w-full flex items-center gap-2 px-2 py-1 rounded-md text-[12px] transition-colors"
                                            style={{
                                                color: isActive ? "#d4d4d4" : "#808080",
                                                background: isActive ? "#3c3c3c" : "transparent",
                                            }}
                                            onMouseEnter={(e) => {
                                                e.currentTarget.style.background = "#3c3c3c";
                                                e.currentTarget.style.color = "#d4d4d4";
                                            }}
                                            onMouseLeave={(e) => {
                                                if (!isActive) {
                                                    e.currentTarget.style.background = "transparent";
                                                    e.currentTarget.style.color = "#808080";
                                                }
                                            }}
                                        >
                                            <span className="flex gap-0.5 shrink-0">
                                                {t.displayColors.map((c, i) => (
                                                    <span
                                                        key={i}
                                                        className="w-2.5 h-2.5 rounded-full border border-black/20"
                                                        style={{ background: c }}
                                                    />
                                                ))}
                                            </span>
                                            <span className="flex-1 text-left truncate">{t.name}</span>
                                            {isActive && (
                                                <Check className="w-3.5 h-3.5 shrink-0 text-blue-400" />
                                            )}
                                        </button>
                                    );
                                })
                            )}
                        </div>
                    </div>
                );
            })()}

            {/* Backdrop to close */}
            {open && (
                <div
                    className="fixed inset-0 z-[9998]"
                    onClick={onToggle}
                />
            )}
        </div>
    );
}

export const ThemePicker = React.memo(ThemePickerInner);
