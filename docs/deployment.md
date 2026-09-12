# Deployment

The client is a static bundle and the server is a long-lived Node process, so
they are hosted separately: the client on Vercel, the game server on Render.

The two are joined by one setting in each direction:

- the client is built with `VITE_WS_URL` pointing at the Render service
- the server is given `ALLOWED_ORIGINS` containing the Vercel URL

Both are needed. Miss the first and the client looks for a socket on its own
Vercel domain, where nothing is listening. Miss the second and Render accepts
sockets from any page on the internet.

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

Then open the Vercel URL in two browsers, create a table in one and join by code
from the other. If the lobby never appears, the browser console will show the
socket URL it tried.

## What to expect from the free tiers

These are real constraints of the setup, not bugs:

- **Render free instances sleep after ~15 minutes idle** and take 30–60 seconds
  to wake. The first player to arrive after a quiet spell will wait, and any
  game still in progress when it sleeps is gone.
- **Tables live in the server's memory.** A deploy, restart or sleep wipes every
  room. Seats are reclaimable across a browser refresh, not across a restart.
- **One instance only.** Rooms are held in-process, so scaling to a second
  instance would split players across two sets of tables. Keep it at one.

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
