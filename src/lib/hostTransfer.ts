import { v4 as uuidv4 } from 'uuid';
import type { HostsObject } from '@/pages';

/**
 * Portable import/export of saved SSH/SFTP hosts.
 *
 * Export format is a JSON envelope encoded as Base64 (UTF-8 safe) so it can be
 * copied/pasted as a single opaque string. Import also accepts raw JSON (an
 * envelope, a bare array of hosts, or a single host object) for flexibility.
 *
 * NOTE: Base64 is encoding, NOT encryption. The payload can contain passwords
 * and private keys in readable form once decoded — treat exports as secrets.
 */

const MAGIC = 'terminus-web';
const EXPORT_TYPE = 'hosts-export';
const EXPORT_VERSION = 1;

export interface HostsExportEnvelope {
    app: string;
    type: string;
    version: number;
    exportedAt: string;
    count: number;
    hosts: HostsObject[];
}

/* ── UTF-8 safe Base64 ─────────────────────────────────────── */

function toBase64(str: string): string {
    const bytes = new TextEncoder().encode(str);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary);
}

function fromBase64(b64: string): string {
    const binary = atob(b64.replace(/\s+/g, ''));
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new TextDecoder().decode(bytes);
}

/* ── Export ────────────────────────────────────────────────── */

/** Build the JSON envelope for a set of hosts. */
export function buildHostsEnvelope(hosts: HostsObject[]): HostsExportEnvelope {
    return {
        app: MAGIC,
        type: EXPORT_TYPE,
        version: EXPORT_VERSION,
        exportedAt: new Date().toISOString(),
        count: hosts.length,
        hosts,
    };
}

/** Serialize hosts to the copy-paste friendly Base64 string. */
export function encodeHosts(hosts: HostsObject[]): string {
    return toBase64(JSON.stringify(buildHostsEnvelope(hosts)));
}

/** Serialize hosts to a pretty JSON string (for the .json download). */
export function encodeHostsJson(hosts: HostsObject[]): string {
    return JSON.stringify(buildHostsEnvelope(hosts), null, 2);
}

/* ── Import ────────────────────────────────────────────────── */

function normalizeHost(raw: Record<string, unknown>): HostsObject | null {
    const host = typeof raw.host === 'string' ? raw.host.trim() : '';
    const username = typeof raw.username === 'string' ? raw.username.trim() : '';
    if (!host || !username) return null;

    const authMethod = raw.authMethod === 'privateKey' ? 'privateKey' : 'password';
    const portNum = Number(raw.port);

    return {
        id: uuidv4(),
        host,
        port: Number.isFinite(portNum) && portNum > 0 ? portNum : 22,
        username,
        authMethod,
        password: typeof raw.password === 'string' ? raw.password : '',
        privateKeyText: typeof raw.privateKeyText === 'string' ? raw.privateKeyText : '',
        localName: typeof raw.localName === 'string' ? raw.localName : '',
        saveCredentials: true,
    };
}

/** Extract a hosts array from any accepted parsed shape. */
function extractHosts(parsed: unknown): unknown[] {
    if (Array.isArray(parsed)) return parsed;
    if (parsed && typeof parsed === 'object') {
        const obj = parsed as Record<string, unknown>;
        if (Array.isArray(obj.hosts)) return obj.hosts;
        // A single bare host object
        if (typeof obj.host === 'string') return [obj];
    }
    return [];
}

/**
 * Decode a pasted string (Base64 envelope, raw JSON envelope, JSON array, or a
 * single host object) into validated hosts. Throws on unrecoverable input.
 */
export function decodeHosts(input: string): HostsObject[] {
    const trimmed = input.trim();
    if (!trimmed) throw new Error('Nothing to import — paste an export string first.');

    let parsed: unknown;
    const looksLikeJson = trimmed.startsWith('{') || trimmed.startsWith('[');
    try {
        parsed = JSON.parse(looksLikeJson ? trimmed : fromBase64(trimmed));
    } catch {
        // Fall back to the other decoder before giving up.
        try {
            parsed = JSON.parse(looksLikeJson ? fromBase64(trimmed) : trimmed);
        } catch {
            throw new Error('Invalid data — expected a Terminus hosts export string.');
        }
    }

    const rawHosts = extractHosts(parsed);
    const hosts = rawHosts
        .filter((h): h is Record<string, unknown> => !!h && typeof h === 'object')
        .map(normalizeHost)
        .filter((h): h is HostsObject => h !== null);

    if (hosts.length === 0) {
        throw new Error('No valid hosts found in the imported data.');
    }
    return hosts;
}

/** Stable identity for de-duplication (ignores the generated id). */
export function hostSignature(h: Pick<HostsObject, 'host' | 'port' | 'username' | 'authMethod'>): string {
    return `${(h.host || '').toLowerCase()}|${h.port ?? 22}|${(h.username || '').toLowerCase()}|${h.authMethod}`;
}

/**
 * Filter out hosts that already exist (same host+port+username+authMethod).
 * Returns the new hosts to persist plus how many duplicates were skipped.
 */
export function dedupeAgainst(
    incoming: HostsObject[],
    existing: HostsObject[],
): { toAdd: HostsObject[]; skipped: number } {
    const seen = new Set(existing.map(hostSignature));
    const toAdd: HostsObject[] = [];
    let skipped = 0;
    for (const h of incoming) {
        const sig = hostSignature(h);
        if (seen.has(sig)) {
            skipped++;
            continue;
        }
        seen.add(sig);
        toAdd.push(h);
    }
    return { toAdd, skipped };
}
