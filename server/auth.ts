import { createHash, randomBytes, randomUUID, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import type { AuthUser } from '../src/net/protocol';
import { query } from './db';

const scryptAsync = promisify(scrypt) as (
  password: string,
  salt: Buffer,
  keylen: number,
) => Promise<Buffer>;

/** How long a signed-in browser stays signed in. */
const SESSION_DAYS = 30;
const KEY_LENGTH = 64;

export const USERNAME_RULE = /^[a-zA-Z0-9_-]{3,16}$/;
export const MIN_PASSWORD = 8;

/** Postgres raises this when a unique index is violated. */
const UNIQUE_VIOLATION = '23505';

/**
 * A stored password is `salt:key`, both hex. scrypt is in Node's standard
 * library, so this adds no native dependency to the build — which matters when
 * the server is bundled by esbuild and installed fresh on each deploy.
 */
async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scryptAsync(password, salt, KEY_LENGTH);
  return `${salt.toString('hex')}:${key.toString('hex')}`;
}

async function passwordMatches(password: string, stored: string): Promise<boolean> {
  const [saltHex, keyHex] = stored.split(':');
  if (!saltHex || !keyHex) return false;
  const expected = Buffer.from(keyHex, 'hex');
  const actual = await scryptAsync(password, Buffer.from(saltHex, 'hex'), expected.length);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

/**
 * Sessions are bearer tokens: whoever holds one is the account. Only the hash
 * is stored, so a copy of the table does not let anyone sign in as its owners.
 */
function fingerprint(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

async function issueSession(userId: string): Promise<string> {
  const token = randomBytes(32).toString('base64url');
  await query(
    `insert into sessions (token_hash, user_id, expires_at)
     values ($1, $2, now() + ($3 || ' days')::interval)`,
    [fingerprint(token), userId, String(SESSION_DAYS)],
  );
  return token;
}

function validate(username: string, password: string): void {
  if (!USERNAME_RULE.test(username)) {
    throw new Error('Username must be 3-16 letters, numbers, dashes or underscores');
  }
  if (password.length < MIN_PASSWORD) {
    throw new Error(`Password must be at least ${MIN_PASSWORD} characters`);
  }
}

export async function signUp(
  username: string,
  password: string,
): Promise<{ account: AuthUser; token: string }> {
  validate(username, password);

  const id = randomUUID();
  try {
    await query('insert into users (id, username, password_hash) values ($1, $2, $3)', [
      id,
      username,
      await hashPassword(password),
    ]);
  } catch (err) {
    if ((err as { code?: string }).code === UNIQUE_VIOLATION) {
      throw new Error('That username is taken');
    }
    throw err;
  }

  return { account: { id, username }, token: await issueSession(id) };
}

export async function signIn(
  username: string,
  password: string,
): Promise<{ account: AuthUser; token: string }> {
  const rows = await query<{ id: string; username: string; password_hash: string }>(
    'select id, username, password_hash from users where lower(username) = lower($1)',
    [username],
  );

  // The same message either way, so the form cannot be used to discover which
  // usernames exist.
  const wrong = new Error('Wrong username or password');
  const row = rows[0];
  if (!row || !(await passwordMatches(password, row.password_hash))) throw wrong;

  return {
    account: { id: row.id, username: row.username },
    token: await issueSession(row.id),
  };
}

/** The account behind a session token, or null if it is unknown or expired. */
export async function accountForSession(token: string): Promise<AuthUser | null> {
  if (!token) return null;
  const rows = await query<{ id: string; username: string }>(
    `select u.id, u.username
       from sessions s
       join users u on u.id = s.user_id
      where s.token_hash = $1 and s.expires_at > now()`,
    [fingerprint(token)],
  );
  return rows[0] ?? null;
}

export async function signOut(token: string): Promise<void> {
  await query('delete from sessions where token_hash = $1', [fingerprint(token)]);
}
