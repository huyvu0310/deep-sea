import { randomUUID } from 'node:crypto';
import { afterAll, describe, expect, it } from 'vitest';
import { accountForSession, signIn, signOut, signUp } from '../server/auth';
import { dbEnabled, migrate, pool, query } from '../server/db';
import { Room } from '../server/room';
import { activeRoomForUser, deleteRoom, loadRoom, saveGame, saveRoom } from '../server/store';
import { fakeSocket } from './fake-socket';

/**
 * These need a real Postgres, so they are skipped unless one is pointed at.
 * Run them with, for example:
 *   DATABASE_URL=postgres://postgres:postgres@localhost:5432/postgres npm test
 */
const describeDb = dbEnabled ? describe : describe.skip;

/** Short, unique, and within the 16-character username rule. */
const newName = () => `d${randomUUID().replace(/-/g, '').slice(0, 12)}`;
const PASSWORD = 'trenchdive1';

afterAll(async () => {
  await pool?.end();
});

describeDb('accounts', () => {
  it('signs a diver up and back in again', async () => {
    await migrate();
    const username = newName();

    const created = await signUp(username, PASSWORD);
    expect(created.account.username).toBe(username);

    const returning = await signIn(username, PASSWORD);
    expect(returning.account.id).toBe(created.account.id);
  });

  it('recognises a username whatever its case, and refuses to repeat it', async () => {
    await migrate();
    const username = newName();
    await signUp(username, PASSWORD);

    await expect(signUp(username.toUpperCase(), PASSWORD)).rejects.toThrow(/taken/i);
    await expect(signIn(username.toUpperCase(), PASSWORD)).resolves.toBeTruthy();
  });

  it('says the same thing to a wrong password as to an unknown diver', async () => {
    await migrate();
    const username = newName();
    await signUp(username, PASSWORD);

    const wrongPassword = await signIn(username, 'not-the-password').catch((err: Error) => err.message);
    const noSuchDiver = await signIn(newName(), PASSWORD).catch((err: Error) => err.message);
    expect(wrongPassword).toBe(noSuchDiver);
  });

  it('keeps no password in readable form', async () => {
    await migrate();
    const username = newName();
    const { account } = await signUp(username, PASSWORD);

    const rows = await query<{ password_hash: string }>(
      'select password_hash from users where id = $1',
      [account.id],
    );
    expect(rows[0]?.password_hash).not.toContain(PASSWORD);
    expect(rows[0]?.password_hash).toMatch(/^[0-9a-f]+:[0-9a-f]+$/);
  });

  it('turns a session into its owner, and forgets it on the way out', async () => {
    await migrate();
    const { account, token } = await signUp(newName(), PASSWORD);

    expect((await accountForSession(token))?.id).toBe(account.id);
    await signOut(token);
    expect(await accountForSession(token)).toBeNull();
  });

  it('keeps no session token in readable form', async () => {
    await migrate();
    const { token } = await signUp(newName(), PASSWORD);
    const rows = await query<{ token_hash: string }>('select token_hash from sessions');
    expect(rows.map((row) => row.token_hash)).not.toContain(token);
  });
});

describeDb('a saved table', () => {
  it('comes back with the game exactly as it stood', async () => {
    await migrate();
    const ama = await signUp(newName(), PASSWORD);
    const bosun = await signUp(newName(), PASSWORD);

    const room = new Room('SV01');
    room.join(ama.account.username, fakeSocket().socket, ama.account.id);
    room.join(bosun.account.username, fakeSocket().socket, bosun.account.id);
    room.start('saved-seed', 'p1');
    room.apply('p1', { type: 'declare', direction: 'down' });
    room.apply('p1', { type: 'roll' });

    await saveRoom(room.snapshot());
    const saved = await loadRoom('SV01');
    expect(saved).not.toBeNull();

    const rebuilt = Room.restore(saved!);
    expect(rebuilt.state).toEqual(room.state);

    await deleteRoom('SV01');
  });

  it('is the one a returning diver is offered', async () => {
    await migrate();
    const ama = await signUp(newName(), PASSWORD);
    const bosun = await signUp(newName(), PASSWORD);

    const room = new Room('SV02');
    room.join(ama.account.username, fakeSocket().socket, ama.account.id);
    room.join(bosun.account.username, fakeSocket().socket, bosun.account.id);
    await saveRoom(room.snapshot());

    expect(await activeRoomForUser(ama.account.id)).toBe('SV02');
    await deleteRoom('SV02');
  });

  it('stops being offered once the expedition is over', async () => {
    await migrate();
    const ama = await signUp(newName(), PASSWORD);
    const bosun = await signUp(newName(), PASSWORD);

    const room = new Room('SV03');
    room.join(ama.account.username, fakeSocket().socket, ama.account.id);
    room.join(bosun.account.username, fakeSocket().socket, bosun.account.id);
    room.start('over-seed', 'p1');
    await saveRoom(room.snapshot());

    const finished = { ...room.state!, phase: 'gameOver' as const };
    await saveGame('SV03', finished);

    expect(await activeRoomForUser(ama.account.id)).toBeNull();
    await deleteRoom('SV03');
  });

  it('takes its seats with it when it closes', async () => {
    await migrate();
    const ama = await signUp(newName(), PASSWORD);

    const room = new Room('SV04');
    room.join(ama.account.username, fakeSocket().socket, ama.account.id);
    await saveRoom(room.snapshot());
    await deleteRoom('SV04');

    const orphans = await query('select 1 from seats where room_code = $1', ['SV04']);
    expect(orphans).toHaveLength(0);
  });
});
