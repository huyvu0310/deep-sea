import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer, type WebSocket } from 'ws';
import type { ClientMessage, ServerMessage } from '../src/net/protocol';
import { WS_PATH } from '../src/net/protocol';
import { RoomRegistry } from './rooms';
import type { Room } from './room';

const PORT = Number(process.env.PORT ?? 8787);
const DIST = fileURLToPath(new URL('../dist', import.meta.url));

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.json': 'application/json; charset=utf-8',
  '.ico': 'image/x-icon',
};

/**
 * Serves the built client when one exists, so `npm run build && npm run server`
 * is a single-process deployment. In development Vite serves the client and
 * proxies the socket here.
 */
const http = createServer((req, res) => {
  if (!existsSync(DIST)) {
    res.writeHead(404).end('Run `npm run build` to serve the client from here.');
    return;
  }
  const url = (req.url ?? '/').split('?')[0] ?? '/';
  const requested = join(DIST, normalize(url).replace(/^(\.\.[/\\])+/, ''));
  const file =
    existsSync(requested) && statSync(requested).isFile() ? requested : join(DIST, 'index.html');

  res.writeHead(200, { 'content-type': MIME[extname(file)] ?? 'application/octet-stream' });
  createReadStream(file).pipe(res);
});

const registry = new RoomRegistry();
const wss = new WebSocketServer({ server: http, path: WS_PATH });

/** Which room each socket is sitting in, so disconnects can be cleaned up. */
const seating = new Map<WebSocket, { room: Room; seatId: string }>();

function send(socket: WebSocket, message: ServerMessage): void {
  if (socket.readyState === 1) socket.send(JSON.stringify(message));
}

function fail(socket: WebSocket, err: unknown): void {
  send(socket, {
    type: 'error',
    message: err instanceof Error ? err.message : 'Something went wrong',
  });
}

function seat(socket: WebSocket, room: Room, id: string, token: string): void {
  seating.set(socket, { room, seatId: id });
  send(socket, { type: 'seated', code: room.code, token, seatId: id });
  room.broadcast();
}

function handle(socket: WebSocket, message: ClientMessage): void {
  const current = seating.get(socket);

  switch (message.type) {
    case 'create': {
      const room = registry.create();
      const created = room.join(message.name, socket);
      seat(socket, room, created.id, created.token);
      return;
    }
    case 'join': {
      const room = registry.get(message.code);
      if (!room) throw new Error(`No table with code ${message.code.toUpperCase()}`);
      const joined = room.join(message.name, socket);
      seat(socket, room, joined.id, joined.token);
      return;
    }
    case 'resume': {
      const room = registry.get(message.code);
      if (!room) throw new Error('That table has closed');
      const resumed = room.resume(message.token, socket);
      seat(socket, room, resumed.id, resumed.token);
      return;
    }
    case 'start': {
      if (!current) throw new Error('You are not at a table');
      current.room.start(message.seed, current.seatId);
      current.room.broadcast();
      return;
    }
    case 'action': {
      if (!current) throw new Error('You are not at a table');
      current.room.apply(current.seatId, message.action);
      current.room.broadcast();
      return;
    }
    case 'leave': {
      if (!current) return;
      current.room.disconnect(socket);
      seating.delete(socket);
      current.room.broadcast();
      registry.prune();
      return;
    }
  }
}

wss.on('connection', (socket) => {
  socket.on('message', (raw) => {
    try {
      handle(socket, JSON.parse(raw.toString()) as ClientMessage);
    } catch (err) {
      fail(socket, err);
    }
  });

  socket.on('close', () => {
    const current = seating.get(socket);
    if (!current) return;
    current.room.disconnect(socket);
    seating.delete(socket);
    current.room.broadcast();
    registry.prune();
  });
});

http.listen(PORT, () => {
  console.log(`Deep Sea Adventure server listening on http://localhost:${PORT}${WS_PATH}`);
});
