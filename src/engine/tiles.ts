import type { Chip, PathCell, RngState, TreasureLevel } from './types';
import { shuffle } from './rng';

/**
 * The 32 ruin chips: four levels of eight, each level holding two chips of
 * every value in its range. Level 1 runs 0-3, level 2 runs 4-7, and so on.
 */
export const LEVEL_VALUE_RANGES: Record<TreasureLevel, [number, number]> = {
  1: [0, 3],
  2: [4, 7],
  3: [8, 11],
  4: [12, 15],
};

export const CHIPS_PER_LEVEL = 8;

export function createChipSet(): Chip[][] {
  return ([1, 2, 3, 4] as TreasureLevel[]).map((level) => {
    const [lo, hi] = LEVEL_VALUE_RANGES[level];
    const chips: Chip[] = [];
    for (let value = lo; value <= hi; value++) {
      chips.push({ level, value }, { level, value });
    }
    return chips;
  });
}

/**
 * Lay out the route: each level is shuffled on its own, then the levels are
 * placed in order, so the deeper you swim the richer — and riskier — it gets.
 */
export function createPath(rng: RngState): { path: PathCell[]; rng: RngState } {
  let state = rng;
  const path: PathCell[] = [];
  for (const level of createChipSet()) {
    const result = shuffle(level, state);
    state = result.state;
    for (const chip of result.items) path.push({ kind: 'treasure', chips: [chip] });
  }
  return { path, rng: state };
}
