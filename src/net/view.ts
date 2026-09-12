import type {
  Direction,
  GameState,
  RollResult,
  Standing,
  TreasureLevel,
} from '../engine';
import { canDrop, canTake, legalDirections, playerScore, standings } from '../engine';

/**
 * The redacted projection of a game that players are allowed to see.
 *
 * Ruin chips sit face down all game: a player knows a chip's level (the dots on
 * the back) but not its value until the final reveal. The UI renders this type
 * rather than GameState so hidden values never reach a client — over the
 * network or through the browser devtools of a hot-seat table.
 */
export interface ViewChip {
  level: TreasureLevel;
  /** null while the chip is face down. */
  value: number | null;
}

export type ViewCell = { kind: 'treasure'; chips: ViewChip[] } | { kind: 'empty' };

/** A haul carried safely aboard, kept with the round it was landed in. */
export interface ViewBanked {
  round: number;
  chips: ViewChip[];
}

export interface ViewPlayer {
  id: string;
  name: string;
  position: number;
  direction: Direction;
  returned: boolean;
  holding: ViewChip[][];
  banked: ViewBanked[];
  /** null until the expedition ends. */
  score: number | null;
}

export interface ViewRoundSummary {
  round: number;
  survivors: { playerId: string; tokens: number }[];
  drowned: { playerId: string; tokens: number }[];
  restacked: ViewChip[][];
}

export interface GameView {
  round: number;
  totalRounds: number;
  air: number;
  startingAir: number;
  phase: GameState['phase'];
  path: ViewCell[];
  players: ViewPlayer[];
  currentPlayerIndex: number;
  lastRoll: RollResult | null;
  log: string[];
  roundSummary: ViewRoundSummary | null;
  /** Legal moves, decided by the engine so the client never has to know rules. */
  legalDirections: Direction[];
  canTake: boolean;
  canDrop: boolean;
  standings: Standing[] | null;
}

function hide(chips: readonly { level: TreasureLevel; value: number }[], reveal: boolean): ViewChip[] {
  return chips.map((chip) => ({ level: chip.level, value: reveal ? chip.value : null }));
}

/**
 * Project a game into what players may see. Values are unmasked only once the
 * expedition is over and every chip is turned face up for scoring.
 */
export function toView(state: GameState): GameView {
  const reveal = state.phase === 'gameOver';
  const playable = state.phase !== 'roundEnd' && state.phase !== 'gameOver';

  return {
    round: state.round,
    totalRounds: state.totalRounds,
    air: state.air,
    startingAir: state.startingAir,
    phase: state.phase,
    path: state.path.map((cell) =>
      cell.kind === 'treasure'
        ? { kind: 'treasure' as const, chips: hide(cell.chips, reveal) }
        : { kind: 'empty' as const },
    ),
    players: state.players.map((player) => ({
      id: player.id,
      name: player.name,
      position: player.position,
      direction: player.direction,
      returned: player.returned,
      holding: player.holding.map((treasure) => hide(treasure, reveal)),
      banked: player.banked.map((entry) => ({
        round: entry.round,
        chips: hide(entry.chips, reveal),
      })),
      score: reveal ? playerScore(player) : null,
    })),
    currentPlayerIndex: state.currentPlayerIndex,
    lastRoll: state.lastRoll,
    log: state.log,
    roundSummary: state.roundSummary
      ? {
          round: state.roundSummary.round,
          survivors: state.roundSummary.survivors.map((e) => ({
            playerId: e.playerId,
            tokens: e.tokens,
          })),
          drowned: state.roundSummary.drowned.map((e) => ({
            playerId: e.playerId,
            tokens: e.tokens,
          })),
          restacked: state.roundSummary.restacked.map((stack) => hide(stack, reveal)),
        }
      : null,
    legalDirections: playable ? legalDirections(state) : [],
    canTake: canTake(state),
    canDrop: canDrop(state),
    standings: reveal ? standings(state.players) : null,
  };
}
