import { useEffect, useState } from 'react';
import type { TreasureLevel } from '../../engine';
import { CHIPS_PER_LEVEL, LEVEL_VALUE_RANGES } from '../../engine';
import type { ViewCell } from '../../net/view';
import { LEVELS, LEVEL_STYLES } from '../theme';

/** Every value in a level, listed the way the chips are printed: two of each. */
function valuesIn(level: TreasureLevel): number[] {
  const [lo, hi] = LEVEL_VALUE_RANGES[level];
  return Array.from({ length: hi - lo + 1 }, (_, i) => lo + i);
}

function pointRange(level: TreasureLevel): string {
  const [lo, hi] = LEVEL_VALUE_RANGES[level];
  return `${lo}–${hi}`;
}

/** Chips of each level still lying on the route — public, just tedious to count. */
function countByLevel(path: ViewCell[]): Record<TreasureLevel, number> {
  const counts = { 1: 0, 2: 0, 3: 0, 4: 0 } as Record<TreasureLevel, number>;
  for (const cell of path) {
    if (cell.kind !== 'treasure') continue;
    for (const chip of cell.chips) counts[chip.level] += 1;
  }
  return counts;
}

/**
 * Legend above the trench. The point range sits inline so the common question —
 * "what is a red chip worth?" — needs no click, and the full reference opens
 * behind the info button.
 */
export function ChipGuide({ path }: { path: ViewCell[] }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <div className="zone-legend">
        <div className="legend-head">
          <span className="legend-title">DEPTH ZONES</span>
          <button
            className="legend-info"
            onClick={() => setOpen(true)}
            aria-haspopup="dialog"
            title="What is each chip worth?"
          >
            <span aria-hidden="true">ⓘ</span> Chip values
          </button>
        </div>

        <div className="legend-grid">
          {LEVELS.map((level) => {
            const style = LEVEL_STYLES[level];
            return (
              <span key={level} className="legend-item">
                <i className="legend-badge" style={{ background: style.color }}>
                  {style.glyph}
                </i>
                <span className="legend-text">
                  <b>{pointRange(level)} pts</b>
                  <small>{style.depth}</small>
                </span>
              </span>
            );
          })}
        </div>
      </div>

      {open && <ChipGuideDialog path={path} onClose={() => setOpen(false)} />}
    </>
  );
}

function ChipGuideDialog({ path, onClose }: { path: ViewCell[]; onClose: () => void }) {
  const remaining = countByLevel(path);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="overlay" onClick={onClose}>
      <div
        className="panel-card"
        role="dialog"
        aria-modal="true"
        aria-label="What each chip is worth"
        onClick={(e) => e.stopPropagation()}
      >
        <h2>What each chip is worth</h2>
        <p className="guide-intro">
          The route holds 32 ruin chips in four depth zones. A chip's badge tells you its zone —
          never its value. You find out what you actually hauled up when the expedition ends.
        </p>

        <ul className="guide-list">
          {LEVELS.map((level) => {
            const style = LEVEL_STYLES[level];
            return (
              <li key={level} className="guide-row">
                <i className="guide-badge" style={{ background: style.color }}>
                  {style.glyph}
                </i>
                <div className="guide-body">
                  <div className="guide-head">
                    <strong>{pointRange(level)} points</strong>
                    <span className="guide-depth">{style.depth}</span>
                  </div>
                  <div className="guide-values">
                    {valuesIn(level).map((value) => (
                      <span key={value} className="guide-value">
                        {value}
                      </span>
                    ))}
                    <span className="guide-note">two of each · {CHIPS_PER_LEVEL} chips</span>
                  </div>
                </div>
                <span className="guide-left">
                  <b>{remaining[level]}</b>
                  <small>on route</small>
                </span>
              </li>
            );
          })}
        </ul>

        <p className="guide-foot">
          A stack of three, left behind by a drowned diver, counts as <b>one</b> chip for air and
          movement but scores all three values.
        </p>

        <button className="btn btn-primary" onClick={onClose}>
          Got it
        </button>
      </div>
    </div>
  );
}
