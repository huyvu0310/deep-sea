import type { TreasureLevel } from '../../engine';
import type { GameView, ViewCell } from '../../net/view';
import { LEVEL_STYLES, TILES_PER_ROW, diverColor } from '../theme';
import { usePrefersReducedMotion, useTravelTransitions } from '../use-motion';
import { AnchorIcon } from './icons';
import { ChipFace } from './chip-face';
import { ChipGuide } from './chip-guide';

interface Tile {
  position: number;
  cell: ViewCell;
}

/** Break the route into rows that snake left, right, left — like the real board. */
function toRows(path: ViewCell[]): Tile[][] {
  const rows: Tile[][] = [];
  for (let i = 0; i < path.length; i += TILES_PER_ROW) {
    const row = path
      .slice(i, i + TILES_PER_ROW)
      .map((cell, j) => ({ position: i + j + 1, cell }));
    rows.push(rows.length % 2 === 1 ? row.reverse() : row);
  }
  return rows;
}

/** The level a row opens on, used to decide where the depth zone changes. */
function rowLevel(row: Tile[] | undefined): TreasureLevel | null {
  const first = row?.[0]?.cell;
  if (!first || first.kind !== 'treasure') return null;
  return first.chips[0]?.level ?? null;
}

/**
 * Depth marker between two rows. It appears only where the zone actually
 * changes, so the trench is punctuated rather than labelled at every turn.
 */
function zoneLabel(rows: Tile[][], index: number): { text: string; color: string } | null {
  const next = rowLevel(rows[index + 1]);
  if (next === null || next === rowLevel(rows[index])) return null;
  const style = LEVEL_STYLES[next];
  return { text: `⤿ ${style.zone} ⤿`, color: style.color };
}

/** The trench: the submarine, then the dive route descending in serpentine rows. */
export function Route({ state }: { state: GameView }) {
  const rows = toRows(state.path);
  const current = state.players[state.currentPlayerIndex];
  useTravelTransitions(!usePrefersReducedMotion());

  const diversAt = (position: number) =>
    state.players
      .map((player, index) => ({ player, index }))
      .filter(({ player }) => player.position === position && !player.returned);

  const aboard = state.players
    .map((player, index) => ({ player, index }))
    .filter(({ player }) => player.returned);

  return (
    <div className="trench-map">
      <ChipGuide path={state.path} />

      <div className="submarine-piece">
        <span className="sub-art">
          <AnchorIcon size={20} />
          SS-ORION
        </span>
        <span className="sub-sub">DOCK / CARGO BAY</span>
        <span className="docked-meeples">
          {diversAt(0).map(({ player, index }) => (
            <Meeple
              key={player.id}
              id={player.id}
              name={player.name}
              color={diverColor(index)}
              active={player.id === current?.id}
            />
          ))}
          {aboard.map(({ player, index }) => (
            <Meeple
              key={player.id}
              id={player.id}
              name={player.name}
              color={diverColor(index)}
              safe
            />
          ))}
        </span>
      </div>

      {rows.map((row, rowIndex) => (
        <div key={rowIndex} className="path-block">
          <div className={`path-row${rowIndex % 2 === 1 ? ' path-row-reversed' : ''}`}>
            {row.map(({ position, cell }) => (
              <PathTile
                key={position}
                position={position}
                cell={cell}
                divers={diversAt(position)}
                activeId={current?.id}
              />
            ))}
          </div>
          <Connector zone={zoneLabel(rows, rowIndex)} flip={rowIndex % 2 === 0} />
        </div>
      ))}

      <div className="watermark">
        <span>CRITICAL DEPTH ZONE // MAXIMUM PRESSURE</span>
        <span>Returning to the SS-Orion becomes harder the deeper you descend.</span>
      </div>
    </div>
  );
}

function PathTile({
  position,
  cell,
  divers,
  activeId,
}: {
  position: number;
  cell: ViewCell;
  divers: { player: { id: string; name: string }; index: number }[];
  activeId: string | undefined;
}) {
  const occupied = divers.length > 0;
  const empty = cell.kind === 'empty';

  return (
    <div className={`path-tile${occupied ? ' path-tile-live' : ''}${empty ? ' path-tile-bare' : ''}`}>
      <span className="tile-index">#{position}</span>
      {cell.kind === 'treasure' ? (
        <ChipFace chips={cell.chips} />
      ) : (
        <span className="tile-bare" title="Bare seabed">
          ×
        </span>
      )}
      <span className="tile-meeples">
        {divers.map(({ player, index }) => (
          <Meeple
            key={player.id}
            id={player.id}
            name={player.name}
            color={diverColor(index)}
            active={player.id === activeId}
          />
        ))}
      </span>
    </div>
  );
}

function Connector({
  zone,
  flip,
}: {
  zone: { text: string; color: string } | null;
  flip: boolean;
}) {
  if (!zone) return null;
  return (
    <div className={`connector${flip ? ' connector-right' : ''}`}>
      <span style={{ color: zone.color }}>{zone.text}</span>
    </div>
  );
}

function Meeple({
  id,
  name,
  color,
  active = false,
  safe = false,
}: {
  id: string;
  name: string;
  color: string;
  active?: boolean;
  safe?: boolean;
}) {
  return (
    <i
      // Tagged so the token animates across tiles instead of jumping; the id
      // must follow the diver, since the element itself is replaced each move.
      data-travel-id={id}
      className={`meeple${active ? ' meeple-active' : ''}${safe ? ' meeple-safe' : ''}`}
      style={{ background: color }}
      title={safe ? `${name} — safely aboard` : name}
    />
  );
}
