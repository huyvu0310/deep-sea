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

describe('movement', () => {
  it('swims down the declared number of spaces', () => {
    const me = diver('me', 0);
    expect(resolveMovement(me, [me], 32, 4, 'down')).toBe(4);
  });

  it('hops over occupied spaces without spending a step', () => {
    const me = diver('me', 1);
    const blocker = diver('x', 2);
    // one step from space 1 skips the occupied 2 and lands on 3
    expect(resolveMovement(me, [me, blocker], 32, 1, 'down')).toBe(3);
  });

  it('hops over a run of divers in one step', () => {
    const me = diver('me', 1);
    const others = [diver('x', 2), diver('y', 3), diver('z', 4)];
    expect(resolveMovement(me, [me, ...others], 32, 1, 'down')).toBe(5);
  });

  it('stops at the deepest ruin and forfeits leftover steps', () => {
    const me = diver('me', 30);
    expect(resolveMovement(me, [me], 32, 6, 'down')).toBe(32);
  });

  it('returns 0 when the diver reaches or passes the submarine', () => {
    const me = diver('me', 2, { direction: 'up' });
    expect(resolveMovement(me, [me], 32, 5, 'up')).toBe(0);
    expect(resolveMovement(me, [me], 32, 2, 'up')).toBe(0);
  });

  it('ignores divers already back aboard', () => {
    const me = diver('me', 1);
    const home = diver('x', 0, { returned: true });
    expect(resolveMovement(me, [me, home], 32, 1, 'down')).toBe(2);
  });

  it('does not move at all on zero steps', () => {
    const me = diver('me', 7);
    expect(resolveMovement(me, [me], 32, 0, 'down')).toBe(7);
  });
});
