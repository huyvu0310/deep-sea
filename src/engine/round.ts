import type { Chip, GameState, LogEntry, PathCell, Player, RoundSummary } from './types';
import { playerAtRisk, roundHaul } from './scoring';

export const RESTACK_SIZE = 3;

/**
 * Work out who made it back and what the drowned divers left behind.
 *
 * Chips are collected starting with the deepest diver, then split into stacks
 * of three; a leftover stack of one or two is kept as-is. The board is not
 * changed here so the end-of-round screen can still show where everyone sank.
 */
export function summarizeRound(state: GameState): RoundSummary {
  const drownedDivers = state.players
    .filter((p) => !p.returned)
    .sort((a, b) => b.position - a.position);

  const lostChips: Chip[] = [];
  for (const diver of drownedDivers) {
    for (const treasure of diver.holding) lostChips.push(...treasure);
  }

  const restacked: Chip[][] = [];
  for (let i = 0; i < lostChips.length; i += RESTACK_SIZE) {
    restacked.push(lostChips.slice(i, i + RESTACK_SIZE));
  }

  const describe = (p: Player) => ({
    playerId: p.id,
    tokens: p.holding.length,
    value: playerAtRisk(p),
  });

  return {
    round: state.round,
    survivors: state.players
      .filter((p) => p.returned)
      .map((p) => ({ playerId: p.id, ...roundHaul(p, state.round) })),
    drowned: drownedDivers.map(describe),
    restacked,
  };
}

/**
 * Rebuild the route for the next round: empty spaces are removed so the route
 * shortens, then the drowned divers' stacks are added at the far end as bait.
 */
export function rebuildPath(path: readonly PathCell[], restacked: readonly Chip[][]): PathCell[] {
  const remaining = path.filter((cell): cell is Extract<PathCell, { kind: 'treasure' }> =>
    cell.kind === 'treasure',
  );
  const next: PathCell[] = remaining.map((cell) => ({ kind: 'treasure', chips: cell.chips }));
  for (const stack of restacked) next.push({ kind: 'treasure', chips: stack.slice() });
  return next;
}

/** Send every diver back to the submarine with empty hands for a fresh round. */
export function resetDivers(players: readonly Player[]): Player[] {
  return players.map((p) => ({
    ...p,
    position: 0,
    direction: 'down' as const,
    holding: [],
    returned: false,
  }));
}

export function describeSummary(
  summary: RoundSummary,
  nameOf: (id: string) => string,
): LogEntry[] {
  const lines: LogEntry[] = [];
  // Values stay secret until scoring, so these lines count tokens only.
  for (const entry of summary.survivors) {
    lines.push({
      actorId: entry.playerId,
      text:
        entry.tokens > 0
          ? `${nameOf(entry.playerId)} surfaced with ${entry.tokens} treasure.`
          : `${nameOf(entry.playerId)} surfaced empty-handed.`,
    });
  }
  for (const entry of summary.drowned) {
    lines.push({
      actorId: entry.playerId,
      text:
        entry.tokens > 0
          ? `${nameOf(entry.playerId)} ran out of air and lost ${entry.tokens} treasure.`
          : `${nameOf(entry.playerId)} ran out of air empty-handed.`,
    });
  }
  if (summary.restacked.length > 0) {
    lines.push({
      actorId: null,
      text: `${summary.restacked.length} stack(s) sank to the end of the route.`,
    });
  }
  return lines;
}
