import { useEffect, useLayoutEffect, useRef, useState } from 'react';

/** How long a diver takes to swim between two spaces. */
const TRAVEL_MS = 460;
const TRAVEL_EASING = 'cubic-bezier(0.34, 1.16, 0.64, 1)';

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
export function useTravelTransitions(enabled: boolean): void {
  const previous = useRef(new Map<string, DOMRect>());

  useLayoutEffect(() => {
    const nodes = Array.from(document.querySelectorAll<HTMLElement>('[data-travel-id]'));
    const current = new Map<string, DOMRect>();

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

      node.animate(
        [{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'translate(0, 0)' }],
        { duration: TRAVEL_MS, easing: TRAVEL_EASING },
      );
    }

    previous.current = current;
  });
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
