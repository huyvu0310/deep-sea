import type { GameView } from '../../net/view';
import { useFlashOnChange } from '../use-motion';
import { WindIcon } from './icons';

/** Share of the tank left at which the gauge starts warning, then alarming. */
const LOW_AT = 0.4;
const CRITICAL_AT = 0.2;

/**
 * The shared tank — the clock every diver is racing.
 *
 * The gauge warns in stages rather than only at the end: amber once the tank is
 * down to two fifths, red below a fifth. A diver deciding whether to go one
 * space deeper needs that warning while the choice is still open.
 */
export function AirHud({ state }: { state: GameView }) {
  const share = state.startingAir > 0 ? state.air / state.startingAir : 0;
  const pct = Math.max(0, Math.min(100, share * 100));
  const drain = state.players[state.currentPlayerIndex]?.holding.length ?? 0;

  const level = share <= CRITICAL_AT ? 'critical' : share <= LOW_AT ? 'low' : 'ok';
  // Air only ever falls, so any change is a loss worth flagging.
  const justDropped = useFlashOnChange(state.air);

  return (
    <section
      className={`air-hud air-hud-${level}${justDropped ? ' air-hud-drop' : ''}`}
      aria-live={level === 'critical' ? 'polite' : 'off'}
    >
      <div className="hud-header">
        <span className="label-group">
          <WindIcon size={18} />
          <span>SHARED AIR SUPPLY</span>
        </span>
        <strong className="hud-value">
          {state.air} / {state.startingAir}L
        </strong>
      </div>

      <div className="gauge-bar">
        <div
          className="gauge-fill"
          style={{ width: `${pct}%` }}
          role="progressbar"
          aria-valuenow={state.air}
          aria-valuemin={0}
          aria-valuemax={state.startingAir}
          aria-label="Air remaining"
        />
      </div>

      <div className="hud-footer">
        <span>
          ROUND {state.round} / {state.totalRounds}
        </span>
        {level !== 'ok' && (
          <span className="hud-warning">
            {level === 'critical' ? 'AIR CRITICAL' : 'AIR LOW'}
          </span>
        )}
        {drain > 0 && <span className="hud-drain">−{drain} air next turn</span>}
      </div>
    </section>
  );
}
