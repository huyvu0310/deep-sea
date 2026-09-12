import { useState } from 'react';
import type { GameView, ViewPlayer } from '../../net/view';
import { diverColor } from '../theme';
import { ChipFace } from './chip-face';
import { DiverSheet } from './diver-sheet';
import {
  ArrowDownIcon,
  ArrowUpIcon,
  CheckIcon,
  ChevronRightIcon,
  TrophyIcon,
  UserIcon,
  WeightIcon,
} from './icons';

/**
 * The roster, one card per diver. Carried chips are shown on the card because
 * their weight decides the current turn; the full inventory, banked hauls
 * included, opens behind the card. Values stay masked either way.
 */
export function PlayerList({ state, youId }: { state: GameView; youId?: string }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const open = state.players.find((player) => player.id === openId);
  const openIndex = state.players.findIndex((player) => player.id === openId);

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
          onOpen={() => setOpenId(player.id)}
        />
      ))}

      {open && (
        <DiverSheet player={open} color={diverColor(openIndex)} onClose={() => setOpenId(null)} />
      )}
    </section>
  );
}

function PlayerCard({
  player,
  color,
  active,
  isYou,
  onOpen,
}: {
  player: ViewPlayer;
  color: string;
  active: boolean;
  isYou: boolean;
  onOpen: () => void;
}) {
  const held = player.holding.length;

  return (
    <button
      type="button"
      className={`player-card${active ? ' player-card-active' : ''}`}
      onClick={onOpen}
      title={`View ${player.name}'s chips`}
    >
      <span className="card-main">
        <span className="card-left">
          <span
            className="meeple-avatar"
            style={{
              background: color,
              // The diver on turn is lit from their own colour.
              boxShadow: active ? `0 0 12px ${color}66` : undefined,
            }}
            aria-hidden="true"
          >
            <UserIcon size={18} />
          </span>
          <span className="player-info">
            <span className="name-group">
              <span className="player-name">{player.name}</span>
              {isYou && <span className="badge badge-you">YOU</span>}
              {active && <span className="badge badge-turn">TURN</span>}
            </span>
            <span className="player-meta">
              <span className="meta-item">
                <TrophyIcon size={12} />
                {player.score !== null ? 'Score:' : 'Banked:'}
                <b>{player.score !== null ? player.score : player.banked.length}</b>
              </span>
              <span className={`meta-item${held > 0 ? ' meta-loaded' : ''}`}>
                <WeightIcon size={12} />
                Chips:
                <b>{held}</b>
              </span>
            </span>
          </span>
        </span>

        <span className="card-right">
          <PlayerStatus player={player} />
          {held > 0 && !player.returned && <span className="air-cost">-{held} Air/Turn</span>}
        </span>

        <ChevronRightIcon size={14} className="card-chevron" />
      </span>

      {held > 0 && (
        <span className="cargo" aria-label={`${held} treasure carried`}>
          <span className="cargo-label">CARGO</span>
          <span className="cargo-chips">
            {player.holding.map((chips, i) => (
              <ChipFace key={i} chips={chips} />
            ))}
          </span>
        </span>
      )}
    </button>
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
