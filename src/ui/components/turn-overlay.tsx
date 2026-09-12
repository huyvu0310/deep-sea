import { useEffect, useRef, useState } from 'react';
import type { RollResult } from '../../engine';
import type { GameView } from '../../net/view';
import { LEVEL_STYLES } from '../theme';
import { usePrefersReducedMotion } from '../use-motion';

/** Beats of the sequence, in milliseconds. */
const ROLLING_MS = 1000;
const RESULT_MS = 900;
const STEP_MS = 220;
const ARRIVED_MS = 700;
const FADE_MS = 400;

type Beat = 'rolling' | 'result' | 'moving' | 'arrived' | 'fading';

/**
 * The turn played out full screen: the dice tumble, settle on a result, and
 * then the diver's route lights up space by space.
 *
 * It runs for every player at the table, not only the one who rolled, which is
 * the point — at an online table you cannot see anyone else's hands. It dismisses
 * itself so nobody has to click to let the game continue, and a click anywhere
 * skips the rest.
 */
export function TurnOverlay({
  view,
  colorOf,
}: {
  view: GameView;
  colorOf: (actorId: string) => string | null;
}) {
  const reducedMotion = usePrefersReducedMotion();
  const [roll, setRoll] = useState<RollResult | null>(null);
  const [beat, setBeat] = useState<Beat>('rolling');

  const rollKey = view.lastRoll
    ? `${view.lastRoll.actorId}-${view.lastRoll.dice[0]}-${view.lastRoll.dice[1]}-${view.lastRoll.moved}`
    : null;
  // Seeded with whatever is already on the table, so joining or reconnecting
  // mid-game does not replay a roll that happened before you arrived.
  const seen = useRef(rollKey);

  useEffect(() => {
    if (rollKey === seen.current) return;
    seen.current = rollKey;
    if (!view.lastRoll || reducedMotion) return;

    const current = view.lastRoll;
    setRoll(current);
    setBeat('rolling');

    const steps = current.travel.length;
    const settleAt = ROLLING_MS;
    const swimAt = settleAt + RESULT_MS;
    const landedAt = swimAt + Math.max(1, steps) * STEP_MS;

    const timers = [
      setTimeout(() => setBeat('result'), settleAt),
      setTimeout(() => setBeat(steps > 0 ? 'moving' : 'arrived'), swimAt),
      setTimeout(() => setBeat('arrived'), landedAt),
      setTimeout(() => setBeat('fading'), landedAt + ARRIVED_MS),
      setTimeout(() => setRoll(null), landedAt + ARRIVED_MS + FADE_MS),
    ];
    return () => timers.forEach(clearTimeout);
  }, [rollKey, view.lastRoll, reducedMotion]);

  if (!roll) return null;

  const diver = view.players.find((player) => player.id === roll.actorId);
  const color = colorOf(roll.actorId) ?? '#00f5d4';

  return (
    <div
      className={`turn-overlay${beat === 'fading' ? ' turn-overlay-out' : ''}`}
      onClick={() => setRoll(null)}
      role="presentation"
    >
      <div className="overlay-glow" style={{ background: `radial-gradient(circle, ${color}22, transparent 70%)` }} />

      <p className="overlay-who">
        <i style={{ background: color, boxShadow: `0 0 10px ${color}` }} />
        {(diver?.name ?? 'DIVER').toUpperCase()}
      </p>

      {beat === 'rolling' || beat === 'result' ? (
        <RollStage roll={roll} settled={beat === 'result'} />
      ) : (
        // 'fading' still shows the landing: treating only 'arrived' as arrived
        // made the stage fall back to the swim and replay it during the fade.
        <MoveStage
          view={view}
          roll={roll}
          color={color}
          arrived={beat === 'arrived' || beat === 'fading'}
        />
      )}

      <p className="overlay-skip">TAP ANYWHERE TO SKIP</p>
    </div>
  );
}

/** The dice, tumbling then landing. */
function RollStage({ roll, settled }: { roll: RollResult; settled: boolean }) {
  return (
    <div className="stage">
      <p className={`stage-label${settled ? ' stage-label-still' : ''}`}>
        {settled ? 'ROLLED' : 'ROLLING . . .'}
      </p>

      <div className="cubes">
        <DiceCube value={roll.dice[0]} settled={settled} />
        <span className="cubes-plus">+</span>
        <DiceCube value={roll.dice[1]} settled={settled} spinOffset />
      </div>

      {settled && (
        <div className="stage-result">
          {[0, 1, 2].map((i) => (
            <span key={i} className="ripple" style={{ animationDelay: `${i * 0.2}s` }} />
          ))}
          <strong>{roll.moved}</strong>
          <small>
            {roll.moved === 1 ? 'SPACE' : 'SPACES'}
            <em>
              ({roll.dice[0]} + {roll.dice[1]}
              {roll.total !== roll.moved ? ` − ${roll.total - roll.moved} carried` : ''})
            </em>
          </small>
        </div>
      )}
    </div>
  );
}

/**
 * A die in this game is faced 1,2,3,1,2,3 — the same as the one in the box —
 * so opposite faces repeat and any value can be landed by a quarter turn.
 */
