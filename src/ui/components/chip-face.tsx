import type { ViewChip } from '../../net/view';
import { LEVEL_STYLES } from '../theme';

/**
 * A ruin chip badge. Chips lie face down all game, so this shows the level
 * glyph and nothing else; a value appears only once the view has unmasked it
 * for final scoring. A restacked pile carries a ×N count.
 */
export function ChipFace({ chips, size = 'md' }: { chips: ViewChip[]; size?: 'sm' | 'md' }) {
  const top = chips[0];
  if (!top) return null;

  const style = LEVEL_STYLES[top.level];
  const revealed = chips.every((chip) => chip.value !== null);
  const total = revealed ? chips.reduce((n, c) => n + (c.value ?? 0), 0) : null;

  return (
    <span
      className={`chip chip-${size}`}
      style={{ background: style.color }}
      title={
        revealed
          ? `Level ${top.level} — worth ${total}`
          : `Level ${top.level} ruin, ${style.depth} (face down)`
      }
    >
      {revealed ? total : style.glyph}
      {chips.length > 1 && <i className="chip-stack">×{chips.length}</i>}
    </span>
  );
}
