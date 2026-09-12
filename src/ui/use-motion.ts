import { useEffect, useLayoutEffect, useRef, useState } from 'react';

/** How long a diver takes to cross one space, and the floor for a whole swim. */
const STEP_MS = 260;
const MIN_TRAVEL_MS = 420;
const TRAVEL_EASING = 'cubic-bezier(0.34, 1.16, 0.64, 1)';

/**
 * A swim to play out space by space: which token is moving, the spaces it
 * passes through, and how long to hold before starting — long enough for the
 * dice to settle first, so the result is known before the diver sets off.
 */
export interface TravelPlan {
  travelId: string;
  waypoints: number[];
  delayMs: number;
}

/** Centre of a route space, or of the submarine for space 0. */
function spaceCentre(index: number): { x: number; y: number } | null {
  const node = document.querySelector<HTMLElement>(`[data-space="${index}"]`);
  if (!node) return null;
  const rect = node.getBoundingClientRect();
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}

/** Respect the viewer's system setting; every animation here is decoration. */
export function usePrefersReducedMotion(): boolean {
  const query = '(prefers-reduced-motion: reduce)';
  const [reduced, setReduced] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(query).matches,
  );

  useEffect(() => {
    const media = window.matchMedia(query);
    const update = () => setReduced(media.matches);
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  return reduced;
}

/**
 * FLIP transitions for elements that move between containers.
 *
 * A diver's token is re-parented into a different tile when it swims, so it is
 * a brand new DOM node every turn and cannot simply be transitioned. This
 * records where each tagged element sat on the previous render and replays it
 * from there, which is what makes a diver appear to travel rather than blink
 * from one end of the trench to the other.
 */
export function useTravelTransitions(enabled: boolean, plan: TravelPlan | null = null): void {
  const previous = useRef(new Map<string, DOMRect>());
  const planPlayed = useRef<string | null>(null);

  useLayoutEffect(() => {
    const nodes = Array.from(document.querySelectorAll<HTMLElement>('[data-travel-id]'));
    const current = new Map<string, DOMRect>();
    const planKey = plan ? `${plan.travelId}:${plan.waypoints.join(',')}` : null;

    for (const node of nodes) {
      const id = node.dataset.travelId;
      if (!id) continue;

      const rect = node.getBoundingClientRect();
      current.set(id, rect);

      const before = previous.current.get(id);
      if (!enabled || !before) continue;

      const dx = before.left - rect.left;
      const dy = before.top - rect.top;
      // Sub-pixel drift from reflow is not movement worth animating.
      if (Math.abs(dx) < 1 && Math.abs(dy) < 1) continue;

      const swimming =
        plan !== null && planKey !== null && plan.travelId === id && planPlayed.current !== planKey;

      if (swimming) {
        planPlayed.current = planKey;
        const frames = swimFrames(plan, rect, dx, dy);
        if (frames) {
          node.animate(frames, {
            duration: Math.max(MIN_TRAVEL_MS, plan.waypoints.length * STEP_MS),
            delay: plan.delayMs,
            // Hold the diver at the space they left while the dice are settling.
            fill: 'backwards',
            easing: 'linear',
          });
          continue;
        }
      }

      node.animate(
        [{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'translate(0, 0)' }],
        { duration: MIN_TRAVEL_MS, easing: TRAVEL_EASING },
      );
    }

    previous.current = current;
  });
}

/**
 * Keyframes that carry a token from where it was, through each space in turn,
 * to where it now sits. Offsets are measured against the token's final rect
 * because that is where the DOM has already placed it.
 */
function swimFrames(
  plan: TravelPlan,
  finalRect: DOMRect,
  dx: number,
  dy: number,
): Keyframe[] | null {
  const anchorX = finalRect.left + finalRect.width / 2;
  const anchorY = finalRect.top + finalRect.height / 2;

  const hops: Keyframe[] = [];
  for (const space of plan.waypoints) {
    const centre = spaceCentre(space);
    if (!centre) return null; // a space scrolled out of the DOM; fall back
    hops.push({
      transform: `translate(${centre.x - anchorX}px, ${centre.y - anchorY}px)`,
      easing: TRAVEL_EASING,
    });
  }
  if (hops.length === 0) return null;

  // Start where the token actually was, and finish exactly on its own position
  // so no rounding from the centre measurements is left behind.
  return [
    { transform: `translate(${dx}px, ${dy}px)`, easing: TRAVEL_EASING },
    ...hops.slice(0, -1),
    { transform: 'translate(0, 0)' },
  ];
}

/**
 * Runs `true` for a moment whenever `value` changes, for one-shot flashes that
 * should replay on every change rather than only on mount.
 */
export function useFlashOnChange(value: unknown, ms = 600): boolean {
  const [flashing, setFlashing] = useState(false);
  const previous = useRef(value);

  useEffect(() => {
    if (previous.current === value) return;
    previous.current = value;
    setFlashing(true);
    const timer = setTimeout(() => setFlashing(false), ms);
    return () => clearTimeout(timer);
  }, [value, ms]);

  return flashing;
}
