import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer, type WebSocket } from 'ws';
import type { AuthUser, ClientMessage, ServerMessage } from '../src/net/protocol';
import { WS_PATH } from '../src/net/protocol';
import { handleApi } from './api';
import { accountForSession } from './auth';
import { dbEnabled, migrate, sweep } from './db';
import { allowedOrigins, originAllowed } from './origins';
import { RoomRegistry } from './rooms';
import type { Room } from './room';
import { saveGame, saveRoom } from './store';

const PORT = Number(process.env.PORT ?? 8787);
const CLIENT_BUILD = fileURLToPath(new URL('../dist', import.meta.url));

/** How often expired sessions and long-abandoned tables are cleared out. */
const SWEEP_INTERVAL_MS = 60 * 60 * 1000;

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
function serve(req: IncomingMessage, res: ServerResponse): void {
  const path = (req.url ?? '/').split('?')[0] ?? '/';

  // Liveness probe for the host's health checks, answered whether or not a
  // client build sits alongside the server.
  if (path === '/healthz') {
    res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' }).end('ok');
    return;
  }

  if (!existsSync(CLIENT_BUILD)) {
    res.writeHead(404).end('No client build here - this server only runs games.');
    return;
  }
  const requested = join(CLIENT_BUILD, normalize(path).replace(/^(\.\.[/\\])+/, ''));
  const file =
    existsSync(requested) && statSync(requested).isFile()
      ? requested
      : join(CLIENT_BUILD, 'index.html');

  res.writeHead(200, { 'content-type': MIME[extname(file)] ?? 'application/octet-stream' });
  createReadStream(file).pipe(res);
}

const http = createServer((req, res) => {
  // Accounts answer first; anything else is the client build.
  handleApi(req, res)
    .then((handled) => {
      if (!handled) serve(req, res);
    })
    .catch(() => {
      if (!res.headersSent) res.writeHead(500).end('Something went wrong');
    });
});

const registry = new RoomRegistry();
const wss = new WebSocketServer({
  server: http,
  path: WS_PATH,
  verifyClient: ({ origin }: { origin: string }) => originAllowed(origin),
});

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

/**
 * Who is at the keyboard. With no database there are no accounts and a player
 * is whoever they say they are, exactly as before; with one, online play is for
 * signed-in players and the chair belongs to the account rather than to
 * whoever is holding a token.
 */
async function accountOf(session: string | undefined): Promise<AuthUser | null> {
  if (!dbEnabled) return null;
  const token = session?.trim();
  if (!token) throw new Error('Sign in to play online');
  const account = await accountForSession(token);
  if (!account) throw new Error('Your session has expired — sign in again');
  return account;
}

async function handle(socket: WebSocket, message: ClientMessage): Promise<void> {
  const current = seating.get(socket);

  switch (message.type) {
    case 'create': {
      const account = await accountOf(message.session);
      const room = await registry.create();
      const created = room.join(account?.username ?? message.name, socket, account?.id ?? null);
      seat(socket, room, created.id, created.token);
      await saveRoom(room.snapshot());
      return;
    }
    case 'join': {
      const account = await accountOf(message.session);
      const room = await registry.find(message.code);
      if (!room) throw new Error(`No table with code ${message.code.toUpperCase()}`);

      // Someone who already holds a chair here is coming back to it, however
      // they arrived. Typing the code again is not a request for a second seat,
      // and it must work after the dive has started, when joining cannot.
      const held = account ? room.seatFor(account.id) : undefined;
      const joined =
        account && held
          ? room.resumeAs(account.id, socket)
          : room.join(account?.username ?? message.name, socket, account?.id ?? null);

      seat(socket, room, joined.id, joined.token);
      await saveRoom(room.snapshot());
      return;
    }
    case 'resume': {
      const account = await accountOf(message.session);
      const room = await registry.find(message.code);
      if (!room) throw new Error('That table has closed');
      const resumed = account
        ? room.resumeAs(account.id, socket)
        : room.resume(message.token ?? '', socket);
      seat(socket, room, resumed.id, resumed.token);
      return;
    }
    case 'start': {
      if (!current) throw new Error('You are not at a table');
      current.room.start(message.seed, current.seatId);
      current.room.broadcast();
      await saveRoom(current.room.snapshot());
      return;
    }
    case 'action': {
      if (!current) throw new Error('You are not at a table');
      current.room.apply(current.seatId, message.action);
      current.room.broadcast();
      const state = current.room.state;
      if (state) await saveGame(current.room.code, state);
      return;
    }
    case 'leave': {
      if (!current) return;
      await depart(socket, current);
      return;
    }
  }
}

/** Let go of a socket's seat and write down whatever is left of the table. */
async function depart(socket: WebSocket, current: { room: Room; seatId: string }): Promise<void> {
  current.room.disconnect(socket);
  seating.delete(socket);
  current.room.broadcast();

  if (current.room.isEmpty) await registry.close(current.room.code);
  else await saveRoom(current.room.snapshot());

  registry.prune();
}

wss.on('connection', (socket) => {
  socket.on('message', (raw) => {
    void (async () => {
      try {
        await handle(socket, JSON.parse(raw.toString()) as ClientMessage);
      } catch (err) {
        fail(socket, err);
      }
    })();
  });

  socket.on('close', () => {
    const current = seating.get(socket);
    if (!current) return;
    void depart(socket, current).catch(() => {
      // A table that could not be written down is still gone from this
      // process; there is nothing useful to tell a socket that just closed.
    });
  });
});

async function boot(): Promise<void> {
  if (dbEnabled) {
    await migrate();
    await sweep();
    setInterval(() => void sweep().catch(() => {}), SWEEP_INTERVAL_MS).unref();
  }

  http.listen(PORT, () => {
    console.log(`Deep Sea Adventure server listening on port ${PORT} at ${WS_PATH}`);
    console.log(
      allowedOrigins.length > 0
        ? `Accepting sockets from: ${allowedOrigins.join(', ')}`
        : 'Accepting sockets from any origin (set ALLOWED_ORIGINS to restrict)',
    );
    console.log(
      dbEnabled
        ? 'Accounts and saved tables are on (DATABASE_URL is set)'
        : 'Running from memory only (set DATABASE_URL for accounts and saved tables)',
    );
  });
}

void boot().catch((err) => {
  console.error('Could not start:', err);
  process.exit(1);
});
