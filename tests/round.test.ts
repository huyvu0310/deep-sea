import { describe, expect, it } from 'vitest';
import { applyAction, playerScore, standings } from '../src/engine';
import { chip, gameWith, ruins } from './setup';

describe('returning to the submarine', () => {
  it('banks the haul and retires the diver for the round', () => {
    let game = gameWith({ path: ruins(1, 2, 3, 4, 5) });
    const diver = game.players[0]!;
    diver.position = 1;
    diver.direction = 'up';
    diver.holding = [[chip(5)], [chip(9)]];

    game = applyAction(game, { type: 'declare', direction: 'up' });
    game = applyAction(game, { type: 'roll' });

    const surfaced = game.players[0]!;
    expect(surfaced.returned).toBe(true);
    expect(surfaced.holding).toHaveLength(0);
    expect(playerScore(surfaced)).toBe(14);
  });

  it('ends the round as soon as every diver is aboard', () => {
    let game = gameWith({ path: ruins(1, 2, 3) });
    game.players[1]!.returned = true;
    game.players[0]!.position = 1;
    game.players[0]!.direction = 'up';
    game = applyAction(game, { type: 'declare', direction: 'up' });
    game = applyAction(game, { type: 'roll' });
    expect(game.phase).toBe('roundEnd');
  });
});

describe('running out of air', () => {
  it('lets the active diver finish the turn, then ends the round', () => {
    let game = gameWith({ air: 2, path: ruins(1, 2, 3, 4, 5, 6, 7, 8) });
    game.players[0]!.holding = [[chip(5)], [chip(6)]];
    game.players[0]!.position = 2;

    game = applyAction(game, { type: 'declare', direction: 'down' });
    expect(game.air).toBe(0);
    expect(game.airDepleted).toBe(true);
    expect(game.phase).toBe('roll'); // turn continues

    game = applyAction(game, { type: 'roll' });
    if (game.phase === 'action') game = applyAction(game, { type: 'pass' });
    expect(game.phase).toBe('roundEnd');
  });

  it('drowns divers still in the water and takes all their treasure', () => {
    let game = gameWith({ air: 1 });
    game.players[0]!.position = 4;
    game.players[0]!.holding = [[chip(10)]];
    game.players[1]!.position = 9;
    game.players[1]!.holding = [[chip(14)], [chip(2)]];

    game = applyAction(game, { type: 'declare', direction: 'down' });
    game = applyAction(game, { type: 'roll' });
    if (game.phase === 'action') game = applyAction(game, { type: 'pass' });

    expect(game.phase).toBe('roundEnd');
    expect(game.roundSummary!.drowned.map((d) => d.playerId)).toEqual(['p2', 'p1']); // deepest first
    expect(playerScore(game.players[0]!)).toBe(0);
    expect(playerScore(game.players[1]!)).toBe(0);
  });

  it('restacks lost chips in threes, deepest diver first', () => {
    let game = gameWith({ air: 1, path: ruins(1, 2, 3, 4, 5, 6, 7, 8, 9, 10) }, 2);
    game.players[0]!.position = 2;
    game.players[0]!.holding = [[chip(1)], [chip(2)]];
    game.players[1]!.position = 8;
    game.players[1]!.holding = [[chip(13)], [chip(14)], [chip(15)], [chip(12)]];

    game = applyAction(game, { type: 'declare', direction: 'down' });
    game = applyAction(game, { type: 'roll' });
    if (game.phase === 'action') game = applyAction(game, { type: 'pass' });

    const stacks = game.roundSummary!.restacked.map((s) => s.map((c) => c.value));
    expect(stacks).toEqual([
      [13, 14, 15],
      [12, 1, 2],
    ]);
  });
});

describe('between rounds', () => {
  it('closes up empty spaces and hangs the lost stacks off the end', () => {
    let game = gameWith({ air: 1, path: ruins(1, null, 3, null, 5) });
    game.players[0]!.position = 3;
    game.players[0]!.holding = [[chip(14)], [chip(15)], [chip(13)]];
    game.players[1]!.returned = true;

    game = applyAction(game, { type: 'declare', direction: 'down' });
    game = applyAction(game, { type: 'roll' });
    if (game.phase === 'action') game = applyAction(game, { type: 'pass' });
    game = applyAction(game, { type: 'continue' });

    expect(game.round).toBe(2);
    expect(game.path).toHaveLength(4); // 3 ruins survive + 1 new stack
    expect(game.path[3]).toEqual({ kind: 'treasure', chips: [chip(14), chip(15), chip(13)] });
  });

  it('refills the air and sends everyone back to the submarine', () => {
    let game = gameWith({ air: 1 });
    game.players[0]!.holding = [[chip(3)]];
    game = applyAction(game, { type: 'declare', direction: 'down' });
    game = applyAction(game, { type: 'roll' });
    if (game.phase === 'action') game = applyAction(game, { type: 'pass' });
    game = applyAction(game, { type: 'continue' });

    expect(game.air).toBe(25);
    expect(game.airDepleted).toBe(false);
    expect(game.players.every((p) => p.position === 0 && !p.returned && p.direction === 'down')).toBe(
      true,
    );
  });

  it('keeps treasure banked in earlier rounds', () => {
    let game = gameWith({ air: 1 });
    game.players[0]!.banked = [{ round: 1, chips: [chip(9)] }];
    game.players[0]!.holding = [[chip(3)]];
    game = applyAction(game, { type: 'declare', direction: 'down' });
    game = applyAction(game, { type: 'roll' });
    if (game.phase === 'action') game = applyAction(game, { type: 'pass' });
    game = applyAction(game, { type: 'continue' });
    expect(playerScore(game.players[0]!)).toBe(9);
  });

  it('ends the expedition after the third round', () => {
    let game = gameWith({ air: 1, round: 3 });
    game.players[0]!.holding = [[chip(3)]];
    game = applyAction(game, { type: 'declare', direction: 'down' });
    game = applyAction(game, { type: 'roll' });
    if (game.phase === 'action') game = applyAction(game, { type: 'pass' });
    game = applyAction(game, { type: 'continue' });
    expect(game.phase).toBe('gameOver');
  });
});

describe('scoring', () => {
  it('ranks by banked value and reports ties as ties', () => {
    const game = gameWith({}, 3);
    game.players[0]!.banked = [{ round: 1, chips: [chip(10), chip(5)] }];
    game.players[1]!.banked = [{ round: 1, chips: [chip(15)] }];
    game.players[2]!.banked = [];
    const table = standings(game.players);
    expect(table[0]!.score).toBe(15);
    expect(table[0]!.rank).toBe(1);
    expect(table[1]!.rank).toBe(1); // tied
    expect(table[2]!.rank).toBe(3);
  });
});
