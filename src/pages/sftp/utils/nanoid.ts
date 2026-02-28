/**
 * Lightweight ID generator for SFTP sessions.
 * Produces a prefixed, URL-safe ID like "sftp_k8f3m2x9p1".
 * Independent of SSH session IDs (which use UUIDv4).
 */
const ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789';
const ID_LENGTH = 10;

function randomId(len: number): string {
  const bytes = crypto.getRandomValues(new Uint8Array(len));
  let id = '';
  for (let i = 0; i < len; i++) {
    id += ALPHABET[bytes[i] % ALPHABET.length];
  }
  return id;
}

/** Generate a unique SFTP session ID: `sftp_<random>` */
export function nanoid(): string {
  return `sftp_${randomId(ID_LENGTH)}`;
}
