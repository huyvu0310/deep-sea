import { WS_PATH } from '../net/protocol';

/**
 * Where to open the game socket.
 *
 * With the client and server on one origin — local development, or the server
 * hosting its own build — the page's own host is right, and Vite proxies /ws in
 * dev. A split deployment sets VITE_WS_URL at build time; it may be given as a
 * plain origin or a full socket URL, over either http(s) or ws(s).
 */
export function socketUrl(configured = import.meta.env.VITE_WS_URL): string {
  const target = configured?.trim();
  if (!target) {
    const scheme = location.protocol === 'https:' ? 'wss' : 'ws';
    return `${scheme}://${location.host}${WS_PATH}`;
  }

  const asSocket = target.replace(/^http(s?):/i, 'ws$1:').replace(/\/+$/, '');
  return asSocket.endsWith(WS_PATH) ? asSocket : `${asSocket}${WS_PATH}`;
}

/**
 * Where the account endpoints live: the same server as the socket, reached
 * over http. Configured from the one VITE_WS_URL rather than a second setting,
 * so a deployment cannot end up pointing its sockets and its sign-in at
 * different places.
 */
export function apiUrl(path: string, configured = import.meta.env.VITE_WS_URL): string {
  const target = configured?.trim();
  if (!target) return path;

  const origin = target
    .replace(/^ws(s?):/i, 'http$1:')
    .replace(/\/+$/, '')
    .replace(new RegExp(`${WS_PATH}$`), '');
  return `${origin}${path}`;
}
