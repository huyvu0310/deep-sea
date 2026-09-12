import type { Chip, GameState, PathCell } from '../src/engine';
import { createGame } from '../src/engine';

/** A game whose route is fully controlled, so tests assert on rules not luck. */
export function gameWith(overrides: Partial<GameState> = {}, playerCount = 2): GameState {
  const players = Array.from({ length: playerCount }, (_, i) => ({
    id: `p${i + 1}`,
    name: `Diver ${i + 1}`,
  }));
  return { ...createGame({ players, seed: 1 }), ...overrides };
}

export function chip(value: number): Chip {
  const level = value <= 3 ? 1 : value <= 7 ? 2 : value <= 11 ? 3 : 4;
  return { level: level as Chip['level'], value };
}

export function ruins(...values: (number | number[] | null)[]): PathCell[] {
  return values.map((v) =>
    v === null
      ? { kind: 'empty' as const }
      : { kind: 'treasure' as const, chips: (Array.isArray(v) ? v : [v]).map(chip) },
  );
}
