import { useEffect, useRef, useState } from 'react';
import type { GameAction } from '../../engine';
import type { GameView } from '../../net/view';
import { usePrefersReducedMotion } from '../use-motion';
import { LEVEL_STYLES } from '../theme';
import { ChipFace } from './chip-face';
import { ArrowDownIcon, DiceIcon, ScoopIcon, TrashIcon, TrendingUpIcon } from './icons';

export interface ControlsProps {
  state: GameView;
  dispatch: (action: GameAction) => void;
  error: string | null;
  /** False when it is somebody else's turn at an online table. */
  yourTurn: boolean;
}

/**
 * Dice readout plus the action console. It offers only the moves the engine
 * reported as legal, so the rules live in one place and the client stays dumb.
 */
export function Controls({ state, dispatch, error, yourTurn }: ControlsProps) {
  const player = state.players[state.currentPlayerIndex];
  if (!player) return null;
  const playing = state.phase === 'declare' || state.phase === 'roll' || state.phase === 'action';

  return (
    <section className="turn-hud">
      <DiceDeck state={state} />

      <div className="action-console">
        {!playing ? null : !yourTurn ? (
          <p className="console-wait">Waiting for {player.name} to move…</p>
        ) : (
          <>
            {state.phase === 'declare' && <DeclareActions state={state} dispatch={dispatch} />}
            {state.phase === 'roll' && <RollActions dispatch={dispatch} held={player.holding.length} />}
            {state.phase === 'action' && <TurnActions state={state} dispatch={dispatch} />}
          </>
        )}
        {error && <p className="console-error">{error}</p>}
      </div>
    </section>
  );
}

/**
 * How long the dice tumble before showing what was actually rolled. The board
 * waits this long before swimming the diver, so the result is known first.
 */
export const DICE_SETTLE_MS = 1100;
const TUMBLE_MS = DICE_SETTLE_MS;
const TUMBLE_FRAME_MS = 80;

/**
 * Shows the last roll: how far the diver swam, and the raw dice behind it.
 *
 * The engine has already resolved the roll by the time this renders, so the
 * tumble is pure theatre over a known result — it never changes the outcome,
 * and it is skipped entirely for viewers who asked for reduced motion.
 */
function DiceDeck({ state }: { state: GameView }) {
  const roll = state.lastRoll;
  const reducedMotion = usePrefersReducedMotion();
  const [tumbling, setTumbling] = useState(false);
  const [faces, setFaces] = useState<[number, number]>([1, 1]);
  // Compared by value, not identity: every server message is freshly parsed, so
  // an identical roll object arrives as a new reference and would otherwise
  // look like a brand new roll on every update.
  const rollKey = roll ? `${roll.dice[0]}-${roll.dice[1]}-${roll.moved}` : null;
  const lastSeen = useRef(rollKey);

  useEffect(() => {
    if (rollKey === lastSeen.current) return;
    lastSeen.current = rollKey;
    if (rollKey === null || reducedMotion) return;

    setTumbling(true);
    const face = () => (Math.floor(Math.random() * 3) + 1) as number;
    const spin = setInterval(() => setFaces([face(), face()]), TUMBLE_FRAME_MS);
    const settle = setTimeout(() => {
      clearInterval(spin);
      setTumbling(false);
    }, TUMBLE_MS);

    return () => {
      clearInterval(spin);
      clearTimeout(settle);
    };
  }, [rollKey, reducedMotion]);

  const shown: [number | null, number | null] = tumbling
    ? faces
    : [roll?.dice[0] ?? null, roll?.dice[1] ?? null];

  return (
    <div className="dice-deck">
      <div className="dice-visuals">
        <Die value={shown[0]} tumbling={tumbling} />
        <Die value={shown[1]} tumbling={tumbling} />
      </div>
      <div className="dice-report">
        <span className="dice-label">DICE ROLL RESULT</span>
        {roll && !tumbling ? (
          <span className="dice-sum dice-sum-settled">
            <strong>
              {roll.moved} {roll.moved === 1 ? 'Space' : 'Spaces'}
            </strong>
            <small>
              ({roll.dice[0]} + {roll.dice[1]}
              {roll.total !== roll.moved ? ` − ${roll.total - roll.moved}` : ''})
            </small>
          </span>
        ) : (
          <span className="dice-sum">
            <strong>{tumbling ? '…' : '—'}</strong>
            <small>{tumbling ? 'rolling' : 'awaiting the first roll'}</small>
          </span>
        )}
      </div>
    </div>
  );
}

/** Pip positions on a 3×3 grid; the dice in this game only ever show 1–3. */
const PIPS: Record<number, number[]> = { 1: [4], 2: [0, 8], 3: [0, 4, 8] };

