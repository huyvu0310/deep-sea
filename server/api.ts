import type { IncomingMessage, ServerResponse } from 'node:http';
import { accountForSession, signIn, signOut, signUp } from './auth';
import { dbEnabled } from './db';
import { originAllowed } from './origins';
import { activeRoomForUser } from './store';

const API_PREFIX = '/api/';

/** Credentials are small; anything larger is not a sign-in attempt. */
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
 * Handle an account request. Returns false when the path is not ours, so the
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
    json(res, 503, { error: 'Accounts are not enabled on this server' });
    return true;
  }

  try {
    switch (`${req.method} ${path}`) {
      case 'POST /api/auth/signup':
      case 'POST /api/auth/login': {
        const body = await readJson(req);
        const username = text(body.username);
        const password = typeof body.password === 'string' ? body.password : '';
        const result = path.endsWith('signup')
          ? await signUp(username, password)
          : await signIn(username, password);
        json(res, 200, {
          user: result.account,
          token: result.token,
          // Signing in is exactly when someone needs to be told they left a
          // dive running, so the answer carries the table rather than making
          // the client ask a second time.
          activeRoom: await activeRoomForUser(result.account.id),
        });
        return true;
      }

      case 'POST /api/auth/logout': {
        await signOut(bearer(req));
        json(res, 200, {});
        return true;
      }

      case 'GET /api/auth/me': {
        // "Nobody" is a perfectly good answer to "who am I": every visitor asks
        // this before signing in, and that is not a failure.
        const account = await accountForSession(bearer(req));
        json(res, 200, {
          user: account,
          activeRoom: account ? await activeRoomForUser(account.id) : null,
        });
        return true;
      }

      default:
        json(res, 404, { error: 'No such endpoint' });
        return true;
    }
  } catch (err) {
    // These are all expected refusals — a taken username, a bad password, a
    // malformed body — so they are reported as such rather than as a crash.
    json(res, 400, { error: err instanceof Error ? err.message : 'Something went wrong' });
    return true;
  }
}
