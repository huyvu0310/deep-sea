import { describe, expect, it } from 'vitest';
import { Room } from '../server/room';
import { fakeSocket } from './fake-socket';

const GRACE = 45_000;

/** A started table where the first diver has just walked away from it. */
function tableWithAnAbsentDiver() {
  const room = new Room('GONE');
  const ama = fakeSocket();
  const bosun = fakeSocket();
  room.join('Ama', ama.socket, 'user-ama');
  room.join('Bosun', bosun.socket, 'user-bosun');
  room.start('absent-seed', 'p1');
  return { room, ama, bosun };
}

function lastLog(room: Room): string {
  return room.state?.log.at(-1)?.text ?? '';
}

/** Read through a call so narrowing does not outlive the move that changed it. */
function phaseOf(room: Room): string | undefined {
  return room.state?.phase;
}

/** Play one cautious turn by hand for a diver who is present. */
function playTurn(room: Room, seat: 'p1' | 'p2', direction: 'down' | 'up') {
  if (phaseOf(room) !== 'declare') return;
  room.apply(seat, { type: 'declare', direction });
  room.apply(seat, { type: 'roll' });
  if (phaseOf(room) === 'action') room.apply(seat, { type: 'pass' });
}

describe('a diver who has gone', () => {
  it('is waited for while the grace period lasts', () => {
    const { room, ama } = tableWithAnAbsentDiver();
    const left = Date.now();
    room.disconnect(ama.socket);

    expect(room.nudgeAbsent(GRACE, left + GRACE - 1)).toBe(false);
    expect(room.state?.currentPlayerIndex).toBe(0);
  });

  it('has their turn played for them once the table has waited long enough', () => {
    const { room, ama } = tableWithAnAbsentDiver();
    const left = Date.now();
    room.disconnect(ama.socket);

    expect(room.nudgeAbsent(GRACE, left + GRACE)).toBe(true);
    // Turned around, swum, and taken nothing — the cautious way home.
    expect(room.state?.players[0]?.direction).toBe('up');
    expect(room.state?.players[0]?.holding).toHaveLength(0);
  });

  it('says why, so the others are not left guessing', () => {
    const { room, ama } = tableWithAnAbsentDiver();
    const left = Date.now();
    room.disconnect(ama.socket);
    room.nudgeAbsent(GRACE, left + GRACE);

    expect(room.state?.log.map((entry) => entry.text).join(' ')).toContain('Ama is away');
  });

  it('hands play on, so the table is no longer stuck', () => {
    const { room, ama } = tableWithAnAbsentDiver();
    const left = Date.now();
    room.disconnect(ama.socket);
    room.nudgeAbsent(GRACE, left + GRACE);

    expect(room.state?.currentPlayerIndex).toBe(1);
    expect(() => room.apply('p2', { type: 'declare', direction: 'down' })).not.toThrow();
  });

  it('is left alone the moment they come back', () => {
    const { room, ama } = tableWithAnAbsentDiver();
    const left = Date.now();
    room.disconnect(ama.socket);
    room.resumeAs('user-ama', fakeSocket().socket);

    expect(room.nudgeAbsent(GRACE, left + GRACE * 10)).toBe(false);
    expect(room.state?.currentPlayerIndex).toBe(0);
  });

  it('never plays for a diver who is sitting right there', () => {
    const { room } = tableWithAnAbsentDiver();
    expect(room.nudgeAbsent(GRACE, Date.now() + GRACE * 10)).toBe(false);
  });

  it('leaves a table nobody is watching to wait', () => {
    const { room, ama, bosun } = tableWithAnAbsentDiver();
    const left = Date.now();
    room.disconnect(ama.socket);
    room.disconnect(bosun.socket);

    expect(room.nudgeAbsent(GRACE, left + GRACE * 10)).toBe(false);
  });

  it('keeps sending them up on later turns until they are home', () => {
    const { room, ama } = tableWithAnAbsentDiver();

    // Get Ama well away from the submarine first: a diver who wanders off
    // while still standing on it simply steps back aboard in one turn.
    for (let turn = 0; turn < 3; turn++) {
      for (const seat of ['p1', 'p2'] as const) playTurn(room, seat, 'down');
    }
    expect(room.state?.players[0]?.position).toBeGreaterThan(1);

    const left = Date.now();
    room.disconnect(ama.socket);

    let turns = 0;
    for (let sweep = 0; sweep < 40 && phaseOf(room) !== 'roundEnd'; sweep++) {
      if (room.nudgeAbsent(GRACE, left + GRACE + sweep)) {
        turns++;
        continue;
      }
      // Bosun is present, so his turns still have to be played by hand.
      if (room.state?.currentPlayerIndex === 1) playTurn(room, 'p2', 'up');
    }

    expect(turns).toBeGreaterThan(1);
    expect(room.state?.players[0]?.direction).toBe('up');
  });

  it('does not touch a table between rounds', () => {
    const { room, ama } = tableWithAnAbsentDiver();
    room.disconnect(ama.socket);
    const resting = room.state?.phase;
    expect(resting).not.toBe('roundEnd');
    expect(lastLog(room)).not.toContain('is away');
  });
});
