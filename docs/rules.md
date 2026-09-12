# Implemented rules

The behaviour the engine enforces, and where a judgement call was needed.

## Setup

- 2–6 divers, one shared submarine, 25 air, 3 rounds.
- 32 ruin chips in four levels of eight. Level 1 holds values 0–3, level 2 holds
  4–7, level 3 holds 8–11, level 4 holds 12–15, two chips of each value.
- Each level is shuffled separately, then the levels are laid out in order, so
  the route gets richer with depth.
- Chips are face down all game. A player sees the level dots on the back, never
  the value, until the final scoring.

## A turn

1. **Declare a direction.** A diver swimming up can never turn back down.
2. **Spend air** equal to the number of treasure tokens held. When the supply
   reaches 0 the round ends — but the active diver finishes the current turn
   first.
3. **Roll two dice** showing 1–3 each, and subtract the number of tokens held.
   A result of 0 or less means no movement.
4. **Move**, hopping over spaces holding other divers; an occupied space costs
   no step. Swimming down stops at the last space of the route and leftover
   steps are lost. Reaching or passing space 0 means climbing aboard.
5. **One action, optionally**: take the treasure on the current space (leaving
   bare seabed behind) or set one held treasure down on a bare space. Not both.
   The diver chooses *which* held token to set down; a restacked pile goes back
   whole, as the single token it is.

A diver who climbs aboard is safe for the rest of the round and takes no further
turns; their haul is banked and scores at the end of the game.

## End of a round

The round ends when the air runs out or every diver is aboard.

- Divers still in the water drop everything they hold.
- Dropped chips are collected starting with the deepest diver and placed at the
  end of the route in stacks of three. A stack moves and breathes as a single
  token but scores the sum of all its chips.
- Bare spaces are removed, so the route shortens each round.
- Air refills to 25 and every diver returns to the submarine.

After the third round all chips are revealed and summed. Highest total wins.

## Interpretations

Two points the rulebook does not settle, resolved as follows:

- **Start player between rounds.** The start player passes to the next diver
  each round (`currentPlayerIndex = (round - 1) % players.length` in
  `src/engine/game.ts`), which is the usual convention for a multi-round
  push-your-luck game and evens out first-player advantage. Change that one line
  to keep a fixed start player instead.
- **Ties.** Equal scores share a rank and are reported as a tie rather than
  broken by an invented tiebreaker (`standings()` in `src/engine/scoring.ts`).

One rule worth stating explicitly because it is easy to get wrong: lost chips
are pooled across *all* drowned divers before being split into threes, so a
stack can mix chips from two different divers. The leftover stack may hold one
or two chips.
