import type { LogEntry } from '../engine';

/** The kinds of moment worth reacting to, beyond the roll itself. */
export type TableEventKind = 'scoop' | 'drop' | 'turn' | 'surface' | 'alarm';

/**
 * Reads the engine's commentary back into typed events.
 *
 * Presentational only — an unrecognised line is simply not an event, so a
 * reworded message costs a sound or a flourish and never breaks the game. Kept
 * in one place so the sounds and the overlays cannot drift apart.
 */
export function classify(entry: LogEntry): TableEventKind | null {
  if (/scoops up/.test(entry.text)) return 'scoop';
  if (/drops a treasure/.test(entry.text)) return 'drop';
  if (/turns around/.test(entry.text)) return 'turn';
  if (/climbs aboard/.test(entry.text)) return 'surface';
  if (/air runs out/.test(entry.text)) return 'alarm';
  return null;
}
