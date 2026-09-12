import type { RollResult } from '../../engine';
import type { GameView } from '../../net/view';
import { LEVEL_STYLES } from '../theme';
import type { ActionShow } from '../use-action-presentation';
import { ArrowUpIcon } from './icons';

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
  action,
  onDismissAction,
  colorOf,
}: {
  view: GameView;
  roll: RollResult | null;
  settled: boolean;
  awaitingTap: boolean;
  onDismiss: () => void;
  action: ActionShow | null;
  onDismissAction: () => void;
  colorOf: (actorId: string) => string | null;
}) {
  // A roll is the bigger moment, so it takes the screen if both are pending.
  if (!roll && action) {
    return <ActionOverlay view={view} action={action} onDismiss={onDismissAction} colorOf={colorOf} />;
  }
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


/** Lifting treasure, or turning for the surface — brief, and self-clearing. */
function ActionOverlay({
  view,
  action,
  onDismiss,
  colorOf,
}: {
  view: GameView;
  action: ActionShow;
  onDismiss: () => void;
  colorOf: (actorId: string) => string | null;
}) {
  const diver = view.players.find((player) => player.id === action.actorId);
  const diverColor = colorOf(action.actorId) ?? '#00f5d4';
  const zone = action.level ? LEVEL_STYLES[action.level] : null;
  const accent = action.kind === 'scoop' ? (zone?.color ?? '#00f5d4') : '#3b82f6';

  return (
    <div className="turn-overlay turn-overlay-brief" onClick={onDismiss} role="presentation">
      <div
        className="overlay-glow"
        style={{ background: `radial-gradient(circle, ${accent}22, transparent 70%)` }}
      />

      <p className="overlay-who">
        <i style={{ background: diverColor, boxShadow: `0 0 10px ${diverColor}` }} />
        {(diver?.name ?? 'DIVER').toUpperCase()}
      </p>

      {action.kind === 'scoop' ? (
        <div className="stage">
          <p className="stage-label stage-label-still" style={{ color: accent }}>
            CHIP SECURED
          </p>

          <div className="medallion-wrap">
            {SPARKS.map((spark, i) => (
              <span
                key={i}
                className="spark"
                style={{
                  background: accent,
                  boxShadow: `0 0 8px ${accent}`,
                  ['--sx' as string]: spark[0],
                  ['--sy' as string]: spark[1],
                  animationDelay: `${0.12 + i * 0.05}s`,
                }}
              />
            ))}
            <span className="medallion-ring" style={{ borderColor: accent }} />
            <span
              className="medallion"
              style={{
                borderColor: accent,
                background: `radial-gradient(circle at 35% 30%, ${accent}44, ${accent}14)`,
                boxShadow: `0 0 40px ${accent}55, inset 0 0 26px ${accent}22`,
                color: accent,
              }}
            >
              {zone?.glyph ?? '×'}
              {action.chips > 1 && <b>×{action.chips}</b>}
            </span>
          </div>

          <div className="stage-result">
            <strong style={{ color: accent, textShadow: `0 0 30px ${accent}77` }}>
              +{action.chips}
            </strong>
            <small>
              {action.chips === 1 ? 'CHIP' : 'CHIPS'}
              <em>{zone ? `${zone.depth} zone · value sealed` : 'value sealed'}</em>
            </small>
          </div>
        </div>
      ) : (
        <div className="stage">
          <p className="stage-label stage-label-still" style={{ color: accent }}>
            TURNING BACK
          </p>

          <div className="uturn">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <span key={i} className="uturn-bubble" style={{ left: `${12 + i * 15}%`, animationDelay: `${i * 0.18}s` }} />
            ))}
            <svg viewBox="0 0 180 180" width="180" height="180" aria-hidden="true">
              <circle cx="90" cy="90" r="70" fill="none" stroke="rgba(59,130,246,0.12)" strokeWidth="2" />
              <path
                className="uturn-arc"
                d="M 90 20 A 70 70 0 1 0 90 160"
                fill="none"
                stroke={accent}
                strokeWidth="3"
                strokeLinecap="round"
              />
            </svg>
            <span className="uturn-arrow" style={{ borderColor: accent, color: accent }}>
              <ArrowUpIcon size={26} />
            </span>
          </div>

          <p className="stage-note uturn-note">Heading for the SS-Orion — no turning back now.</p>
        </div>
      )}
    </div>
  );
}

/** Where the sparks fly, as x/y offsets from the medallion. */
const SPARKS: [string, string][] = [
  ['-62px', '-70px'],
  ['66px', '-54px'],
  ['-46px', '58px'],
  ['70px', '42px'],
  ['-84px', '6px'],
  ['82px', '-14px'],
  ['8px', '-88px'],
  ['-14px', '80px'],
];
