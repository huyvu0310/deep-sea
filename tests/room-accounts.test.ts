import { describe, expect, it } from 'vitest';
import { Room } from '../server/room';
import { fakeSocket } from './fake-socket';

/** A table whose chairs belong to accounts, as an online game has. */
function accountRoom() {
  const room = new Room('SAVE');
  const ama = fakeSocket();
  const bosun = fakeSocket();
  room.join('ama', ama.socket, 'user-ama');
  room.join('bosun', bosun.socket, 'user-bosun');
  return { room, ama, bosun };
}

describe('a seat that belongs to an account', () => {
  it('comes back to its owner on a brand new connection', () => {
    const { room, ama } = accountRoom();
    room.start('seed', 'p1');
    room.disconnect(ama.socket);

    const returning = fakeSocket();
    expect(room.resumeAs('user-ama', returning.socket).id).toBe('p1');
  });

  it('is not handed to anyone else who asks for that table', () => {
    const { room } = accountRoom();
    room.start('seed', 'p1');
    expect(() => room.resumeAs('user-cass', fakeSocket().socket)).toThrow(/do not have a seat/i);
  });

  it('gives each account the chair that belongs to it', () => {
    const { room } = accountRoom();
    room.start('seed', 'p1');
    expect(room.resumeAs('user-bosun', fakeSocket().socket).id).toBe('p2');
  });

  it('lets go of the older connection so one seat has one voice', () => {
    const { room, ama } = accountRoom();
    room.start('seed', 'p1');

    let closed = false;
    const first = { ...ama.socket, close: () => (closed = true) } as unknown as typeof ama.socket;
    room.resumeAs('user-ama', first);
    room.resumeAs('user-ama', fakeSocket().socket);
    expect(closed).toBe(true);
  });

  it('refuses to seat one account twice at the same table', () => {
    const { room } = accountRoom();
    expect(() => room.join('ama again', fakeSocket().socket, 'user-ama')).toThrow(/already at this table/i);
  });
});

describe('writing a table down and building it back', () => {
  it('keeps the game exactly as it stood', () => {
    const { room } = accountRoom();
    room.start('restore-seed', 'p1');
    room.apply('p1', { type: 'declare', direction: 'down' });
    room.apply('p1', { type: 'roll' });

    const rebuilt = Room.restore(room.snapshot());
    expect(rebuilt.state).toEqual(room.state);
  });

  it('keeps who was sitting where, and who was host', () => {
    const { room } = accountRoom();
    room.start('restore-seed', 'p1');

    const rebuilt = Room.restore(room.snapshot());
    const lobby = rebuilt.lobby();
    if (lobby.type !== 'lobby') throw new Error('expected a lobby message');

    expect(lobby.players.map((player) => player.name)).toEqual(['ama', 'bosun']);
    expect(lobby.hostId).toBe('p1');
  });

  it('brings the table back with nobody connected to it', () => {
    const { room } = accountRoom();
    room.start('restore-seed', 'p1');

    const rebuilt = Room.restore(room.snapshot());
    const lobby = rebuilt.lobby();
    if (lobby.type !== 'lobby') throw new Error('expected a lobby message');

    expect(lobby.players.every((player) => !player.connected)).toBe(true);
    expect(rebuilt.idle).toBe(true);
  });

  it('is playable again once its owners come back', () => {
    const { room } = accountRoom();
    room.start('restore-seed', 'p1');

    const rebuilt = Room.restore(room.snapshot());
    rebuilt.resumeAs('user-ama', fakeSocket().socket);
    expect(() => rebuilt.apply('p1', { type: 'declare', direction: 'down' })).not.toThrow();
    expect(() => rebuilt.apply('p2', { type: 'declare', direction: 'down' })).toThrow(/not your turn/i);
  });

  it('never writes a reclaim token down', () => {
    const { room } = accountRoom();
    room.start('restore-seed', 'p1');
    expect(JSON.stringify(room.snapshot())).not.toContain('token');
  });
});

describe('a diver who is already seated', () => {
  it('is found by account, so arriving by code returns the same chair', () => {
    const { room } = accountRoom();
    room.start('seed', 'p1');
    expect(room.seatFor('user-ama')?.id).toBe('p1');
    expect(room.seatFor('user-cass')).toBeUndefined();
  });
});
