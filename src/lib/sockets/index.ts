import { io, Socket } from 'socket.io-client';
import { __config } from '../config';

/**
 * Global / fallback socket — lazily connected.
 * Uses `forceNew` so it never hijacks the Manager cache
 * used by per-tab SFTP or SSH sockets.
 */
let _socket: Socket | null = null;

export function getGlobalSocket(): Socket {
  if (!_socket) {
    _socket = io(__config.API_URL, {
      forceNew: true,
      autoConnect: true,
    });
  }
  return _socket;
}

/** @deprecated — prefer getGlobalSocket() for lazy init */
export const socket = io(__config.API_URL, {
  forceNew: true,
  autoConnect: false,   // don't connect until actually needed
});
