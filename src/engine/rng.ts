import type { RngState } from './types';

/**
 * mulberry32: a small, fast, well-distributed 32-bit PRNG. Chosen over
 * Math.random so a game can be replayed exactly from its seed — which is what
 * lets the tests assert on dice and what stops a networked client from
 * re-rolling a result it does not like.
 */
export function nextRandom(state: RngState): { value: number; state: RngState } {
  let t = (state.seed + 0x6d2b79f5) | 0;
  let r = t;
  r = Math.imul(r ^ (r >>> 15), r | 1);
  r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
  return { value: ((r ^ (r >>> 14)) >>> 0) / 4294967296, state: { seed: t } };
}

/** Integer in [0, bound). */
export function nextInt(state: RngState, bound: number): { value: number; state: RngState } {
  const { value, state: next } = nextRandom(state);
  return { value: Math.floor(value * bound), state: next };
}

/** Fisher-Yates using the seeded stream. Returns a new array. */
export function shuffle<T>(items: readonly T[], state: RngState): { items: T[]; state: RngState } {
  const out = items.slice();
  let rng = state;
  for (let i = out.length - 1; i > 0; i--) {
    const step = nextInt(rng, i + 1);
    rng = step.state;
    const j = step.value;
    const a = out[i]!;
    const b = out[j]!;
    out[i] = b;
    out[j] = a;
  }
  return { items: out, state: rng };
}

export function seedFrom(input: number | string): RngState {
  if (typeof input === 'number') return { seed: input | 0 };
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return { seed: h | 0 };
}
