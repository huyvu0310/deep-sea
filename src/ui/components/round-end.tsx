import type { GameAction } from '../../engine';
import type { GameView } from '../../net/view';
import { ChipFace } from './chip-face';

/** End-of-round debrief: who surfaced, who drowned, what sank to the bottom. */
export function RoundEnd({
  state,
  dispatch,
  shared,
}: {
  state: GameView;
  dispatch: (action: GameAction) => void;
  /** True at an online table, where the button moves the round on for everyone. */
  shared: boolean;
}) {
  const summary = state.roundSummary;
  if (!summary) return null;
  const nameOf = (id: string) => state.players.find((p) => p.id === id)?.name ?? id;
  const last = state.round >= state.totalRounds;

  return (
    <div className="overlay">
      <div className="panel-card">
        <h2>Round {summary.round} — the air runs out</h2>

        <div className="debrief">
          <section>
            <h3>Surfaced</h3>
            {summary.survivors.length === 0 ? (
              <p className="muted">Nobody made it back.</p>
            ) : (
              <ul>
                {summary.survivors.map((entry) => (
                  <li key={entry.playerId}>
                    {nameOf(entry.playerId)} — {entry.tokens} treasure secured
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section>
            <h3>Drowned</h3>
            {summary.drowned.length === 0 ? (
              <p className="muted">Everyone got home.</p>
            ) : (
              <ul>
                {summary.drowned.map((entry) => (
                  <li key={entry.playerId}>
                    {nameOf(entry.playerId)} — lost {entry.tokens} treasure
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        {summary.restacked.length > 0 && (
          <section className="restack">
            <h3>Sunk to the end of the route</h3>
            <div className="restack-chips">
              {summary.restacked.map((stack, i) => (
                <ChipFace key={i} chips={stack} />
              ))}
            </div>
          </section>
        )}

        <button className="btn btn-primary" onClick={() => dispatch({ type: 'continue' })}>
          {last ? 'Reveal the haul' : `Start round ${state.round + 1}`}
        </button>
        {shared && (
          <p className="console-hint shared-note">
            Any diver can move the round on — this closes the debrief for everyone.
          </p>
        )}
      </div>
    </div>
  );
}

/** Final scoring — the only moment every chip is turned face up. */
export function GameOver({ state, onRestart }: { state: GameView; onRestart: (() => void) | null }) {
  const table = state.standings ?? [];
  const winners = table.filter((row) => row.rank === 1);
  if (winners.length === 0) return null;

  return (
    <div className="overlay">
      <div className="panel-card">
        <h2>Expedition complete</h2>
        <p className="winner">
          {winners.length > 1
            ? `Tied at ${winners[0]!.score}: ${winners.map((w) => w.name).join(' & ')}`
            : `${winners[0]!.name} wins with ${winners[0]!.score} points`}
        </p>

        <ol className="scores">
          {table.map((row) => {
            const player = state.players.find((p) => p.id === row.playerId);
            return (
              <li key={row.playerId}>
                <span className="scores-rank">{row.rank}</span>
                <span className="scores-name">{row.name}</span>
                <span className="scores-chips">
                  {player?.banked.map((entry, i) => (
                    <ChipFace key={i} chips={entry.chips} size="sm" />
                  ))}
                </span>
                <strong className="scores-value">{row.score}</strong>
              </li>
            );
          })}
        </ol>

        {onRestart && (
          <button className="btn btn-primary" onClick={onRestart}>
            New expedition
          </button>
        )}
      </div>
    </div>
  );
}
