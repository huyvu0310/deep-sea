import { describe, expect, it } from 'vitest';
import { applyAction, createGame } from '../src/engine';
import { chip, gameWith, ruins } from './setup';

const twoPlayers = [
  { id: 'a', name: 'Ama' },
  { id: 'b', name: 'Bo' },
];

describe('who caused each log line', () => {
  it('tags a diver on every line about their own turn', () => {
    let game = createGame({ players: twoPlayers, seed: 5 });
    const before = game.log.length;

    game = applyAction(game, { type: 'declare', direction: 'down' });
    game = applyAction(game, { type: 'roll' });

    const added = game.log.slice(before);
    expect(added.length).toBeGreaterThan(0);
    expect(added.every((entry) => entry.actorId === 'a')).toBe(true);
  });

  it('leaves table-level events unattributed', () => {
    const game = createGame({ players: twoPlayers, seed: 5 });
    expect(game.log[0]!.actorId).toBeNull();
    expect(game.log[0]!.text).toContain('Round 1');
  });

  it('credits the diver who scooped, not whoever moved next', () => {
    let game = gameWith({ path: ruins(7, 9), phase: 'action' });
    game.players[0]!.position = 1;
    const before = game.log.length;

    game = applyAction(game, { type: 'take' });

    const entry = game.log.slice(before).at(-1)!;
    expect(entry.actorId).toBe('p1');
    expect(entry.text).toContain('scoops up');
    // play has already passed on, so the actor must not be read from the state
    expect(game.currentPlayerIndex).toBe(1);
  });

  it('attributes each drowned diver their own loss at the round break', () => {
    let game = gameWith({ air: 1 }, 2);
    game.players[0]!.position = 3;
    game.players[0]!.holding = [[chip(9)]];
    game.players[1]!.position = 7;
    game.players[1]!.holding = [[chip(12)]];

    game = applyAction(game, { type: 'declare', direction: 'down' });
    game = applyAction(game, { type: 'roll' });
    if (game.phase === 'action') game = applyAction(game, { type: 'pass' });

    const drownLines = game.log.filter((entry) => entry.text.includes('ran out of air'));
    expect(drownLines.map((entry) => entry.actorId).sort()).toEqual(['p1', 'p2']);
  });

  it('names only real seats, so the interface can always colour a line', () => {
    let game = createGame({ players: twoPlayers, seed: 9 });
    for (let i = 0; i < 60 && game.phase !== 'gameOver'; i++) {
      const action =
        game.phase === 'declare'
          ? ({ type: 'declare', direction: 'down' } as const)
          : game.phase === 'roll'
            ? ({ type: 'roll' } as const)
            : game.phase === 'action'
              ? ({ type: 'pass' } as const)
              : ({ type: 'continue' } as const);
      game = applyAction(game, action);
    }
    const ids = new Set(game.players.map((p) => p.id));
    for (const entry of game.log) {
      if (entry.actorId !== null) expect(ids.has(entry.actorId)).toBe(true);
    }
  });
});
