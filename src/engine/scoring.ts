import type { Chip, Player, Treasure } from './types';

export function treasureValue(treasure: Treasure): number {
  return treasure.reduce((sum, chip) => sum + chip.value, 0);
}

export function chipsValue(chips: readonly Chip[]): number {
  return chips.reduce((sum, chip) => sum + chip.value, 0);
}

/** Only treasure carried safely aboard scores. Anything still held is at risk. */
export function playerScore(player: Player): number {
  return player.banked.reduce((sum, entry) => sum + chipsValue(entry.chips), 0);
}

/** What a diver brought home in one specific round. */
export function roundHaul(player: Player, round: number): { tokens: number; value: number } {
  const entries = player.banked.filter((entry) => entry.round === round);
  return {
    tokens: entries.length,
    value: entries.reduce((sum, entry) => sum + chipsValue(entry.chips), 0),
  };
}

/** Value a diver would lose by drowning right now. */
export function playerAtRisk(player: Player): number {
  return player.holding.reduce((sum, treasure) => sum + treasureValue(treasure), 0);
}

export interface Standing {
  playerId: string;
  name: string;
  score: number;
  chips: number;
  rank: number;
}

/**
 * Ranked results. Equal scores share a rank; the box gives no tiebreaker, so
 * a tie is reported as a tie rather than broken by an invented rule.
 */
export function standings(players: readonly Player[]): Standing[] {
  const rows = players
    .map((p) => ({
      playerId: p.id,
      name: p.name,
      score: playerScore(p),
      chips: p.banked.reduce((n, entry) => n + entry.chips.length, 0),
      rank: 0,
    }))
    .sort((a, b) => b.score - a.score);

  rows.forEach((row, index) => {
    const previous = rows[index - 1];
    row.rank = previous && previous.score === row.score ? previous.rank : index + 1;
  });
  return rows;
}
