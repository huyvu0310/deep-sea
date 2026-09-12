import type { GameView } from '../../net/view';
import { WindIcon } from './icons';

/** The shared tank — the clock every diver is racing. */
export function AirHud({ state }: { state: GameView }) {
  const pct = Math.max(0, Math.min(100, (state.air / state.startingAir) * 100));
  const drain = state.players[state.currentPlayerIndex]?.holding.length ?? 0;
  const low = state.air <= 6;

  return (
    <section className={`air-hud${low ? ' air-hud-low' : ''}`}>
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
        {drain > 0 && <span className="hud-drain">−{drain} air next turn</span>}
      </div>
    </section>
  );
}
