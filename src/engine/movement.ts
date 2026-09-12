import type { Direction, Player } from './types';

/** Spaces holding another diver are hopped over and do not cost a step. */
function isOccupied(players: readonly Player[], moverId: string, index: number): boolean {
  return players.some(
    (p) => p.id !== moverId && !p.returned && p.position === index && index > 0,
  );
}

/**
 * Walk `steps` spaces in `direction`, skipping occupied spaces.
 *
 * Swimming down stops at the last space of the route; leftover steps are lost.
 * Swimming up, reaching or passing space 0 means climbing back into the
 * submarine, which is reported as position 0.
 */
export function resolveMovement(
  mover: Player,
  players: readonly Player[],
  pathLength: number,
  steps: number,
  direction: Direction,
): number {
  const delta = direction === 'down' ? 1 : -1;
  let position = mover.position;

  for (let step = 0; step < steps; step++) {
    let next = position + delta;
    while (next >= 1 && next <= pathLength && isOccupied(players, mover.id, next)) {
      next += delta;
    }
    if (direction === 'down') {
      if (next > pathLength) break; // cannot swim past the deepest ruin
    } else if (next <= 0) {
      return 0; // safely aboard
    }
    position = next;
  }
  return position;
}
