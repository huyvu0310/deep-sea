import { describe, expect, it } from 'vitest';
import { applyAction, createGame } from '../src/engine';
import { toView } from '../src/net/view';

describe('the player-facing view', () => {
  it('hides every chip value while the game is running', () => {
    const view = toView(createGame({ players: [{ id: 'a', name: 'Ama' }, { id: 'b', name: 'Bo' }], seed: 7 }));
    const values = view.path.flatMap((cell) => (cell.kind === 'treasure' ? cell.chips : []));
    expect(values).toHaveLength(32);
    expect(values.every((chip) => chip.value === null)).toBe(true);
    expect(values.every((chip) => chip.level >= 1 && chip.level <= 4)).toBe(true);
  });

  it('hides held treasure, banked treasure and scores mid-game', () => {
    let game = createGame({ players: [{ id: 'a', name: 'Ama' }, { id: 'b', name: 'Bo' }], seed: 7 });
    game = { ...game, phase: 'action' };
    game.players[0]!.position = 1;
    game = applyAction(game, { type: 'take' });

    const view = toView(game);
    expect(view.players[0]!.holding[0]!.every((c) => c.value === null)).toBe(true);
    expect(view.players.every((p) => p.score === null)).toBe(true);
    expect(view.standings).toBeNull();
  });

  it('never leaks a value through the round summary', () => {
    let game = createGame({ players: [{ id: 'a', name: 'Ama' }, { id: 'b', name: 'Bo' }], seed: 7, });
    game = { ...game, air: 1 };
    game.players[0]!.holding = [[{ level: 4, value: 15 }]];
    game = applyAction(game, { type: 'declare', direction: 'down' });
    game = applyAction(game, { type: 'roll' });
    if (game.phase === 'action') game = applyAction(game, { type: 'pass' });

    const view = toView(game);
    expect(view.phase).toBe('roundEnd');
    expect(view.roundSummary!.restacked.flat().every((c) => c.value === null)).toBe(true);
    expect(JSON.stringify(view)).not.toContain('"value":15');
  });

  it('keeps the round a haul was landed in, so it can be grouped', () => {
    const game = createGame({ players: [{ id: 'a', name: 'Ama' }, { id: 'b', name: 'Bo' }], seed: 7 });
    game.players[0]!.banked = [
      { round: 1, chips: [{ level: 1, value: 2 }] },
      { round: 2, chips: [{ level: 4, value: 14 }] },
    ];
    const view = toView(game);
    expect(view.players[0]!.banked.map((entry) => entry.round)).toEqual([1, 2]);
    expect(view.players[0]!.banked.map((entry) => entry.chips[0]!.level)).toEqual([1, 4]);
    expect(view.players[0]!.banked.every((entry) => entry.chips.every((c) => c.value === null))).toBe(
      true,
    );
  });

  it('turns every chip face up once the expedition ends', () => {
    const game = createGame({ players: [{ id: 'a', name: 'Ama' }, { id: 'b', name: 'Bo' }], seed: 7 });
    const finished = { ...game, phase: 'gameOver' as const };
    finished.players[0]!.banked = [{ round: 1, chips: [{ level: 4, value: 15 }] }];

    const view = toView(finished);
    expect(view.players[0]!.banked[0]!.chips[0]!.value).toBe(15);
    expect(view.players[0]!.score).toBe(15);
    expect(view.standings![0]!.score).toBe(15);
  });
});
