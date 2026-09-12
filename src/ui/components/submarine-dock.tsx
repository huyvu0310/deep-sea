import type { GameView } from '../../net/view';
import { diverColor } from '../theme';
import { AnchorIcon } from './icons';
import { Meeple } from './meeple';

/**
 * The SS-Orion, shown as the head of the air panel rather than a block of its
 * own above the trench.
 *
 * The air being counted is the submarine's, so the two belong together; keeping
 * them apart cost a slab of height at the top of the board and pushed the route
 * down. This still carries `data-space="0"`, so a diver climbing aboard swims
 * up into it.
 */
export function SubmarineDock({ state }: { state: GameView }) {
  const current = state.players[state.currentPlayerIndex];
  const atDock = state.players
    .map((player, index) => ({ player, index }))
    .filter(({ player }) => player.position === 0);

  return (
    <div className="sub-dock" data-space="0">
      <span className="sub-name">
        <AnchorIcon size={16} />
        SS-ORION
      </span>
      <span className="sub-berths">
        {atDock.length === 0 ? (
          <em>all hands in the water</em>
        ) : (
          atDock.map(({ player, index }) => (
            <Meeple
              key={player.id}
              id={player.id}
              name={player.name}
              color={diverColor(index)}
              active={!player.returned && player.id === current?.id}
              safe={player.returned}
            />
          ))
        )}
      </span>
    </div>
  );
}
