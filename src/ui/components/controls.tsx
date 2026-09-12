import type { GameAction } from '../../engine';
import type { GameView } from '../../net/view';
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

/** Shows the last roll: how far the diver swam, and the raw dice behind it. */
function DiceDeck({ state }: { state: GameView }) {
  const roll = state.lastRoll;

  return (
    <div className="dice-deck">
      <div className="dice-visuals">
        <Die value={roll?.dice[0] ?? null} />
        <Die value={roll?.dice[1] ?? null} />
      </div>
      <div className="dice-report">
        <span className="dice-label">DICE ROLL RESULT</span>
        {roll ? (
          <span className="dice-sum">
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
            <strong>—</strong>
            <small>awaiting the first roll</small>
          </span>
        )}
      </div>
    </div>
  );
}

/** Pip positions on a 3×3 grid; the dice in this game only ever show 1–3. */
const PIPS: Record<number, number[]> = { 1: [4], 2: [0, 8], 3: [0, 4, 8] };

function Die({ value }: { value: number | null }) {
  return (
    <span className={`die${value === null ? ' die-idle' : ''}`}>
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

      {(state.canDrop || state.canTake) && (
        <div className="secondary-actions">
          {state.canDrop &&
            player.holding.map((treasure, index) => (
              <button
                key={index}
                className="btn btn-ghost"
                onClick={() => dispatch({ type: 'drop', treasureIndex: index })}
              >
                <TrashIcon size={14} />
                DROP
                <ChipFace chips={treasure} size="sm" />
              </button>
            ))}
          {state.canTake && (
            <button className="btn btn-ghost" onClick={() => dispatch({ type: 'pass' })}>
              LEAVE IT
            </button>
          )}
        </div>
      )}

      {cell?.kind === 'empty' && player.holding.length === 0 && (
        <p className="console-hint">Bare seabed, and nothing in hand to leave behind.</p>
      )}
    </>
  );
}
