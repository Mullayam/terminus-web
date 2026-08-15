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

export interface WidgetRecord {
    id: string;
    name: string;
    description?: string;
    command: string;
    refreshMs: number;
    render: 'raw' | 'table';
    delimiter?: string;
    columns?: string[];
    maxRows?: number;
    accent?: string;
    builtin?: boolean;
    createdAt: number;
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

