import { describe, expect, it } from 'vitest';
import { IllegalActionError, applyAction, canDrop, canTake, cellAt } from '../src/engine';
import { chip, gameWith, ruins } from './setup';

describe('a turn', () => {
  it('spends one air per treasure token held, before the roll', () => {
    let game = gameWith();
    game.players[0]!.holding = [[chip(5)], [chip(9)]];
    game = applyAction(game, { type: 'declare', direction: 'down' });
    expect(game.air).toBe(23);
    expect(game.phase).toBe('roll');
  });

  it('spends no air with empty hands', () => {
    let game = gameWith();
    game = applyAction(game, { type: 'declare', direction: 'down' });
    expect(game.air).toBe(25);
  });

  it('subtracts held tokens from the dice, never below zero', () => {
    let game = gameWith({ path: ruins(...Array(32).fill(1)) });
    game.players[0]!.holding = Array.from({ length: 8 }, () => [chip(3)]);
    game = applyAction(game, { type: 'declare', direction: 'down' });
    game = applyAction(game, { type: 'roll' });
    expect(game.lastRoll!.moved).toBe(0);
    expect(game.players[0]!.position).toBe(0);
  });

  it('rolls two dice showing 1-3 each', () => {
    let game = gameWith();
    for (let i = 0; i < 200; i++) {
      game = applyAction(game, { type: 'declare', direction: 'down' });
      game = applyAction(game, { type: 'roll' });
      const [a, b] = game.lastRoll!.dice;
      expect(a).toBeGreaterThanOrEqual(1);
      expect(a).toBeLessThanOrEqual(3);
      expect(b).toBeGreaterThanOrEqual(1);
      expect(b).toBeLessThanOrEqual(3);
      game = applyAction(game, { type: 'pass' });
      if (game.phase !== 'declare') break;
    }
  });

  it('lets a diver turn around once, and never back down again', () => {
    let game = gameWith();
    game.players[0]!.position = 5;
    game = applyAction(game, { type: 'declare', direction: 'up' });
    expect(game.players[0]!.direction).toBe('up');
    game = applyAction(game, { type: 'roll' });
    if (game.phase === 'action') game = applyAction(game, { type: 'pass' });
    // back to this diver next round-trip; force the turn to test the guard
    const upward = { ...game, currentPlayerIndex: 0, phase: 'declare' as const };
    expect(() => applyAction(upward, { type: 'declare', direction: 'down' })).toThrow(
      IllegalActionError,
    );
  });

  it('takes the treasure underfoot and leaves the space empty', () => {
    let game = gameWith({ path: ruins(7, 9), phase: 'action' });
    game.players[0]!.position = 1;
    expect(canTake(game)).toBe(true);
    game = applyAction(game, { type: 'take' });
    expect(game.players[0]!.holding).toEqual([[chip(7)]]);
    expect(cellAt(game, 1)).toEqual({ kind: 'empty' });
  });

  it('refuses to take from an empty space', () => {
    const game = gameWith({ path: ruins(null, 9), phase: 'action' });
    game.players[0]!.position = 1;
    expect(canTake(game)).toBe(false);
    expect(() => applyAction(game, { type: 'take' })).toThrow(IllegalActionError);
  });

  it('drops a held treasure onto an empty space only', () => {
    let game = gameWith({ path: ruins(null, 9), phase: 'action' });
    game.players[0]!.position = 1;
    game.players[0]!.holding = [[chip(12)]];
    expect(canDrop(game)).toBe(true);
    game = applyAction(game, { type: 'drop', treasureIndex: 0 });
    expect(game.players[0]!.holding).toHaveLength(0);
    expect(cellAt(game, 1)).toEqual({ kind: 'treasure', chips: [chip(12)] });
  });

  it('refuses to drop onto an occupied ruin space', () => {
    const game = gameWith({ path: ruins(4, 9), phase: 'action' });
    game.players[0]!.position = 1;
    game.players[0]!.holding = [[chip(12)]];
    expect(canDrop(game)).toBe(false);
    expect(() => applyAction(game, { type: 'drop', treasureIndex: 0 })).toThrow(IllegalActionError);
  });

  it('passes play to the next diver after one action', () => {
    let game = gameWith({ path: ruins(7, 9), phase: 'action' });
    game.players[0]!.position = 1;
    game = applyAction(game, { type: 'take' });
    expect(game.currentPlayerIndex).toBe(1);
    expect(game.phase).toBe('declare');
  });

  it('skips divers who are already back aboard', () => {
    let game = gameWith({ phase: 'action' }, 3);
    game.players[1]!.returned = true;
    game = applyAction(game, { type: 'pass' });
    expect(game.currentPlayerIndex).toBe(2);
  });
});
