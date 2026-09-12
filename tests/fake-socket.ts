import type { WebSocket } from 'ws';
import type { ServerMessage } from '../src/net/protocol';

/** Stand-in socket that just records what the room sent it. */
export function fakeSocket() {
  const sent: ServerMessage[] = [];
  const socket = {
    readyState: 1,
    send: (raw: string) => sent.push(JSON.parse(raw) as ServerMessage),
    close: () => {},
  };
  return { socket: socket as unknown as WebSocket, sent };
}
