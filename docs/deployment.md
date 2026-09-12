# Deployment

The client is a static bundle and the server is a long-lived Node process, so
they are hosted separately: the client on Vercel, the game server on Render.

The two are joined by one setting in each direction:

- the client is built with `VITE_WS_URL` pointing at the Render service
- the server is given `ALLOWED_ORIGINS` containing the Vercel URL

Both are needed. Miss the first and the client looks for a socket on its own
Vercel domain, where nothing is listening. Miss the second and Render accepts
sockets from any page on the internet.

A third setting, `DATABASE_URL`, turns on accounts and saved tables. It is
optional: without it the server runs exactly as it always did, from memory.

## 1. Push the repository

Both hosts deploy from git.

```bash
git push -u origin main
```

## 2. Server on Render

The repository has a `render.yaml` blueprint, so **New → Blueprint** and
pointing Render at the repo sets the service up. To do it by hand instead, use
**New → Web Service** with:

| Setting | Value |
| --- | --- |
| Runtime | Node |
| Build command | `npm ci --include=dev && npm run build:server` |
| Start command | `npm start` |
| Health check path | `/healthz` |

`--include=dev` matters: Render sets `NODE_ENV=production`, which otherwise
makes npm skip the devDependencies the build needs.

Deploy, then note the service URL (e.g. `https://deep-sea-server.onrender.com`).
`ALLOWED_ORIGINS` can be left unset for this first deploy — you do not have a
Vercel URL yet, and unset means "accept any origin".

### The database

Accounts and saved tables need Postgres. Create a Neon project, copy its
connection string, and set it on the Render service:

| Name | Value |
| --- | --- |
| `DATABASE_URL` | `postgresql://user:password@ep-xxx.region.aws.neon.tech/neondb?sslmode=require` |

The server connects with TLS and verifies the certificate, creates its four
tables on boot if they are missing, and says which mode it is in on startup:

```
Accounts and saved tables are on (DATABASE_URL is set)
Running from memory only (set DATABASE_URL for accounts and saved tables)
```

There is no migration step to run. The schema is created with
`create table if not exists`, so a redeploy against an existing database is a
no-op. Leaving `DATABASE_URL` unset is a supported mode, not a broken one: the
client asks the server whether accounts exist and falls back to the old
type-a-name flow when they do not.

## 3. Client on Vercel

**Add New → Project**, import the repo. Vercel reads `vercel.json` and builds
with `npm run build` into `dist`. Before the first deploy, add an environment
variable:

| Name | Value |
| --- | --- |
| `VITE_WS_URL` | `https://deep-sea-server.onrender.com` |

This is read at **build time**, not run time, so changing it later needs a
redeploy, not just a restart. It accepts an origin or a full socket URL, over
`http(s)` or `ws(s)` — `wss://…/ws` is derived either way.

## 4. Close the loop

Back in Render, set `ALLOWED_ORIGINS` to the Vercel URL and let it redeploy:

```
ALLOWED_ORIGINS=https://deep-sea.vercel.app
```

Use exact origins with no trailing path. Add the preview domain too if you want
Vercel previews to work, comma separated. A rejected socket fails the handshake
with a 401 and the client shows "Connection lost".

The same allowlist guards the account API, which the browser reaches over
ordinary HTTP and so is subject to CORS. An origin that is not on the list gets
a 403 and sign-in fails, even though the page itself loaded fine.

## This project's deployment

| | |
| --- | --- |
| Server | `deep-sea-server` on Render — `https://deep-sea-server.onrender.com` |
| Client | `deep-sea` on Vercel — **`https://deep-sea-snowy.vercel.app`** |
| Repo | `huyvu0310/deep-sea`, both hosts auto-deploy from `main` |

`ALLOWED_ORIGINS` lists both the public URL above and the team-scoped alias
`deep-sea-vu-duongs-projects-58c07326.vercel.app`.

**Use the origin players actually visit.** A Vercel project answers on several
hostnames — the short public alias, a team-scoped alias, and a fresh
per-deployment URL each build — and the browser sends whichever one the page was
loaded from as the `Origin`. Allowlisting the wrong one fails exactly like a
missing `VITE_WS_URL`: the page loads, then the socket is refused with a 401 and
the client reports "Connection lost". Check the address bar, not the dashboard.

Note also that Vercel's Standard deployment protection guards per-deployment
URLs and previews but leaves the public production alias reachable, so the short
URL works for guests without turning protection off.

## Checking it works

```bash
curl https://deep-sea-server.onrender.com/healthz   # -> ok
```

```bash
curl https://deep-sea-server.onrender.com/api/auth/me
# -> {"user":null,"activeRoom":null}   accounts are on
# -> {"error":"Accounts are not enabled on this server"}   no DATABASE_URL
```

Then open the Vercel URL in two browsers, sign up as two divers, create a table
in one and join by code from the other. If the lobby never appears, the browser
console will show the socket URL it tried.

To check rejoining, close one browser's tab mid-game, open a fresh one, sign in
as the same diver, and take the **Rejoin table** button on the way in.

## What to expect from the free tiers

These are real constraints of the setup, not bugs:

- **Render free instances sleep after ~15 minutes idle** and take 30–60 seconds
  to wake. The first player to arrive after a quiet spell will wait. With
  `DATABASE_URL` set the game itself survives the sleep and is waiting when the
  instance wakes; without it, the game is gone.
- **Neon's free branch also sleeps**, and wakes in under a second. It costs the
  first request after a quiet spell a moment; nothing is lost.
- **One instance only.** A table is held in memory while it is being played and
  only read back from Postgres when this process has not seen it, so two
  instances could each hold their own copy of the same table and overwrite one
  another. Keep it at one.
- **Abandoned tables are swept after 24 hours**, along with expired sessions.

Hot-seat play is unaffected by all of this: it runs entirely in the browser and
needs no server at all.

## Running both from one host

The server still serves a client build placed next to it, which is useful for a
single-box deployment or a LAN game:

```bash
npm run build && npm run build:server && npm start
```

That serves the client and the socket from one origin, so neither `VITE_WS_URL`
nor `ALLOWED_ORIGINS` is needed.
