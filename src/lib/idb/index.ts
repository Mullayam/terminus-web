const IDB_NAME = 'terminus-web-idb';
import { HostsObject } from '@/pages';
import { IDB } from './db-ops'
import { CreatePKTableSchema } from '@enjoys/react-api/idb'
import { EntityTable } from 'dexie';

export interface SessionThemeRecord {
    sessionId: string;
    theme: string;
}

export interface ShellHistoryRecord {
    host: string;
    commands: string[];
}

export interface WidgetAlert {
    /** Comparison against the extracted numeric value, or 'match' for a regex on raw output. */
    op: '>' | '<' | '>=' | '<=' | '==' | 'match';
    /** Numeric threshold (used by the numeric operators). */
    value?: number;
    /** Regex tested against raw output (used when op === 'match'). */
    pattern?: string;
    /** Fire a desktop notification when the alert trips. */
    notify?: boolean;
    /** Play a short beep when the alert trips. */
    sound?: boolean;
}

export interface WidgetRecord {
    id: string;
    name: string;
    description?: string;
    command: string;
    refreshMs: number;
    render: 'raw' | 'table' | 'sparkline' | 'gauge';
    delimiter?: string;
    columns?: string[];
    maxRows?: number;
    accent?: string;
    builtin?: boolean;
    createdAt: number;
    /** Log/tail mode: poll a bounded snapshot (e.g. `docker logs --tail 200`) and auto-scroll to newest. */
    stream?: boolean;
    /** Regex used to extract a numeric value for sparkline/gauge/alerts. First capture group or first match wins. */
    valuePattern?: string;
    /** Full-scale value for gauge rendering (value/gaugeMax = fill). Defaults to 100. */
    gaugeMax?: number;
    /** Display unit appended to sparkline/gauge values (e.g. "%", "MB"). */
    unit?: string;
    /** Threshold alert configuration. */
    alert?: WidgetAlert;
    /** Render inside the dashboard grid instead of as a floating panel. */
    docked?: boolean;
}

type Tables = {
    all_commands: EntityTable<{
        name: string,
        command: string,
    }, "command">
    hosts: EntityTable<HostsObject, "id">
    session_themes: EntityTable<SessionThemeRecord, "sessionId">
    shell_history: EntityTable<ShellHistoryRecord, "host">
    widgets: EntityTable<WidgetRecord, "id">
}
const tables: CreatePKTableSchema<Tables> = {
    all_commands: "++command",
    hosts: "++id,host",
    session_themes: "++sessionId",
    shell_history: "++host",
    widgets: "id"
}
export const idb = new IDB<Tables>(tables, IDB_NAME, 7, [
    // v5: drop `session_themes`. Its primary key was changed in-place from
    // `sessionId` to `++sessionId`, which Dexie cannot migrate and made the
    // whole DB fail to open (DatabaseClosedError → hosts stopped storing/showing).
    // The store is recreated fresh at the current version; cached themes are
    // regenerable, while all other tables (hosts, etc.) are preserved.
    {
        version: 5,
        stores: {
            all_commands: "++command",
            hosts: "++id,host",
            shell_history: "++host",
            session_themes: null,
        },
    },
])

