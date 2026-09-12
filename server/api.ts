import type { IncomingMessage, ServerResponse } from 'node:http';
import { dbEnabled } from './db';
import { createPlayer, forgetPlayer, playerForToken, renamePlayer, touchPlayer } from './identity';
import { originAllowed } from './origins';
import { activeRoomForUser } from './store';

const API_PREFIX = '/api/';

/** A name is small; anything larger is not a request from this game. */
const MAX_BODY_BYTES = 4096;

function json(res: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(payload),
  });
  res.end(payload);
}

/**
 * The client is served from a different origin in a split deployment, so the
 * browser will not let it read these responses without permission. The same
 * allowlist that guards the socket guards the API.
 */
function cors(req: IncomingMessage, res: ServerResponse): boolean {
  const origin = req.headers.origin;
  if (!originAllowed(origin)) return false;

  // With no allowlist configured every origin is permitted, so echo whichever
  // asked rather than claiming a wildcard.
  res.setHeader('access-control-allow-origin', origin ?? '*');
  res.setHeader('vary', 'origin');
  res.setHeader('access-control-allow-methods', 'GET, POST, OPTIONS');
  res.setHeader('access-control-allow-headers', 'content-type, authorization');
  res.setHeader('access-control-max-age', '86400');
  return true;
}

async function readJson(req: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += (chunk as Buffer).length;
    if (size > MAX_BODY_BYTES) throw new Error('That request was too large');
    chunks.push(chunk as Buffer);
  }
  if (chunks.length === 0) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8')) as Record<string, unknown>;
  } catch {
    throw new Error('That request was not valid JSON');
  }
}

function bearer(req: IncomingMessage): string {
  const header = req.headers.authorization ?? '';
  return header.toLowerCase().startsWith('bearer ') ? header.slice(7).trim() : '';
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

/**
 * Handle an identity request. Returns false when the path is not ours, so the
 * caller can go on to serve the client build.
 */
export async function handleApi(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  const path = (req.url ?? '/').split('?')[0] ?? '/';
  if (!path.startsWith(API_PREFIX)) return false;

  if (!cors(req, res)) {
    json(res, 403, { error: 'This page is not allowed to reach the server' });
    return true;
  }

  if (req.method === 'OPTIONS') {
    res.writeHead(204).end();
    return true;
  }

  if (!dbEnabled) {
    json(res, 503, { error: 'This server keeps no record of players' });
    return true;
  }

  try {
    switch (`${req.method} ${path}`) {
      /**
       * Claim a name. A browser that already has an identity keeps it and is
       * simply renamed, so changing the name on the way into a table does not
       * cost anyone the chair they are sitting in.
       */
      case 'POST /api/player': {
        const body = await readJson(req);
        const name = text(body.name);
        const token = bearer(req);

        const existing = token ? await playerForToken(token) : null;
        if (existing) {
          const player = existing.name === name ? existing : await renamePlayer(existing.id, name);
          await touchPlayer(token);
          json(res, 200, {
            player,
            token,
            activeRoom: await activeRoomForUser(player.id),
          });
          return true;
        }

        const created = await createPlayer(name);
        json(res, 200, { player: created.player, token: created.token, activeRoom: null });
        return true;
      }

      case 'GET /api/player': {
        // "Nobody yet" is a perfectly good answer for a first-time visitor,
        // and not a failure worth colouring an error.
        const token = bearer(req);
        const player = token ? await playerForToken(token) : null;
        json(res, 200, {
          player,
          token: player ? token : null,
          activeRoom: player ? await activeRoomForUser(player.id) : null,
        });
        return true;
      }

      case 'DELETE /api/player':
      case 'POST /api/player/forget': {
        await forgetPlayer(bearer(req));
        json(res, 200, { player: null, token: null, activeRoom: null });
        return true;
      }

      default:
        json(res, 404, { error: 'No such endpoint' });
        return true;
    }
  } catch (err) {
    // These are expected refusals — an empty name, a malformed body — so they
    // are reported as such rather than as a crash.
    json(res, 400, { error: err instanceof Error ? err.message : 'Something went wrong' });
    return true;
  }
}
