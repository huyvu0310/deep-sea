import { useEffect, useRef } from 'react';
import type { GameView } from '../net/view';
import { play } from './sound';

/** Roughly how long one space of the swim takes, for pacing the step sounds. */
const STEP_MS = 260;

/**
 * Plays the table's sounds off the game view, so a move made by anyone is
 * heard — not just moves made in this browser. The dice rattle when they are
 * thrown; the steps wait for the swim to be released, so sound and picture
 * stay together however long the result is left on screen.
 */
export function useSoundCues(view: GameView, swimHeld: boolean): void {
  const lastRoll = useRef<string | null>(null);
  const seenLog = useRef(view.log.length);
  const rattled = useRef<string | null>(null);

  // The dice, as they are thrown.
  useEffect(() => {
    const roll = view.lastRoll;
    const key = roll ? `${roll.actorId}-${roll.dice[0]}-${roll.dice[1]}-${roll.moved}` : null;
    if (key === lastRoll.current) return;
    lastRoll.current = key;
    if (!roll) return;
    play('roll');
  }, [view.lastRoll]);

  // The swim, once the diver is actually let go.
  useEffect(() => {
    const roll = view.lastRoll;
    if (!roll || swimHeld) return;
    const key = `${roll.actorId}-${roll.dice[0]}-${roll.dice[1]}-${roll.moved}`;
    if (key === rattled.current) return;
    rattled.current = key;

    const timers = roll.travel.map((_, i) => setTimeout(() => play('step', i), i * STEP_MS));
    return () => timers.forEach(clearTimeout);
  }, [view.lastRoll, swimHeld]);

  // Treasure and surfacing, read from the commentary so remote moves sound too.
  useEffect(() => {
    if (view.log.length <= seenLog.current) {
      seenLog.current = Math.min(seenLog.current, view.log.length);
      return;
    }
    const fresh = view.log.slice(seenLog.current);
    seenLog.current = view.log.length;

    for (const entry of fresh) {
      if (/scoops up/.test(entry.text)) play('scoop');
      else if (/drops a treasure/.test(entry.text)) play('drop');
      else if (/climbs aboard/.test(entry.text)) play('surface');
      else if (/air runs out/.test(entry.text)) play('alarm');
    }
  }, [view.log]);
}