const CUBE_FACES: { value: number; transform: string }[] = [
  { value: 1, transform: 'translateZ(60px)' },
  { value: 1, transform: 'rotateY(180deg) translateZ(60px)' },
  { value: 2, transform: 'rotateY(90deg) translateZ(60px)' },
  { value: 2, transform: 'rotateY(-90deg) translateZ(60px)' },
  { value: 3, transform: 'rotateX(90deg) translateZ(60px)' },
  { value: 3, transform: 'rotateX(-90deg) translateZ(60px)' },
];

/** Pip layout per face, on a 100×100 grid. */
const PIPS: Record<number, [number, number][]> = {
  1: [[50, 50]],
  2: [[28, 28], [72, 72]],
  3: [[26, 26], [50, 50], [74, 74]],
};

function DiceCube({
  value,
  settled,
  spinOffset = false,
}: {
  value: number;
  settled: boolean;
  spinOffset?: boolean;
}) {
  return (
    <div className="cube-scene">
      <div
        className={`cube${settled ? ` cube-land-${value}` : ' cube-tumble'}`}
        style={spinOffset && !settled ? { animationDelay: '-0.2s' } : undefined}
      >
        {CUBE_FACES.map((face, i) => (
          <span key={i} className="cube-face" style={{ transform: face.transform }}>
            <svg viewBox="0 0 100 100" width="120" height="120" aria-hidden="true">
              {(PIPS[face.value] ?? []).map(([cx, cy], p) => (
                <circle key={p} cx={cx} cy={cy} r={8} fill="#1a1206" />
              ))}
            </svg>
          </span>
        ))}
      </div>
    </div>
  );
}

/** The route lighting up space by space, ending on where the diver stopped. */
function MoveStage({
  view,
  roll,
  color,
  arrived,
}: {
  view: GameView;
  roll: RollResult;
  color: string;
  arrived: boolean;
}) {
  const [reached, setReached] = useState(-1);

  useEffect(() => {
    if (arrived) {
      setReached(roll.travel.length - 1);
      return;
    }
    setReached(-1);
    const timers = roll.travel.map((_, i) => setTimeout(() => setReached(i), i * STEP_MS));
    return () => timers.forEach(clearTimeout);
  }, [arrived, roll.travel]);

  const destination = roll.travel.at(-1) ?? 0;
  const zone = zoneOf(view, destination);

  if (roll.travel.length === 0) {
    return (
      <div className="stage">
        <p className="stage-label stage-label-still">TOO LADEN TO MOVE</p>
        <p className="stage-note">Every chip carried costs a space.</p>
      </div>
    );
  }

  return (
    <div className="stage">
      <p className={`stage-label${arrived ? ' stage-label-still' : ''}`} style={{ color }}>
        {arrived ? (destination === 0 ? 'ABOARD' : 'ARRIVED') : 'SWIMMING . . .'}
      </p>

      {!arrived && (
        <div className="track">
          {roll.travel.map((space, i) => {
            const style = zoneOf(view, space);
            const lit = i <= reached;
            const here = i === reached;
            return (
              <span
                key={`${space}-${i}`}
                className={`track-tile${lit ? ' track-tile-lit' : ''}${here ? ' track-tile-here' : ''}`}
                style={
                  lit
                    ? {
                        borderColor: style?.color ?? color,
                        background: `${style?.color ?? color}1f`,
                        boxShadow: here ? `0 0 20px ${style?.color ?? color}66` : undefined,
                      }
                    : undefined
                }
              >
                <b>{space === 0 ? 'SUB' : `#${space}`}</b>
                <i style={lit ? { color: style?.color ?? color } : undefined}>
                  {space === 0 ? '⌂' : (style?.glyph ?? '×')}
                </i>
              </span>
            );
          })}
        </div>
      )}

      {arrived && (
        <div className="landing">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="ripple"
              style={{ animationDelay: `${i * 0.22}s`, borderColor: `${zone?.color ?? color}99` }}
            />
          ))}
          <div
            className="landing-tile"
            style={{
              borderColor: zone?.color ?? color,
              background: `${zone?.color ?? color}22`,
              boxShadow: `0 0 46px ${zone?.color ?? color}55`,
            }}
          >
            <small>{destination === 0 ? 'SUBMARINE' : `SPACE #${destination}`}</small>
            <b style={{ color: zone?.color ?? color }}>
              {destination === 0 ? '⌂' : (zone?.glyph ?? '×')}
            </b>
          </div>
          <p className="landing-depth" style={{ color: zone?.color ?? '#64748b' }}>
            {destination === 0 ? 'SAFELY ABOARD' : (zone ? `${zone.depth} DEPTH` : 'BARE SEABED')}
          </p>
        </div>
      )}
    </div>
  );
}

/** The depth zone of a space, or null for the submarine and bare seabed. */
function zoneOf(view: GameView, space: number) {
  if (space <= 0) return null;
  const cell = view.path[space - 1];
  if (!cell || cell.kind !== 'treasure') return null;
  const level = cell.chips[0]?.level;
  return level ? LEVEL_STYLES[level] : null;
}
