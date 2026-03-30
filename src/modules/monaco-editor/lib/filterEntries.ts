/**
 * @module filterEntries
 *
 * Smart-ignore filter for directory listings.
 *
 * Performance rules applied:
 *   - "Skip heavy/unnecessary folders: node_modules, .git, dist, build"
 *   - "Only include if explicitly needed"
 *
 * Filters are applied client-side after readdir returns.
 * This keeps the provider interface simple (providers return everything)
 * while letting the UI layer enforce ignore rules.
 */
import type { FileEntry, IgnoreConfig, DEFAULT_IGNORED_NAMES } from "./file-system-types";

/**
 * Filter a list of FileEntry items according to an IgnoreConfig.
 *
 * @param entries  Raw entries from readdir
 * @param config   Ignore configuration (names, hideDotfiles, disabled)
 * @returns Filtered entries (new array — original untouched)
 */
export function filterEntries(
    entries: FileEntry[],
    config?: IgnoreConfig,
): FileEntry[] {
    if (!config || config.disabled) return entries;

    const ignoredNames = config.names;
    const hideDotfiles = config.hideDotfiles ?? false;

    return entries.filter((e) => {
        // Skip . and ..
        if (e.name === "." || e.name === "..") return false;

        // Smart ignore by exact name match
        if (ignoredNames && ignoredNames.has(e.name)) return false;

        // Dotfile hiding,, what if user wants to see dotfiles?
        // if (hideDotfiles && e.name.startsWith(".")) return false;

        return true;
    });
}

/**
 * Apply pagination (limit + offset OR cursor) to a pre-filtered listing.
 *
 * Performance rules applied:
 *   - "Load limited number of files initially"
 *   - "Load more on scroll or interaction"
 *
 * Cursor-based: if `cursor` is provided, entries after that name are returned.
 * Offset-based: standard slice(offset, offset + limit).
 * Both can coexist — cursor takes priority when present.
 *
 * @returns `{ page, total, hasMore, nextCursor }`
 */
export function paginateEntries(
    entries: FileEntry[],
    limit: number = 0,
    offset: number = 0,
    cursor?: string,
): { page: FileEntry[]; total: number; hasMore: boolean; nextCursor?: string } {
    const total = entries.length;
    if (limit <= 0) return { page: entries, total, hasMore: false };

    let startIdx = offset;

    // Cursor-based: find the entry after the cursor name
    if (cursor) {
        const cursorIdx = entries.findIndex((e) => e.name === cursor);
        if (cursorIdx >= 0) {
            startIdx = cursorIdx + 1;
        }
    }

    const page = entries.slice(startIdx, startIdx + limit);
    const hasMore = startIdx + limit < total;
    const nextCursor = page.length > 0 ? page[page.length - 1].name : undefined;
    return { page, total, hasMore, nextCursor };
}
