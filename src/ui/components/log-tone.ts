export type LogTone = 'normal' | 'danger' | 'good';

/**
 * Colour for a log line. Purely presentational: the engine writes plain prose,
 * and anything unrecognised simply falls back to the neutral tone, so a wording
 * change can never do worse than lose a highlight.
 */
export function logTone(line: string): LogTone {
  if (/burns \d+ air|air runs out|ran out of air|lost \d+ treasure/.test(line)) return 'danger';
  if (/turns around|climbs aboard|surfaced with|scoops up/.test(line)) return 'good';
  return 'normal';
}
