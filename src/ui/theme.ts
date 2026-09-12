import type { TreasureLevel } from '../engine';

/** Meeple colours in seating order, distinct against the trench background. */
export const DIVER_COLORS = [
  '#EF4444', // red
  '#F59E0B', // amber
  '#3B82F6', // blue
  '#10B981', // green
  '#A855F7', // violet
  '#EC4899', // pink
] as const;

export function diverColor(index: number): string {
  return DIVER_COLORS[index % DIVER_COLORS.length]!;
}

/**
 * Each ruin level reads as a depth zone: its own colour, badge glyph and depth
 * band. The glyph is what players actually identify a face-down chip by, since
 * the value stays hidden until scoring.
 */
export interface LevelStyle {
  color: string;
  glyph: string;
  depth: string;
  zone: string;
}

export const LEVEL_STYLES: Record<TreasureLevel, LevelStyle> = {
  1: { color: '#0077B6', glyph: '▲', depth: '10-20m', zone: 'DEPTH ZONE 1 (10M)' },
  2: { color: '#00B4D8', glyph: '■', depth: '30-40m', zone: 'DEPTH ZONE 2 (30M)' },
  3: { color: '#FF9F1C', glyph: '⬠', depth: '50-60m', zone: 'DEPTH ZONE 3 (50M)' },
  4: { color: '#E63946', glyph: '⬡', depth: '70-80m', zone: 'PRESSURE WARNING: DEEP ABYSS (70M)' },
};

export const LEVELS: TreasureLevel[] = [1, 2, 3, 4];

/** Tiles per row on the serpentine trench map. */
export const TILES_PER_ROW = 6;
