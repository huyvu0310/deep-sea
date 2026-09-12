import { describe, expect, it } from 'vitest';
import { CHIPS_PER_LEVEL, createChipSet, createGame, createPath, seedFrom } from '../src/engine';

const twoPlayers = [
  { id: 'a', name: 'Ama' },
  { id: 'b', name: 'Bo' },
];

describe('game setup', () => {
  it('deals 32 ruin chips: 8 per level, two of each value', () => {
    const levels = createChipSet();
    expect(levels).toHaveLength(4);
    for (const level of levels) expect(level).toHaveLength(CHIPS_PER_LEVEL);
    expect(levels.flat()).toHaveLength(32);
    expect(levels[0]!.map((c) => c.value).sort()).toEqual([0, 0, 1, 1, 2, 2, 3, 3]);
    expect(levels[3]!.map((c) => c.value).sort()).toEqual([12, 12, 13, 13, 14, 14, 15, 15]);
  });

  it('orders the route by level so deeper means richer', () => {
    const { path } = createPath(seedFrom('route'));
    const levels = path.map((cell) => (cell.kind === 'treasure' ? cell.chips[0]!.level : 0));
    expect(levels.slice(0, 8).every((l) => l === 1)).toBe(true);
    expect(levels.slice(8, 16).every((l) => l === 2)).toBe(true);
    expect(levels.slice(16, 24).every((l) => l === 3)).toBe(true);
    expect(levels.slice(24, 32).every((l) => l === 4)).toBe(true);
  });

  it('shuffles within a level but keeps the same seed reproducible', () => {
    const a = createGame({ players: twoPlayers, seed: 'kelp' });
    const b = createGame({ players: twoPlayers, seed: 'kelp' });
    expect(a.path).toEqual(b.path);
  });

  it('starts with 25 air, 3 rounds, every diver in the submarine', () => {
    const game = createGame({ players: twoPlayers, seed: 1 });
    expect(game.air).toBe(25);
    expect(game.totalRounds).toBe(3);
    expect(game.round).toBe(1);
    expect(game.players.every((p) => p.position === 0 && p.direction === 'down')).toBe(true);
  });

  it('rejects player counts outside 2-6 and duplicate ids', () => {
    expect(() => createGame({ players: [{ id: 'a', name: 'Ama' }] })).toThrow();
    expect(() =>
      createGame({ players: Array.from({ length: 7 }, (_, i) => ({ id: `${i}`, name: `${i}` })) }),
    ).toThrow();
    expect(() =>
      createGame({ players: [{ id: 'a', name: 'Ama' }, { id: 'a', name: 'Bo' }] }),
    ).toThrow();
  });
});
