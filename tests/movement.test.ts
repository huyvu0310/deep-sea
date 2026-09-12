import { describe, expect, it } from 'vitest';
import type { Player } from '../src/engine';
import { resolveMovement } from '../src/engine';

function diver(id: string, position: number, extra: Partial<Player> = {}): Player {
  return {
    id,
    name: id,
    position,
    direction: 'down',
    holding: [],
    returned: false,
    banked: [],
    ...extra,
  };
}

/** Where the diver ended up, which is the last space they passed through. */
const endsAt = (travelled: number[], from: number) => travelled.at(-1) ?? from;

describe('movement', () => {
  it('swims down the declared number of spaces, reporting each one', () => {
    const me = diver('me', 0);
    expect(resolveMovement(me, [me], 32, 4, 'down')).toEqual([1, 2, 3, 4]);
  });

  it('hops over occupied spaces without spending a step', () => {
    const me = diver('me', 1);
    const blocker = diver('x', 2);
    // one step from space 1 skips the occupied 2 and lands on 3
    expect(resolveMovement(me, [me, blocker], 32, 1, 'down')).toEqual([3]);
  });

  it('hops over a run of divers in one step', () => {
    const me = diver('me', 1);
    const others = [diver('x', 2), diver('y', 3), diver('z', 4)];
    expect(resolveMovement(me, [me, ...others], 32, 1, 'down')).toEqual([5]);
  });

  it('stops at the deepest ruin and forfeits leftover steps', () => {
    const me = diver('me', 30);
    const travelled = resolveMovement(me, [me], 32, 6, 'down');
    expect(travelled).toEqual([31, 32]);
    expect(endsAt(travelled, 30)).toBe(32);
  });

  it('ends at the submarine when the diver reaches or passes it', () => {
    const me = diver('me', 2, { direction: 'up' });
    expect(resolveMovement(me, [me], 32, 5, 'up')).toEqual([1, 0]);
    expect(resolveMovement(me, [me], 32, 2, 'up')).toEqual([1, 0]);
  });

  it('ignores divers already back aboard', () => {
    const me = diver('me', 1);
    const home = diver('x', 0, { returned: true });
    expect(resolveMovement(me, [me, home], 32, 1, 'down')).toEqual([2]);
  });

  it('reports no travel at all on zero steps', () => {
    const me = diver('me', 7);
    const travelled = resolveMovement(me, [me], 32, 0, 'down');
    expect(travelled).toEqual([]);
    expect(endsAt(travelled, 7)).toBe(7);
  });

  it('never reports a space twice, so the swim plays out cleanly', () => {
    const me = diver('me', 0);
    const others = [diver('x', 3), diver('y', 4)];
    const travelled = resolveMovement(me, [me, ...others], 32, 5, 'down');
    expect(new Set(travelled).size).toBe(travelled.length);
    expect(travelled).not.toContain(3);
    expect(travelled).not.toContain(4);
  });
});
