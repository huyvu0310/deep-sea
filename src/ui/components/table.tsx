import type { GameAction } from '../../engine';
import type { GameView } from '../../net/view';
import { AirHud } from './air-hud';
import { AppHeader } from './app-header';
import { ChipGuide } from './chip-guide';
import { Controls } from './controls';
import { LogPanel } from './log-panel';
import { PlayerList } from './player-list';
import { Route } from './route';
import { GameOver, RoundEnd } from './round-end';

export interface TableProps {
  view: GameView;
  dispatch: (action: GameAction) => void;
  error: string | null;
  /** The seat this browser controls; null at a hot-seat table, which plays all of them. */
  youId: string | null;
  onRestart: (() => void) | null;
  onLeave: () => void;
  leaveLabel: string;
  tableCode: string;
  mode: string;
  banner?: string | null;
}

/** The board itself — identical whether the game is hot-seat or online. */
export function Table({
  view,
  dispatch,
  error,
  youId,
  onRestart,
  onLeave,
  leaveLabel,
  tableCode,
  mode,
  banner,
}: TableProps) {
  const active = view.players[view.currentPlayerIndex];
  const yourTurn = youId === null || active?.id === youId;
  const stillDiving = view.players.filter((p) => !p.returned).length;

  return (
    <div className="game-shell">
      <AppHeader
        subtitle={`${mode} // ROUND ${view.round} OF ${view.totalRounds}`}
        code={tableCode}
        divers={stillDiving}
      />

      <div className="dashboard">
        <aside className="left-panel">
          {banner && <p className="banner">{banner}</p>}
          <PlayerList state={view} {...(youId ? { youId } : {})} />
          <Controls state={view} dispatch={dispatch} error={error} yourTurn={yourTurn} />
          <LogPanel lines={view.log} />
          <button className="btn btn-ghost panel-quit" onClick={onLeave}>
            {leaveLabel}
          </button>
        </aside>

        <main className="board-panel">
          {/* The shared tank sits above the submarine, where every diver's
              attention already is, rather than buried in the side panel. */}
          <div className="board-hud">
            <AirHud state={view} />
            <ChipGuide path={view.path} />
          </div>
          <Route state={view} />
        </main>
      </div>

      {view.phase === 'roundEnd' && (
        <RoundEnd state={view} dispatch={dispatch} canAdvance={yourTurn || youId !== null} />
      )}
      {view.phase === 'gameOver' && <GameOver state={view} onRestart={onRestart} />}
    </div>
  );
}
