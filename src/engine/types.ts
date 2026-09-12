/**
 * Core domain types for Deep Sea Adventure.
 *
 * The engine is pure: every exported function takes a state and returns a new
 * state. No I/O, no randomness beyond the explicit seeded RNG carried in state,
 * so a game is fully reproducible from its seed plus the action list.
 */

/** Ruin levels 1-4, drawn as 1-4 dots on the physical chip. */
export type TreasureLevel = 1 | 2 | 3 | 4;

/** A single treasure chip. */
export interface Chip {
  level: TreasureLevel;
  value: number;
}

/**
 * One carried token. A token is normally a single chip, but chips dropped by
 * drowned divers are restacked in threes and from then on move as one token:
 * a stack costs one air per turn and slows movement by one, like any chip.
 */
export type Treasure = Chip[];

/** A space on the dive route. Picking a treasure up leaves the space empty. */
export type PathCell =
  | { kind: 'treasure'; chips: Chip[] }
  | { kind: 'empty' };

export type Direction = 'down' | 'up';

/** Treasure carried safely aboard, tagged with the round it was landed in. */
export interface BankedTreasure {
  round: number;
  chips: Chip[];
}

export interface Player {
  id: string;
  name: string;
  /** 0 is the submarine; 1..path.length are route spaces. */
  position: number;
  direction: Direction;
  /** Tokens held in the water. Lost entirely if the diver drowns. */
  holding: Treasure[];
  /** True once back aboard; the diver takes no further turns this round. */
  returned: boolean;
  /** Treasure carried safely aboard. Scored at game end. */
  banked: BankedTreasure[];
}

/**
 * Turn phases. `declare` and `action` await player input; `roll` awaits the
 * dice. `roundEnd` and `gameOver` hold so the UI can show what happened before
 * the next round is dealt.
 */
export type Phase = 'declare' | 'roll' | 'action' | 'roundEnd' | 'gameOver';

export interface RollResult {
  /**
   * The diver who rolled. Kept on the roll itself so it can still be shown
   * after play has moved on — the roll that carries someone home ends their
   * turn immediately, and would otherwise vanish before anyone saw it.
   */
  actorId: string;
  dice: [number, number];
  /** Raw dice sum, before the carried-treasure penalty. */
  total: number;
  /** Spaces actually stepped, i.e. max(0, total - tokens held). */
  moved: number;
  /**
   * Every space passed through, in order, ending where the diver stopped.
   * Empty when they were too laden to move. Lets the interface play the swim
   * out space by space without re-deriving the rules.
   */
  travel: number[];
}

/** What happened when the air ran out, kept for the end-of-round screen. */
export interface RoundSummary {
  round: number;
  survivors: { playerId: string; tokens: number; value: number }[];
  drowned: { playerId: string; tokens: number; value: number }[];
  /** Stacks of up to 3 chips appended to the end of the route. */
  restacked: Chip[][];
}

/**
 * One line of commentary, tagged with the diver who caused it so the interface
 * can say plainly who did what. Table-level events (a round ending, the air
 * running out) carry no actor.
 */
export interface LogEntry {
  text: string;
  actorId: string | null;
}

export interface RngState {
  seed: number;
}

export interface GameState {
  round: number;
  totalRounds: number;
  air: number;
  startingAir: number;
  path: PathCell[];
  players: Player[];
  currentPlayerIndex: number;
  phase: Phase;
  lastRoll: RollResult | null;
  rng: RngState;
  /** Set when air hits 0. The active diver finishes their turn, then the round ends. */
  airDepleted: boolean;
  roundSummary: RoundSummary | null;
  log: LogEntry[];
}

export type GameAction =
  | { type: 'declare'; direction: Direction }
  | { type: 'roll' }
  | { type: 'take' }
  | { type: 'drop'; treasureIndex: number }
  | { type: 'pass' }
  | { type: 'continue' };
