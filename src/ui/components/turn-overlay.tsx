import type { RollResult } from '../../engine';
import type { GameView } from '../../net/view';

/**
 * The dice, played out full screen: they tumble, land, and then hold on the
 * result until it has been taken in. The swim itself is not drawn here — it
 * happens on the real board once this clears, so what you watch is the actual
 * route rather than a diagram of it.
 */
export function TurnOverlay({
  view,
  roll,
  settled,
  awaitingTap,
  onDismiss,
  colorOf,
}: {
  view: GameView;
  roll: RollResult | null;
  settled: boolean;
  awaitingTap: boolean;
  onDismiss: () => void;
  colorOf: (actorId: string) => string | null;
}) {
  if (!roll) return null;

  const diver = view.players.find((player) => player.id === roll.actorId);
  const color = colorOf(roll.actorId) ?? '#00f5d4';
  const carried = roll.total - roll.moved;

  return (
    <div className="turn-overlay" onClick={onDismiss} role="presentation">
      <div
        className="overlay-glow"
        style={{ background: `radial-gradient(circle, ${color}22, transparent 70%)` }}
      />

      <p className="overlay-who">
        <i style={{ background: color, boxShadow: `0 0 10px ${color}` }} />
        {(diver?.name ?? 'DIVER').toUpperCase()}
      </p>

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
                {carried > 0 ? ` − ${carried} carried` : ''})
              </em>
            </small>
            {roll.moved === 0 && <p className="stage-note">Too laden to move.</p>}
          </div>
        )}
      </div>

      {settled && (
        <p className="overlay-skip">
          {awaitingTap ? 'TAP ANYWHERE TO CONTINUE' : 'TAP ANYWHERE TO SKIP'}
        </p>
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
