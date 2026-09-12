import type { GameState } from '../src/engine';
import { pool, query } from './db';

/** One chair, as it is written down. The reclaim token is deliberately not
 * persisted: a seat belongs to an account, so a returning player is recognised
 * by signing in rather than by holding a per-table secret. */
export interface SeatRecord {
  id: string;
  name: string;
  userId: string | null;
  ordinal: number;
}

/** Everything needed to rebuild a table after the process restarts. */
export interface RoomSnapshot {
  code: string;
  hostId: string | null;
  game: GameState | null;
  seats: SeatRecord[];
}

/**
 * Write a table and who is sitting at it. Used when the membership changes —
 * a table opening, a diver joining or leaving, the dive casting off.
 */
export async function saveRoom(snapshot: RoomSnapshot): Promise<void> {
  if (!pool) return;
  const client = await pool.connect();
  try {
    await client.query('begin');
    await client.query(
      `insert into rooms (code, host_seat_id, state, updated_at)
       values ($1, $2, $3, now())
       on conflict (code) do update
         set host_seat_id = excluded.host_seat_id,
             state = excluded.state,
             updated_at = now()`,
      [snapshot.code, snapshot.hostId, snapshot.game ? JSON.stringify(snapshot.game) : null],
    );
    await client.query('delete from seats where room_code = $1', [snapshot.code]);
    for (const seat of snapshot.seats) {
      await client.query(
        `insert into seats (room_code, seat_id, user_id, name, ordinal)
         values ($1, $2, $3, $4, $5)`,
        [snapshot.code, seat.id, seat.userId, seat.name, seat.ordinal],
      );
    }
    await client.query('commit');
  } catch (err) {
    await client.query('rollback');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Write just the game. This is the hot path — it runs after every move — so it
 * touches one row and leaves the seats, which cannot change mid-dive, alone.
 */
export async function saveGame(code: string, game: GameState): Promise<void> {
  if (!pool) return;
  await query('update rooms set state = $2, updated_at = now() where code = $1', [
    code,
    JSON.stringify(game),
  ]);
}

export async function loadRoom(code: string): Promise<RoomSnapshot | null> {
  if (!pool) return null;
  const rooms = await query<{ code: string; host_seat_id: string | null; state: GameState | null }>(
    'select code, host_seat_id, state from rooms where code = $1',
    [code],
  );
  const room = rooms[0];
  if (!room) return null;

  const seats = await query<{ seat_id: string; user_id: string | null; name: string; ordinal: number }>(
    'select seat_id, user_id, name, ordinal from seats where room_code = $1 order by ordinal',
    [code],
  );

  return {
    code: room.code,
    hostId: room.host_seat_id,
    game: room.state,
    seats: seats.map((row) => ({
      id: row.seat_id,
      name: row.name,
      userId: row.user_id,
      ordinal: row.ordinal,
    })),
  };
}

/**
 * The table this account should be offered on its way back in: the one it was
 * most recently seated at that has not already finished.
 */
export async function activeRoomForUser(userId: string): Promise<string | null> {
  if (!pool) return null;
  const rows = await query<{ code: string }>(
    `select r.code
       from seats s
       join rooms r on r.code = s.room_code
      where s.user_id = $1
        and (r.state is null or r.state->>'phase' <> 'gameOver')
      order by r.updated_at desc
      limit 1`,
    [userId],
  );
  return rows[0]?.code ?? null;
}

export async function deleteRoom(code: string): Promise<void> {
  if (!pool) return;
  await query('delete from rooms where code = $1', [code]);
}

/** Codes already taken, so a new table never collides with a saved one. */
export async function knownCodes(): Promise<Set<string>> {
  if (!pool) return new Set();
  const rows = await query<{ code: string }>('select code from rooms');
  return new Set(rows.map((row) => row.code));
}
