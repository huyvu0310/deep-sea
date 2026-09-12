import { useCallback, useEffect, useRef, useState } from 'react';
import type { TreasureLevel } from '../engine';
import type { GameView } from '../net/view';
import { classify } from './table-events';

/** How long a scoop or a turnaround is celebrated before play carries on. */
const SHOW_MS = 1500;

export interface ActionShow {
  kind: 'scoop' | 'turn';
  actorId: string;
  /** Depth zone of the chip scooped; null for a turnaround. */
  level: TreasureLevel | null;
  /** How many chips came up at once — a drowned diver's pile comes up whole. */
  chips: number;
}

/**
 * Announces the two turn actions worth a flourish: lifting treasure, and the
 * decision to turn for the surface.
 *
 * Unlike the roll these clear themselves. They confirm something that already
 * happened rather than gating what comes next, and a tap for every scoop would
 * be a tap too many.
 */
export function useActionPresentation(view: GameView, enabled: boolean) {
  const [show, setShow] = useState<ActionShow | null>(null);
  const seen = useRef(view.log.length);

  const dismiss = useCallback(() => setShow(null), []);

  useEffect(() => {
    if (view.log.length <= seen.current) {
      seen.current = Math.min(seen.current, view.log.length);
      return;
    }
    const fresh = view.log.slice(seen.current);
    seen.current = view.log.length;
    if (!enabled) return;

    // Only the most recent one matters; a turn cannot produce two of these.
    let latest: ActionShow | null = null;
    for (const entry of fresh) {
      const kind = classify(entry);
      if (!entry.actorId || (kind !== 'scoop' && kind !== 'turn')) continue;

      const diver = view.players.find((player) => player.id === entry.actorId);
      // The scooped token is the one just added to that diver's hands.
      const taken = kind === 'scoop' ? diver?.holding.at(-1) : undefined;
      latest = {
        kind,
        actorId: entry.actorId,
        level: taken?.[0]?.level ?? null,
        chips: taken?.length ?? 0,
      };
    }
    if (!latest) return;

    setShow(latest);
    const timer = setTimeout(() => setShow(null), SHOW_MS);
    return () => clearTimeout(timer);
  }, [view.log, view.players, enabled]);

  return { show, dismiss };
}
