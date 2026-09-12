import { describe, expect, it } from 'vitest';
import type { WebSocket } from 'ws';
import { Room } from '../server/room';
import type { ServerMessage } from '../src/net/protocol';

/** Stand-in socket that just records what the room sent it. */
function fakeSocket() {
  const sent: ServerMessage[] = [];
  const socket = {
    readyState: 1,
    send: (raw: string) => sent.push(JSON.parse(raw) as ServerMessage),
    close: () => {},
  };
  return { socket: socket as unknown as WebSocket, sent };
}

function seatedRoom(names: string[]) {
  const room = new Room('TEST');
  const clients = names.map((name) => {
    const client = fakeSocket();
    const seat = room.join(name, client.socket);
    return { ...client, seat };
  });
  return { room, clients };
}

describe('a table', () => {
  it('seats up to six divers and refuses a seventh', () => {
    const { room } = seatedRoom(['a', 'b', 'c', 'd', 'e', 'f']);
    expect(room.playerCount).toBe(6);
    expect(() => room.join('g', fakeSocket().socket)).toThrow(/full/i);
  });

  it('only lets the host cast off, and only with enough divers', () => {
    const { room, clients } = seatedRoom(['Ama']);
    expect(() => room.start(undefined, 'p1')).toThrow(/at least/i);

    room.join('Bo', fakeSocket().socket);
    expect(() => room.start(undefined, 'p2')).toThrow(/host/i);

    room.start('seed', clients[0]!.seat.id);
    expect(room.started).toBe(true);
  });

  it('refuses to seat anyone once the dive has begun', () => {
    const { room } = seatedRoom(['Ama', 'Bo']);
    room.start('seed', 'p1');
    expect(() => room.join('Cass', fakeSocket().socket)).toThrow(/already set off/i);
  });

  it('rejects a move from a diver whose turn it is not', () => {
    const { room } = seatedRoom(['Ama', 'Bo']);
    room.start('seed', 'p1');
    expect(() => room.apply('p2', { type: 'declare', direction: 'down' })).toThrow(/not your turn/i);
    expect(() => room.apply('p1', { type: 'declare', direction: 'down' })).not.toThrow();
  });

  it('surfaces an illegal move as a plain message rather than a crash', () => {
    const { room } = seatedRoom(['Ama', 'Bo']);
    room.start('seed', 'p1');
    expect(() => room.apply('p1', { type: 'roll' })).toThrow(/nothing to roll/i);
  });

  it('broadcasts a view with every chip value hidden', () => {
    const { room, clients } = seatedRoom(['Ama', 'Bo']);
    room.start('seed', 'p1');
    room.broadcast();

    const last = clients[1]!.sent.at(-1)!;
    expect(last.type).toBe('state');
    if (last.type !== 'state') throw new Error('expected a state message');

    const chips = last.view.path.flatMap((cell) => (cell.kind === 'treasure' ? cell.chips : []));
    expect(chips).toHaveLength(32);
    expect(chips.every((chip) => chip.value === null)).toBe(true);
    expect(JSON.stringify(last.view)).not.toContain('rng');
  });

  it('holds a seat open mid-game so a refresh can reclaim it', () => {
    const { room, clients } = seatedRoom(['Ama', 'Bo']);
    room.start('seed', 'p1');
    room.disconnect(clients[0]!.socket);
    expect(room.playerCount).toBe(2);

    const returning = fakeSocket();
    const seat = room.resume(clients[0]!.seat.token, returning.socket);
    expect(seat.id).toBe('p1');
    expect(() => room.apply('p1', { type: 'declare', direction: 'down' })).not.toThrow();
  });

  it('frees an empty chair if a diver leaves before the dive starts', () => {
    const { room, clients } = seatedRoom(['Ama', 'Bo']);
    room.disconnect(clients[1]!.socket);
    expect(room.playerCount).toBe(1);
  });

  it('passes the host role on when the host leaves the lobby', () => {
    const { room, clients } = seatedRoom(['Ama', 'Bo']);
    room.disconnect(clients[0]!.socket);
    const lobby = room.lobby();
    if (lobby.type !== 'lobby') throw new Error('expected a lobby message');
    expect(lobby.hostId).toBe('p2');
  });

  it('ignores a duplicate round-advance instead of erroring', () => {
    const { room } = seatedRoom(['Ama', 'Bo']);
    room.start('seed', 'p1');
    expect(() => room.apply('p2', { type: 'continue' })).not.toThrow();
  });
});
