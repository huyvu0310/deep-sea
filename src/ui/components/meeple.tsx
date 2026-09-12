/**
 * A diver's token.
 *
 * The `id` is what lets the token travel between spaces: it is a different DOM
 * node in every tile, so the animation follows the id rather than the element.
 */
export function Meeple({
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
      data-travel-id={id}
      className={`meeple${active ? ' meeple-active' : ''}${safe ? ' meeple-safe' : ''}`}
      style={{ background: color }}
      title={safe ? `${name} — safely aboard` : name}
    />
  );
}
