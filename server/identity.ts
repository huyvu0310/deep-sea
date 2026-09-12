import { createHash, randomBytes, randomUUID } from 'node:crypto';
import type { PlayerIdentity } from '../src/net/protocol';
import { query } from './db';

/** How long a browser keeps the same identity without playing. */
const IDENTITY_DAYS = 90;

export const MAX_NAME = 16;

/**
 * The token a browser keeps is a bearer credential: whoever holds it is that
 * player. Only its hash is stored, so a copy of the table does not let anyone
 * take someone else's chair.
 */
function fingerprint(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function cleanName(name: string): string {
  const trimmed = name.trim().slice(0, MAX_NAME);
  if (!trimmed) throw new Error('Give the other divers a name to call you');
  return trimmed;
}

/**
 * Give this browser an identity. No password is asked for and none is set:
 * the point is to know which chairs belong to whom across a restart, not to
 * put a gate in front of the game. Names need not be unique — two divers may
 * both be Ama, and the id is what tells them apart.
 */
export async function createPlayer(
  name: string,
): Promise<{ player: PlayerIdentity; token: string }> {
  const id = randomUUID();
  const clean = cleanName(name);

  await query('insert into users (id, username) values ($1, $2)', [id, clean]);
  const token = randomBytes(32).toString('base64url');
  await query(
    `insert into sessions (token_hash, user_id, expires_at)
     values ($1, $2, now() + ($3 || ' days')::interval)`,
    [fingerprint(token), id, String(IDENTITY_DAYS)],
  );

  return { player: { id, name: clean }, token };
}

/** The player behind a token, or null if it is unknown or long expired. */
export async function playerForToken(token: string): Promise<PlayerIdentity | null> {
  if (!token) return null;
  const rows = await query<{ id: string; username: string }>(
    `select u.id, u.username
       from sessions s
       join users u on u.id = s.user_id
      where s.token_hash = $1 and s.expires_at > now()`,
    [fingerprint(token)],
  );
  const row = rows[0];
  return row ? { id: row.id, name: row.username } : null;
}

/**
 * Change the name this player dives under. Their chairs are unaffected: a seat
 * belongs to the identity, not to what it happens to be called.
 */
export async function renamePlayer(id: string, name: string): Promise<PlayerIdentity> {
  const clean = cleanName(name);
  await query('update users set username = $2 where id = $1', [id, clean]);
  return { id, name: clean };
}

/** Keep an active player's token alive, so a regular is never timed out. */
export async function touchPlayer(token: string): Promise<void> {
  await query(
    `update sessions set expires_at = now() + ($2 || ' days')::interval
      where token_hash = $1`,
    [fingerprint(token), String(IDENTITY_DAYS)],
  );
}

/** Let go of this browser's identity, so the next name starts a new player. */
export async function forgetPlayer(token: string): Promise<void> {
  await query('delete from sessions where token_hash = $1', [fingerprint(token)]);
}
