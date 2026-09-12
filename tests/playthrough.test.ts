import { describe, expect, it } from 'vitest';
import type { GameAction, GameState } from '../src/engine';
import { applyAction, canDrop, canTake, createGame } from '../src/engine';

/** Every chip is either on the route, in a diver's hands, or banked. */
function countChips(state: GameState): number {
  const onRoute = state.path.reduce(
    (n, cell) => n + (cell.kind === 'treasure' ? cell.chips.length : 0),
    0,
  );
  const carried = state.players.reduce(
    (n, p) => n + p.holding.reduce((m, t) => m + t.length, 0),
    0,
  );
  const banked = state.players.reduce(
    (n, p) => n + p.banked.reduce((m, e) => m + e.chips.length, 0),
    0,
  );
  return onRoute + carried + banked;
}

/** A crude but legal bot: dive, grab what it can, and turn back when low. */
function chooseAction(state: GameState, tick: number): GameAction {
  const player = state.players[state.currentPlayerIndex]!;
  switch (state.phase) {
    case 'declare': {
      const bail = state.air < 8 || player.holding.length >= 3 || tick % 17 === 0;
      return { type: 'declare', direction: bail ? 'up' : player.direction };
    }
    case 'roll':
      return { type: 'roll' };
    case 'action':
      if (canTake(state) && player.direction === 'down') return { type: 'take' };
      if (canDrop(state) && player.holding.length > 3) {
        return { type: 'drop', treasureIndex: 0 };
      }
      return { type: 'pass' };
    case 'roundEnd':
      return { type: 'continue' };
    case 'gameOver':
      throw new Error('game already over');
  }
}

describe('full playthroughs', () => {
  it('finishes cleanly and conserves all 32 chips, over many seeds', () => {
    for (let seed = 0; seed < 150; seed++) {
      const playerCount = 2 + (seed % 5);
      let game = createGame({
        players: Array.from({ length: playerCount }, (_, i) => ({
          id: `p${i}`,
          name: `Diver ${i}`,
        })),
        seed,
      });

      let tick = 0;
      while (game.phase !== 'gameOver') {
        game = applyAction(game, chooseAction(game, tick));
        tick++;

        expect(game.air).toBeGreaterThanOrEqual(0);
        expect(countChips(game)).toBe(32);
        for (const p of game.players) {
          expect(p.position).toBeGreaterThanOrEqual(0);
          expect(p.position).toBeLessThanOrEqual(game.path.length);
        }
        expect(tick).toBeLessThan(5000); // guards against a stalled turn loop
      }

      expect(game.round).toBe(3);
      expect(countChips(game)).toBe(32);
    }
  });

  it('never lets a round outlive the air supply', () => {
    let game = createGame({
      players: [
        { id: 'a', name: 'Ama' },
        { id: 'b', name: 'Bo' },
      ],
      seed: 42,
    });
    let seenRounds = new Set<number>();
    let tick = 0;
    while (game.phase !== 'gameOver' && tick < 5000) {
      seenRounds.add(game.round);
      game = applyAction(game, chooseAction(game, tick));
      tick++;
    }
    expect([...seenRounds].sort()).toEqual([1, 2, 3]);
  });
});
