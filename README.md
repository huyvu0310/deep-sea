# Deep Sea Adventure

A faithful digital implementation of Oink Games' push-your-luck board game, for
2–6 players, playable either hot-seat on one device or online with a room code.

One submarine, one shared tank of 25 air, and a route of 32 ruin chips that gets
richer the deeper you swim. Every chip you carry burns an extra air each turn
and costs you a space of movement. When the air runs out, every diver still in
the water loses everything they were holding. Three rounds; highest total wins.

## Running it

```bash
npm install
npm run dev        # hot-seat play at http://localhost:5173
npm run server     # add this in a second terminal for online tables
```

For a single-process deployment, build the client and let the game server host it:

```bash
npm run build
npm run server     # serves dist/ and the websocket on http://localhost:8787
```

Other commands: `npm test`, `npm run typecheck`.

## How it is put together

```
src/engine/   pure rules engine — no UI, no network, no Math.random
src/net/      redacted player view + the client/server message protocol
src/ui/       React components; hot-seat and online render the same board
server/       authoritative websocket server, room codes, reconnection
tests/        rulebook tests, a 150-seed soak test, server authority tests
```

The engine is a pure reducer: `applyAction(state, action)` returns a new state
and throws `IllegalActionError` on anything the rules forbid. All randomness
comes from a seeded PRNG carried in the state, so a game replays exactly from
its seed plus its action list — which is what makes the tests deterministic and
stops a networked client from re-rolling a result it dislikes.

### Hidden information

Ruin chips are face down: a player sees a chip's level (the dots on its back)
but never its value until the final scoring. The UI therefore renders
`GameView`, a redacted projection produced by `toView()`, rather than
`GameState`. Values are `null` until the expedition ends. This is what the
server broadcasts, so face-down values are never on the wire, and the same
projection is used hot-seat so they are not in the browser's memory either.

### Online play

The server owns the game. Clients send a `GameAction` and get back a `GameView`;
the room rejects moves from anyone but the diver whose turn it is, and only the
host can start. Seats are held open on disconnect and reclaimed with a token
kept in `sessionStorage`, so a refresh does not forfeit a game in progress.

## Documentation

- [docs/how-to-play.md](docs/how-to-play.md) — how to start a game, read the
  board, and not drown.
- [docs/rules.md](docs/rules.md) — the implemented rules, and the two places
  where the rulebook left something open to interpretation.