function Die({ value, tumbling = false }: { value: number | null; tumbling?: boolean }) {
  return (
    <span
      className={`die${value === null ? ' die-idle' : ''}${tumbling ? ' die-tumbling' : ''}`}
    >
      {Array.from({ length: 9 }, (_, i) => (
        <i key={i} className={value !== null && PIPS[value]?.includes(i) ? 'pip pip-on' : 'pip'} />
      ))}
    </span>
  );
}

function DeclareActions({
  state,
  dispatch,
}: {
  state: GameView;
  dispatch: (action: GameAction) => void;
}) {
  const locked = state.legalDirections.length === 1;

  if (locked) {
    return (
      <>
        <div className="primary-actions">
          <button
            className="btn btn-primary"
            onClick={() => dispatch({ type: 'declare', direction: 'up' })}
          >
            <TrendingUpIcon size={18} />
            KEEP ASCENDING
          </button>
        </div>
        <p className="console-hint">Already surfacing — there is no turning back now.</p>
      </>
    );
  }

  return (
    <>
      <div className="primary-actions">
        <button
          className="btn btn-primary"
          onClick={() => dispatch({ type: 'declare', direction: 'down' })}
        >
          <ArrowDownIcon size={18} />
          DIVE DEEPER
        </button>
      </div>
      <div className="secondary-actions">
        <button className="btn btn-ghost" onClick={() => dispatch({ type: 'declare', direction: 'up' })}>
          <TrendingUpIcon size={14} />
          TURN BACK
        </button>
      </div>
      <p className="console-hint">Turning back is permanent.</p>
    </>
  );
}

function RollActions({
  dispatch,
  held,
}: {
  dispatch: (action: GameAction) => void;
  held: number;
}) {
  return (
    <>
      <div className="primary-actions">
        <button className="btn btn-primary" onClick={() => dispatch({ type: 'roll' })}>
          <DiceIcon size={18} />
          ROLL DICE
        </button>
      </div>
      <p className="console-hint">Two dice of 1–3, minus {held} for treasure carried.</p>
    </>
  );
}

/**
 * Putting a treasure back is a genuine choice: the rules let a diver set down
 * any one token they carry, not just the last one picked up. Each option is
 * labelled with its depth zone, which is all a diver actually knows about a
 * face-down chip — two chips from the same zone really are interchangeable.
 */
function DropPicker({
  player,
  dispatch,
}: {
  player: GameView['players'][number];
  dispatch: (action: GameAction) => void;
}) {
  return (
    <div className="drop-picker">
      <span className="drop-title">
        <TrashIcon size={13} />
        LEAVE A CHIP HERE — PICK WHICH
      </span>
      <div className="drop-options">
        {player.holding.map((treasure, index) => {
          const level = treasure[0]?.level;
          const style = level ? LEVEL_STYLES[level] : null;
          const stacked = treasure.length > 1;
          return (
            <button
              key={index}
              className="drop-option"
              onClick={() => dispatch({ type: 'drop', treasureIndex: index })}
              title={
                stacked
                  ? `Put back this stack of ${treasure.length}`
                  : `Put back this ${style?.depth ?? ''} chip`
              }
            >
              <ChipFace chips={treasure} size="sm" />
              <span className="drop-option-text">
                {stacked ? `stack of ${treasure.length}` : (style?.depth ?? '')}
              </span>
            </button>
          );
        })}
      </div>
      <p className="console-hint">Lightens you by one air and one space per turn.</p>
    </div>
  );
}

function TurnActions({
  state,
  dispatch,
}: {
  state: GameView;
  dispatch: (action: GameAction) => void;
}) {
  const player = state.players[state.currentPlayerIndex]!;
  const cell = state.path[player.position - 1];

  return (
    <>
      <div className="primary-actions">
        {state.canTake && cell?.kind === 'treasure' ? (
          <button className="btn btn-outline" onClick={() => dispatch({ type: 'take' })}>
            <ScoopIcon size={18} />
            SCOOP CHIP
            <ChipFace chips={cell.chips} size="sm" />
          </button>
        ) : (
          <button className="btn btn-primary" onClick={() => dispatch({ type: 'pass' })}>
            END TURN
          </button>
        )}
      </div>

      {state.canDrop && <DropPicker player={player} dispatch={dispatch} />}

      {state.canTake && (
        <div className="secondary-actions">
          <button className="btn btn-ghost" onClick={() => dispatch({ type: 'pass' })}>
            LEAVE IT
          </button>
        </div>
      )}

      {cell?.kind === 'empty' && player.holding.length === 0 && (
        <p className="console-hint">Bare seabed, and nothing in hand to leave behind.</p>
      )}
    </>
  );
}
