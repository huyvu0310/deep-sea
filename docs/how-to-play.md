# How to play

Deep Sea Adventure is a push-your-luck game for 2–6 divers. You all share one
submarine and **one tank of air**. Everything that makes you rich also makes you
slow, and slow divers drown.

## Starting a game

**On one device (hot-seat).** `npm run dev`, open http://localhost:5173, name
the divers, press **Dive in**, and pass the laptop around.

**Online, one device each.** Two to six divers per table. Run `npm run server`
in a second terminal. One
player picks **Play online → Start a new table** and reads out the four-letter
code; everyone else picks **Play online**, types their name and the code, and
presses **Join**. The host presses **Cast off** once at least two divers are in.
A refresh will not lose your seat — come back and press **Rejoin table**.

The **Seed** box is optional. Type anything into it and the route is dealt the
same way every time, which is handy for a rematch on identical terms.

## The board

The trench snakes down from the yellow submarine at the top. Every tile is a
face-down ruin chip, and the badge on it tells you only its **depth zone**:

| Badge | Zone | Worth |
| --- | --- | --- |
| ▲ blue | 10–20m | 0–3 |
| ■ cyan | 30–40m | 4–7 |
| ⬠ orange | 50–60m | 8–11 |
| ⬡ red | 70–80m | 12–15 |

You never see a chip's exact value until the end of the game. A deep red chip
could be worth 12 or 15 — you only know it beats anything blue.

The legend above the trench shows these ranges at a glance, and **Chip values**
opens a full reference: the exact values in each zone, how many chips of each
zone are still on the route, and how stacks score.

## Your turn

1. **Choose a direction.** *Dive deeper* or *Turn back*. Turning back is
   permanent: once you are ascending you can never head down again.
2. **Air drains.** The shared tank drops by the number of chips you are
   carrying. Carry nothing, and you cost the group nothing.
3. **Roll.** Two dice of 1–3, then **subtract one for every chip you carry**.
   Six chips and you will not move at all.
4. **Move.** Tiles with another diver on them are hopped over for free, so a
   crowded trench can fling you a long way.
5. **Act, or don't.** On your tile you may **scoop** the chip (leaving bare
   seabed, marked ×) or **drop** one chip you carry onto a bare tile. One or the
   other, never both — and skipping is always allowed.

   When you drop, **you choose which chip goes back** — any one you carry, not
   just the one you picked up last. The picker labels each by depth zone, so you
   can keep the deep one and shed a shallow one. Two chips from the same zone
   are genuinely interchangeable: they are face down, so you know no more about
   one than the other. A drowned diver's stack of three counts as a single
   token, and goes back as a whole stack.

Reach the submarine and you are safe: your haul is banked and you sit out the
rest of the round.

At an online table you only act on your own turn — the console shows
"Waiting for …" when it is someone else's, and the server refuses a move sent
out of turn. Notices in the corner tell you what the others just did.

**Click any diver's card** to see their chips — what they are carrying right
now, and what they have banked, grouped by round. You will see each chip's
depth zone (everyone watched which tile it came off) but not its value until
the expedition ends.

## When the air runs out

The round ends the moment the tank hits zero (the current diver finishes their
turn first). **Every diver still in the water loses everything they are
carrying.** Those chips sink to the very end of the route in stacks of three.

Bare tiles are then removed, so the trench gets shorter each round while the
prizes at the bottom get fatter. Air refills to 25 and everyone starts again
from the submarine.

After three rounds every chip is turned face up and the highest total wins.

## How to actually win

- **Empty-handed is fast.** One chip costs one air *and* one step, every turn.
  The trip home is far longer than the trip out.
- **Turn round earlier than feels right.** Most first-time players drown with a
  fortune in hand. Three chips from 50m beats six chips you never delivered.
- **Watch the tank, not the tiles.** If four divers are each hauling three
  chips, the tank is dropping 12 per round of turns. Do that arithmetic before
  you scoop.
- **Those stacks of three are a trap with a prize in it.** They sit at the
  deepest point of a *shorter* route — reachable, but they count as a single
  chip for weight, so grabbing one is often the best move in round 3.
- **Dropping is a real move.** Shedding a chip onto bare seabed to get home
  alive is not cowardice, it is how you keep the rest.
- **Round 3 is different.** There is no next round to save yourself for, so
  everything you are not going to deliver is worthless.
