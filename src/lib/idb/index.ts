/* eslint-disable @typescript-eslint/no-explicit-any */
import { openDB, IDBPDatabase } from 'idb';

const IDB_NAME = 'terminus-web-idb';
const STORE_NAME = 'myStore';
import { HostsObject } from '@/pages';
import { IDB } from './db-ops'
import { CreatePKTableSchema } from '@enjoys/react-api/idb'
import { EntityTable } from 'dexie';

export interface SessionThemeRecord {
    sessionId: string;
    theme: string;
}

type Tables = {
    all_commands: EntityTable<{
        name: string,
        command: string,
    }, "command">
    hosts: EntityTable<HostsObject, "id">
    session_themes: EntityTable<SessionThemeRecord, "sessionId">
}
const tables: CreatePKTableSchema<Tables> = {
    all_commands: "++command",
    hosts: "++id,host",
    session_themes: "sessionId"
}
export const idb = new IDB<Tables>(tables, IDB_NAME, 3)

