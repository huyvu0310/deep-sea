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

Online play works without a database. Set `DATABASE_URL` to a Postgres and
tables are saved and can be rejoined after a restart:

```bash
DATABASE_URL=postgres://postgres:postgres@localhost:5432/postgres npm run server
```

The schema is created on boot, so there is no migration step.

For a single-process deployment, build the client and let the game server host it:

```bash
npm run build
npm run server     # serves dist/ and the websocket on http://localhost:8787
```

Other commands: `npm test`, `npm run typecheck`. The identity and storage tests
skip themselves unless `DATABASE_URL` is set, so `npm test` needs no database.

## How it is put together

```
src/engine/   pure rules engine — no UI, no network, no Math.random
src/net/      redacted player view + the client/server message protocol
src/ui/       React components; hot-seat and online render the same board
server/       authoritative websocket server, room codes, identities, storage
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
host can start. The seat a client acts as is derived from its socket and never
read from the message, so a client cannot ask to move as somebody else.

### Coming back

Seats are held open when a player disconnects. There is no sign-in: the first
time someone gives a name the server issues that browser an identity, and the
browser keeps it. A chair belongs to that identity, so the table is offered back
on the way in — a closed tab, a browser restart, days later.

The game itself is written to Postgres after every move, so a table also
survives the server restarting or going to sleep, and is read back the next time
anyone asks for it.

This is deliberately an identity and not an account. It costs nobody a step
before playing, and it is enough to answer "whose chair is this?". What it
cannot do is follow you to another device, which needs a password by definition;
the schema keeps a nullable `password_hash` column for the day that is wanted.
The identity token is stored only as its SHA-256 digest, so a copy of the table
lets nobody take a seat.

Without a database none of this exists and the game is unchanged: a token in
`localStorage` reclaims the seat, which still covers a refresh or a closed tab
on that browser but not a restarted server.

## Deploying

The client is static and the server is long-lived, so they deploy separately —
Vercel and Render respectively, joined by `VITE_WS_URL` on the client build and
`ALLOWED_ORIGINS` on the server, plus `DATABASE_URL` for saved tables. See
[docs/deployment.md](docs/deployment.md).

## Documentation

- [docs/how-to-play.md](docs/how-to-play.md) — how to start a game, read the
  board, and not drown.
- [docs/rules.md](docs/rules.md) — the implemented rules, and the two places
  where the rulebook left something open to interpretation.
- [docs/deployment.md](docs/deployment.md) — hosting the client and server.
