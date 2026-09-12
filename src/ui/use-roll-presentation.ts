import { useCallback, useEffect, useRef, useState } from 'react';
import type { RollResult } from '../engine';
import type { GameView } from '../net/view';

/** How long the dice tumble before landing on a result. */
export const ROLLING_MS = 1000;
/** How long another diver's result lingers before the table moves on by itself. */
const WATCHING_MS = 1700;
/** Backstop so an unattended table never sits on a result for ever. */
const SAFETY_MS = 20000;

export interface RollPresentation {
  /** The roll being shown, or null when nothing is being presented. */
  roll: RollResult | null;
  /** True once the dice have landed and the result is readable. */
  settled: boolean;
  /** True while waiting for this player to acknowledge their own roll. */
  awaitingTap: boolean;
  dismiss: () => void;
  /** The diver must not set off until the roll has been taken in. */
  swimHeld: boolean;
}

function keyOf(roll: RollResult | null): string | null {
  return roll ? `${roll.actorId}-${roll.dice[0]}-${roll.dice[1]}-${roll.moved}` : null;
}

/**
 * Sequences a roll: the dice tumble, land, and then hold until acknowledged,
 * while the board keeps the diver on the space they left.
 *
 * Whether a roll is still being presented is worked out during render, not in
 * an effect. The board reads it in a layout effect on the very commit that
 * delivers the move, and an effect would settle one render too late — by which
 * point the diver would already have swum.
 *
 * Your own roll waits for you to tap. Somebody else's clears itself after a
 * beat, because making every player dismiss every other player's roll would be
 * several extra taps a turn.
 */
export function useRollPresentation(
  view: GameView,
  youId: string | null,
  enabled: boolean,
): RollPresentation {
  const rollKey = keyOf(view.lastRoll);
  const [dismissed, setDismissed] = useState<string | null>(null);
  const [settledKey, setSettledKey] = useState<string | null>(null);

  // Whatever was already on the table when this browser arrived is not news.
  const alreadyThere = useRef(rollKey);

  const presenting =
    enabled && rollKey !== null && rollKey !== alreadyThere.current && rollKey !== dismissed;

  const dismiss = useCallback(() => setDismissed(keyOf(view.lastRoll)), [view.lastRoll]);

  useEffect(() => {
    if (!presenting || !view.lastRoll) return;
    // A hot-seat table has one person at the screen, so every roll is theirs.
    const mine = youId === null || youId === view.lastRoll.actorId;

    const timers = [
      setTimeout(() => setSettledKey(rollKey), ROLLING_MS),
      setTimeout(() => setDismissed(rollKey), mine ? SAFETY_MS : ROLLING_MS + WATCHING_MS),
    ];
    return () => timers.forEach(clearTimeout);
  }, [presenting, rollKey, view.lastRoll, youId]);

  const settled = presenting && settledKey === rollKey;

  return {
    roll: presenting ? view.lastRoll : null,
    settled,
    awaitingTap: settled,
    dismiss,
    // While the roll is on screen the board stays still; the swim is the payoff
    // for acknowledging it.
    swimHeld: presenting,
  };
}
