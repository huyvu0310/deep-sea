import type {
  Direction,
  GameAction,
  GameState,
  LogEntry,
  PathCell,
  Player,
  RollResult,
  Treasure,
} from './types';
import { nextInt, seedFrom } from './rng';
import { createPath } from './tiles';
import { resolveMovement } from './movement';
import { describeSummary, rebuildPath, resetDivers, summarizeRound } from './round';

export const STARTING_AIR = 25;
export const TOTAL_ROUNDS = 3;
export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 6;
export const DIE_FACES = 3; // each die shows 1,2,3,1,2,3

export interface NewGameOptions {
  players: { id: string; name: string }[];
  seed?: number | string;
  totalRounds?: number;
  startingAir?: number;
}

export function createGame(options: NewGameOptions): GameState {
  const { players, seed = Date.now(), totalRounds = TOTAL_ROUNDS, startingAir = STARTING_AIR } =
    options;

  if (players.length < MIN_PLAYERS || players.length > MAX_PLAYERS) {
    throw new Error(`Deep Sea Adventure needs ${MIN_PLAYERS}-${MAX_PLAYERS} divers`);
  }
  const ids = new Set(players.map((p) => p.id));
  if (ids.size !== players.length) throw new Error('Player ids must be unique');

  const { path, rng } = createPath(seedFrom(seed));

  return {
    round: 1,
    totalRounds,
    air: startingAir,
    startingAir,
    path,
    players: players.map((p) => ({
      id: p.id,
      name: p.name,
      position: 0,
      direction: 'down',
      holding: [],
      returned: false,
      banked: [],
    })),
    currentPlayerIndex: 0,
    phase: 'declare',
    lastRoll: null,
    rng,
    airDepleted: false,
    roundSummary: null,
    log: [{ text: 'Round 1 — the divers drop into the water.', actorId: null }],
  };
}

export function currentPlayer(state: GameState): Player {
  const player = state.players[state.currentPlayerIndex];
  if (!player) throw new Error('No current player');
  return player;
}

/** A diver already swimming up can never turn back down. */
export function legalDirections(state: GameState): Direction[] {
  return currentPlayer(state).direction === 'up' ? ['up'] : ['down', 'up'];
}

export function cellAt(state: GameState, position: number): PathCell | null {
  if (position < 1 || position > state.path.length) return null;
  return state.path[position - 1] ?? null;
}

export function canTake(state: GameState): boolean {
  if (state.phase !== 'action') return false;
  return cellAt(state, currentPlayer(state).position)?.kind === 'treasure';
}

export function canDrop(state: GameState): boolean {
  if (state.phase !== 'action') return false;
  const player = currentPlayer(state);
  return player.holding.length > 0 && cellAt(state, player.position)?.kind === 'empty';
}

/** Thrown for moves the rules forbid, so a networked client cannot cheat by hand. */
export class IllegalActionError extends Error {}

export function applyAction(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'declare':
      return declare(state, action.direction);
    case 'roll':
      return roll(state);
    case 'take':
      return take(state);
    case 'drop':
      return drop(state, action.treasureIndex);
    case 'pass':
      return endTurn(
        withLog(
          state,
          byDiver(currentPlayer(state).id, `${currentPlayer(state).name} leaves the ruins untouched.`),
        ),
      );
    case 'continue':
      return beginNextRound(state);
  }
}

function assertLegal(condition: boolean, message: string): void {
  if (!condition) throw new IllegalActionError(message);
}

function withLog(state: GameState, ...entries: LogEntry[]): GameState {
  return { ...state, log: [...state.log, ...entries] };
}

/** A line caused by a particular diver. */
function byDiver(actorId: string, text: string): LogEntry {
  return { text, actorId };
}

/** A line about the table rather than any one diver. */
function atTable(text: string): LogEntry {
  return { text, actorId: null };
}

function replacePlayer(state: GameState, player: Player): Player[] {
  return state.players.map((p) => (p.id === player.id ? player : p));
}

/**
 * Declare a direction, then spend air. Air drains by one per treasure token
 * held — the whole tension of the game — and hitting zero arms the end of the
 * round, which still waits for this diver to finish their turn.
 */
function declare(state: GameState, direction: Direction): GameState {
  assertLegal(state.phase === 'declare', 'Not the moment to declare a direction');
  const player = currentPlayer(state);
  assertLegal(
    legalDirections(state).includes(direction),
    'A diver swimming up cannot turn back down',
  );

  const cost = player.holding.length;
  const air = Math.max(0, state.air - cost);
  const turning = direction !== player.direction;
  const updated: Player = { ...player, direction };

  let next: GameState = {
    ...state,
    players: replacePlayer(state, updated),
    air,
    airDepleted: state.air - cost <= 0,
    phase: 'roll',
  };
  if (turning) {
    next = withLog(next, byDiver(player.id, `${player.name} turns around and heads for the surface.`));
  }
  if (cost > 0) {
    next = withLog(next, byDiver(player.id, `${player.name} burns ${cost} air (${air} left).`));
  }
  if (next.airDepleted && !state.airDepleted) {
    next = withLog(next, atTable('The air runs out! This is the last turn of the round.'));
  }
  return next;
}

/**
 * Roll two three-sided dice and swim. Every treasure token held costs a step,
 * and a heavily laden diver can end up unable to move at all.
 */
