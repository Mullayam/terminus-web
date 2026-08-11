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

type Tables = {
    all_commands: EntityTable<{
        name: string,
        command: string,
    }, "command">
    hosts: EntityTable<HostsObject, "id">
    session_themes: EntityTable<SessionThemeRecord, "sessionId">
    shell_history: EntityTable<ShellHistoryRecord, "host">
}
const tables: CreatePKTableSchema<Tables> = {
    all_commands: "++command",
    hosts: "++id,host",
    session_themes: "++sessionId",
    shell_history: "++host"
}
export const idb = new IDB<Tables>(tables, IDB_NAME, 4)

