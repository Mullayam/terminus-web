import type { FormValues } from './TerminalTab';

/**
 * In-memory cache of the last connect payload per SSH session. Used to spawn a
 * fresh shell on reconnect and to open the tab's Files (SFTP) view with the
 * same login. Kept out of every persisted store so credentials never touch
 * localStorage — it is empty again after a page reload.
 */
export const connectPayloads = new Map<string, FormValues>();
