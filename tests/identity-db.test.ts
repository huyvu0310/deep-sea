import { randomUUID } from 'node:crypto';
import { afterAll, describe, expect, it } from 'vitest';
import { dbEnabled, migrate, pool, query } from '../server/db';
import { createPlayer, forgetPlayer, playerForToken, renamePlayer } from '../server/identity';
import { Room } from '../server/room';
import { activeRoomForUser, deleteRoom, loadRoom, saveGame, saveRoom } from '../server/store';
import { fakeSocket } from './fake-socket';

/**
 * These need a real Postgres, so they are skipped unless one is pointed at.
 * Run them with, for example:
 *   DATABASE_URL=postgres://postgres:postgres@localhost:5432/postgres npm test
 */
const describeDb = dbEnabled ? describe : describe.skip;

const newName = () => `diver-${randomUUID().slice(0, 8)}`;

afterAll(async () => {
  await pool?.end();
});

describeDb('a browser identity', () => {
  it('is issued for a name alone, with nothing else asked for', async () => {
    await migrate();
    const name = newName();

    const { player, token } = await createPlayer(name);
    expect(player.name).toBe(name);
    expect(token).toBeTruthy();
    expect((await playerForToken(token))?.id).toBe(player.id);
  });

  it('lets two divers share a name, telling them apart by id', async () => {
    await migrate();
    const one = await createPlayer('Ama');
    const two = await createPlayer('Ama');
    expect(one.player.id).not.toBe(two.player.id);
  });

  it('trims an overlong name rather than refusing it', async () => {
    await migrate();
    const { player } = await createPlayer('   a-very-long-name-indeed   ');
    expect(player.name).toBe('a-very-long-name');
  });

  it('refuses a name that is only whitespace', async () => {
    await migrate();
    await expect(createPlayer('   ')).rejects.toThrow(/name/i);
  });

  it('keeps no token in readable form', async () => {
    await migrate();
    const { token } = await createPlayer(newName());
    const rows = await query<{ token_hash: string }>('select token_hash from sessions');
    expect(rows.map((row) => row.token_hash)).not.toContain(token);
  });

  it('sets no password, leaving that column for a later account flow', async () => {
    await migrate();
    const { player } = await createPlayer(newName());
    const rows = await query<{ password_hash: string | null }>(
      'select password_hash from users where id = $1',
      [player.id],
    );
    expect(rows[0]?.password_hash).toBeNull();
  });

  it('is forgotten on request, so the next name starts a new player', async () => {
    await migrate();
    const { token } = await createPlayer(newName());
    await forgetPlayer(token);
    expect(await playerForToken(token)).toBeNull();
  });
});

describeDb('renaming a diver', () => {
  it('changes the name without giving up the chair', async () => {
    await migrate();
    const { player } = await createPlayer('Ama');

    const room = new Room('RN01');
    room.join(player.name, fakeSocket().socket, player.id);
    await saveRoom(room.snapshot());

    const renamed = await renamePlayer(player.id, 'Bosun');
    expect(renamed.name).toBe('Bosun');
    expect(await activeRoomForUser(player.id)).toBe('RN01');

    await deleteRoom('RN01');
  });
});

describeDb('a saved table', () => {
  async function twoDivers(code: string) {
    await migrate();
    const ama = await createPlayer(newName());
    const bosun = await createPlayer(newName());
    const room = new Room(code);
    room.join(ama.player.name, fakeSocket().socket, ama.player.id);
    room.join(bosun.player.name, fakeSocket().socket, bosun.player.id);
    return { room, ama, bosun };
  }

  it('comes back with the game exactly as it stood', async () => {
    const { room } = await twoDivers('SV01');
    room.start('saved-seed', 'p1');
    room.apply('p1', { type: 'declare', direction: 'down' });
    room.apply('p1', { type: 'roll' });

    await saveRoom(room.snapshot());
    const saved = await loadRoom('SV01');
    expect(saved).not.toBeNull();
    expect(Room.restore(saved!).state).toEqual(room.state);

    await deleteRoom('SV01');
  });

  it('is the one a returning diver is offered', async () => {
    const { room, ama } = await twoDivers('SV02');
    await saveRoom(room.snapshot());
    expect(await activeRoomForUser(ama.player.id)).toBe('SV02');
    await deleteRoom('SV02');
  });

  it('stops being offered once the expedition is over', async () => {
    const { room, ama } = await twoDivers('SV03');
    room.start('over-seed', 'p1');
    await saveRoom(room.snapshot());
    await saveGame('SV03', { ...room.state!, phase: 'gameOver' as const });

    expect(await activeRoomForUser(ama.player.id)).toBeNull();
    await deleteRoom('SV03');
  });

  it('takes its seats with it when it closes', async () => {
    const { room } = await twoDivers('SV04');
    await saveRoom(room.snapshot());
    await deleteRoom('SV04');

    expect(await query('select 1 from seats where room_code = $1', ['SV04'])).toHaveLength(0);
  });
});
