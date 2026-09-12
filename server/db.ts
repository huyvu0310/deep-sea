import pg from 'pg';

/**
 * The Postgres connection, when one is configured.
 *
 * `DATABASE_URL` is deliberately optional. Without it the server keeps every
 * table in memory exactly as it always has, which is what local development
 * and the test suite run against — neither should need a database standing by.
 * With it, accounts and games outlive the process.
 */
const url = process.env.DATABASE_URL?.trim();

/** A local Postgres has no certificate; a hosted one (Neon) insists on TLS. */
function needsTls(connectionString: string): boolean {
  return !/@(localhost|127\.0\.0\.1)[:/]/.test(connectionString);
}

export const pool: pg.Pool | null = url
  ? new pg.Pool({
      connectionString: url,
      // Neon's node-postgres guide asks for TLS as an explicit pool option
      // rather than relying on sslmode in the query string. `true` verifies the
      // certificate against the system roots, which Neon's is signed by.
      ...(needsTls(url) ? { ssl: true } : {}),
      // Render's free instance is single-process and Neon's free branch caps
      // connections; a small pool leaves room for other clients.
      max: 5,
      idleTimeoutMillis: 30_000,
    })
  : null;

export const dbEnabled = pool !== null;

/** Run a statement. Throws if no database is configured — guard with `dbEnabled`. */
export async function query<T extends pg.QueryResultRow = pg.QueryResultRow>(
  text: string,
  values: unknown[] = [],
): Promise<T[]> {
  if (!pool) throw new Error('No database configured');
  const result = await pool.query<T>(text, values);
  return result.rows;
}

/**
 * Bring the schema up to date. Every statement is idempotent, so this runs on
 * each boot and there is no migration tool to keep in step for a schema this
 * small. Seats cascade from both sides: closing a table clears its seats, and
 * deleting an account frees the chair it was sitting in.
 */
const SCHEMA = `
create table if not exists users (
  id uuid primary key,
  username text not null,
  -- Reserved for the day this grows real accounts. Identities issued to a
  -- browser have no password, so it stays empty.
  password_hash text,
  created_at timestamptz not null default now()
);

-- Two divers may both be called Ama; the id is what tells them apart. The
-- unique name index belonged to the account flow and is dropped here so an
-- already-deployed database follows.
alter table users alter column password_hash drop not null;
drop index if exists users_username_key;

create table if not exists sessions (
  token_hash text primary key,
  user_id uuid not null references users(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);
create index if not exists sessions_user_idx on sessions (user_id);

create table if not exists rooms (
  code text primary key,
  host_seat_id text,
  state jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists seats (
  room_code text not null references rooms(code) on delete cascade,
  seat_id text not null,
  user_id uuid references users(id) on delete cascade,
  name text not null,
  ordinal integer not null,
  primary key (room_code, seat_id)
);
create index if not exists seats_user_idx on seats (user_id);
`;

export async function migrate(): Promise<void> {
  if (!pool) return;
  await pool.query(SCHEMA);
}

/** Forget expired identities and tables nobody has touched in a while. */
export async function sweep(staleHours = 24): Promise<void> {
  if (!pool) return;
  await pool.query('delete from sessions where expires_at < now()');
  await pool.query(
    `delete from rooms where updated_at < now() - ($1 || ' hours')::interval`,
    [String(staleHours)],
  );
  // A player is only their token, so once it is gone the row is unreachable.
  // Seats cascade from users, so one still holding a chair is left alone —
  // otherwise clearing an identity would take a diver out of a live table.
  await pool.query(
    `delete from users
      where not exists (select 1 from sessions s where s.user_id = users.id)
        and not exists (select 1 from seats t where t.user_id = users.id)`,
  );
}