function roll(state: GameState): GameState {
  assertLegal(state.phase === 'roll', 'Nothing to roll right now');
  const player = currentPlayer(state);

  const first = nextInt(state.rng, DIE_FACES);
  const second = nextInt(first.state, DIE_FACES);
  const dice: [number, number] = [first.value + 1, second.value + 1];
  const total = dice[0] + dice[1];
  const moved = Math.max(0, total - player.holding.length);

  const travel = resolveMovement(
    player,
    state.players,
    state.path.length,
    moved,
    player.direction,
  );
  const destination = travel.at(-1) ?? player.position;
  const lastRoll: RollResult = { dice, total, moved, travel };

  let next: GameState = { ...state, rng: second.state, lastRoll };
  next = withLog(
    next,
    byDiver(player.id, `${player.name} rolls ${dice[0]}+${dice[1]} and swims ${moved} space(s).`),
  );

  if (player.direction === 'up' && destination === 0) {
    const haul = player.holding;
    const surfaced: Player = {
      ...player,
      position: 0,
      returned: true,
      holding: [],
      banked: [
        ...player.banked,
        ...haul.map((treasure) => ({ round: state.round, chips: treasure })),
      ],
    };
    // Chips stay face down until the end of the game, so the log never names a
    // value — only how many tokens changed hands.
    next = withLog(
      { ...next, players: replacePlayer(next, surfaced) },
      byDiver(
        player.id,
        haul.length > 0
          ? `${player.name} climbs aboard with ${haul.length} treasure.`
          : `${player.name} climbs aboard empty-handed.`,
      ),
    );
    return endTurn(next);
  }

  const moving: Player = { ...player, position: destination };
  return { ...next, players: replacePlayer(next, moving), phase: 'action' };
}

/** Lift the treasure underfoot, leaving a bare patch of seabed behind. */
function take(state: GameState): GameState {
  assertLegal(canTake(state), 'There is no treasure on this space');
  const player = currentPlayer(state);
  const cell = cellAt(state, player.position);
  if (cell?.kind !== 'treasure') throw new IllegalActionError('There is no treasure here');

  const path = state.path.slice();
  path[player.position - 1] = { kind: 'empty' };
  const holder: Player = { ...player, holding: [...player.holding, cell.chips] };

  return endTurn(
    withLog(
      { ...state, path, players: replacePlayer(state, holder) },
      byDiver(
        player.id,
        `${player.name} scoops up ${cell.chips.length > 1 ? `a stack of ${cell.chips.length}` : 'a ruin chip'}.`,
      ),
    ),
  );
}

/** Set a treasure down on a bare space — lighter breathing, faster swimming. */
function drop(state: GameState, treasureIndex: number): GameState {
  assertLegal(canDrop(state), 'A treasure can only be set down on an empty space');
  const player = currentPlayer(state);
  const treasure: Treasure | undefined = player.holding[treasureIndex];
  if (!treasure) throw new IllegalActionError('No such treasure in hand');

  const path = state.path.slice();
  path[player.position - 1] = { kind: 'treasure', chips: treasure };
  const lighter: Player = {
    ...player,
    holding: player.holding.filter((_, i) => i !== treasureIndex),
  };

  return endTurn(
    withLog(
      { ...state, path, players: replacePlayer(state, lighter) },
      byDiver(player.id, `${player.name} drops a treasure to swim lighter.`),
    ),
  );
}

/** Hand play to the next diver still in the water, or close out the round. */
function endTurn(state: GameState): GameState {
  const everyoneHome = state.players.every((p) => p.returned);
  if (state.airDepleted || everyoneHome) {
    return closeRound(state, everyoneHome);
  }

  let index = state.currentPlayerIndex;
  for (let i = 0; i < state.players.length; i++) {
    index = (index + 1) % state.players.length;
    if (!state.players[index]?.returned) break;
  }
  // The dice belong to the turn that rolled them: clearing here stops the next
  // diver opening their turn staring at somebody else's result.
  return { ...state, currentPlayerIndex: index, phase: 'declare', lastRoll: null };
}

function closeRound(state: GameState, everyoneHome: boolean): GameState {
  const summary = summarizeRound(state);
  const nameOf = (id: string) => state.players.find((p) => p.id === id)?.name ?? id;
  return withLog(
    { ...state, phase: 'roundEnd', roundSummary: summary },
    atTable(
      everyoneHome
        ? `Every diver is back aboard — round ${state.round} ends.`
        : `Round ${state.round} ends.`,
    ),
    ...describeSummary(summary, nameOf),
  );
}

/**
 * Clear the wreckage and deal the next round: empty spaces close up, drowned
 * hauls settle at the far end, and the start player passes along.
 */
function beginNextRound(state: GameState): GameState {
  assertLegal(state.phase === 'roundEnd', 'The round is still in progress');
  const summary = state.roundSummary;
  if (!summary) throw new IllegalActionError('Missing round summary');

  const path = rebuildPath(state.path, summary.restacked);
  const players = resetDivers(state.players);
  const round = state.round + 1;

  if (round > state.totalRounds) {
    return withLog(
      { ...state, players, path, phase: 'gameOver' },
      atTable('The expedition is over.'),
    );
  }

  return withLog(
    {
      ...state,
      round,
      path,
      players,
      air: state.startingAir,
      airDepleted: false,
      roundSummary: null,
      lastRoll: null,
      currentPlayerIndex: (round - 1) % players.length,
      phase: 'declare',
    },
    atTable(`Round ${round} — the route is ${path.length} spaces long.`),
  );
}
