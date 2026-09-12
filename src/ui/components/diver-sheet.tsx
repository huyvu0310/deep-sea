import { useEffect } from 'react';
import type { TreasureLevel } from '../../engine';
import type { ViewChip, ViewPlayer } from '../../net/view';
import { LEVELS, LEVEL_STYLES } from '../theme';
import { ChipFace } from './chip-face';

/** Tally of chips per depth zone, for a quick read of how deep a haul is. */
function tallyZones(stacks: ViewChip[][]): { level: TreasureLevel; count: number }[] {
  const counts = { 1: 0, 2: 0, 3: 0, 4: 0 } as Record<TreasureLevel, number>;
  for (const stack of stacks) for (const chip of stack) counts[chip.level] += 1;
  return LEVELS.filter((level) => counts[level] > 0).map((level) => ({
    level,
    count: counts[level],
  }));
}

function sumRevealed(stacks: ViewChip[][]): number | null {
  const chips = stacks.flat();
  if (chips.length === 0) return 0;
  if (chips.some((chip) => chip.value === null)) return null;
  return chips.reduce((n, chip) => n + (chip.value ?? 0), 0);
}

/**
 * Where this diver stands. A revealed score means the expedition is over and
 * everyone has been returned to the submarine, so position says nothing then.
 */
function whereabouts(player: ViewPlayer): string {
  if (player.score !== null) return 'Expedition complete';
  if (player.returned) return 'Safely aboard';
  if (player.position === 0) return 'In the submarine, about to dive';
  return player.direction === 'up'
    ? `Ascending from space ${player.position}`
    : `Diving at space ${player.position}`;
}

/**
 * A diver's chips, in hand and banked.
 *
 * Zones are open information — everyone watched which tile each chip came off —
 * so the badges are always shown. Values stay masked until the final reveal,
 * exactly as the view hands them over.
 */
export function DiverSheet({
  player,
  color,
  onClose,
}: {
  player: ViewPlayer;
  color: string;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const bankedStacks = player.banked.map((entry) => entry.chips);
  const rounds = [...new Set(player.banked.map((entry) => entry.round))].sort((a, b) => a - b);

  return (
    <div className="overlay" onClick={onClose}>
      <div
        className="panel-card"
        role="dialog"
        aria-modal="true"
        aria-label={`${player.name}'s chips`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sheet-head">
          <span className="meeple-avatar" style={{ background: color }} aria-hidden="true" />
          <div>
            <h2>{player.name}</h2>
            <p className="sheet-sub">{whereabouts(player)}</p>
          </div>
        </div>

        <Section
          title="In hand"
          note={
            player.holding.length > 0
              ? `${player.holding.length} carried · −${player.holding.length} air and −${player.holding.length} movement each turn`
              : 'Nothing carried — full speed, no air cost'
          }
          stacks={player.holding}
          emptyText="Empty-handed."
          atRisk={!player.returned && player.holding.length > 0}
        />

        {rounds.length === 0 ? (
          <Section title="Banked" stacks={[]} emptyText="Nothing brought home yet." />
        ) : (
          rounds.map((round) => (
            <Section
              key={round}
              title={`Banked · round ${round}`}
              stacks={player.banked.filter((entry) => entry.round === round).map((e) => e.chips)}
              emptyText=""
            />
          ))
        )}

        <p className="sheet-total">
          <span>Banked total</span>
          <strong>
            {sumRevealed(bankedStacks) === null
              ? `${bankedStacks.length} chip${bankedStacks.length === 1 ? '' : 's'}, values sealed`
              : `${sumRevealed(bankedStacks)} points`}
          </strong>
        </p>

        <button className="btn btn-primary" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
}

function Section({
  title,
  note,
  stacks,
  emptyText,
  atRisk = false,
}: {
  title: string;
  note?: string;
  stacks: ViewChip[][];
  emptyText: string;
  atRisk?: boolean;
}) {
  const zones = tallyZones(stacks);

  return (
    <section className="sheet-section">
      <h3>
        {title}
        {atRisk && <span className="sheet-risk">at risk</span>}
      </h3>

      {stacks.length === 0 ? (
        <p className="sheet-empty">{emptyText}</p>
      ) : (
        <>
          <div className="sheet-chips">
            {stacks.map((chips, i) => (
              <ChipFace key={i} chips={chips} />
            ))}
          </div>
          <div className="sheet-zones">
            {zones.map(({ level, count }) => (
              <span key={level} className="sheet-zone">
                <i style={{ background: LEVEL_STYLES[level].color }} />
                {count} × {LEVEL_STYLES[level].depth}
              </span>
            ))}
          </div>
        </>
      )}

      {note && <p className="sheet-note">{note}</p>}
    </section>
  );
}
