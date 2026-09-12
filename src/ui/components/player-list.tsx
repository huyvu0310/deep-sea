import type { GameView, ViewPlayer } from '../../net/view';
import { diverColor } from '../theme';
import { ArrowDownIcon, ArrowUpIcon, CheckIcon, TrophyIcon, WeightIcon } from './icons';

/**
 * The roster, one card per diver. Banked treasure is shown as a count while the
 * game runs — the values stay face down until the final reveal.
 */
export function PlayerList({ state, youId }: { state: GameView; youId?: string }) {
  return (
    <section className="players-deck">
      <h2 className="deck-title">PLAYERS &amp; WEIGHT INFLUENCE</h2>
      {state.players.map((player, index) => (
        <PlayerCard
          key={player.id}
          player={player}
          color={diverColor(index)}
          active={index === state.currentPlayerIndex && state.phase !== 'gameOver'}
          isYou={player.id === youId}
        />
      ))}
    </section>
  );
}

function PlayerCard({
  player,
  color,
  active,
  isYou,
}: {
  player: ViewPlayer;
  color: string;
  active: boolean;
  isYou: boolean;
}) {
  const held = player.holding.length;

  return (
    <article className={`player-card${active ? ' player-card-active' : ''}`}>
      <div className="card-left">
        <span className="meeple-avatar" style={{ background: color }} aria-hidden="true" />
        <div className="player-info">
          <div className="name-group">
            <span className="player-name">{player.name}</span>
            {isYou && <span className="badge badge-you">YOU</span>}
            {active && <span className="badge badge-turn">TURN</span>}
          </div>
          <div className="player-meta">
            <span className="meta-item">
              <TrophyIcon size={12} />
              {player.score !== null
                ? `Score: ${player.score}`
                : `Banked: ${player.banked.length}`}
            </span>
            <span className={`meta-item${held > 0 ? ' meta-loaded' : ''}`}>
              <WeightIcon size={12} />
              Chips: {held}
            </span>
          </div>
        </div>
      </div>

      <div className="card-right">
        <PlayerStatus player={player} />
        {held > 0 && !player.returned && <span className="air-cost">-{held} Air/Turn</span>}
      </div>
    </article>
  );
}

function PlayerStatus({ player }: { player: ViewPlayer }) {
  if (player.returned) {
    return (
      <span className="status status-safe">
        <CheckIcon size={10} />
        SAFE
      </span>
    );
  }
  if (player.direction === 'up') {
    return (
      <span className="status status-ascending">
        <ArrowUpIcon size={10} />
        ASCENDING
      </span>
    );
  }
  return (
    <span className="status status-diving">
      <ArrowDownIcon size={10} />
      DIVING
    </span>
  );
}
