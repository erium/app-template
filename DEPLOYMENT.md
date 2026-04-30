# Deployment (Halerium App Runners)

Short, agent-oriented brief for deploying this template to Halerium. For local dev, `README.md` is enough — read this only when targeting a Halerium App or any other reverse-proxy sub-path host.

## TL;DR

- Runner type: **`nano`**. `standard` silently fails on this environment.
- Launch production: `bash start.sh [PORT]` — bootstraps Node, pnpm, Postgres, migrations, builds, runs `pnpm start`.
- Launch dev (HMR): `bash start.sh --dev [PORT]` — same bootstrap, then `pnpm dev` (Next.js HMR).
- `start.sh` launches the app via `package.json` scripts only (`pnpm start` / `pnpm dev`). Do not invoke node directly.
- Reverse-proxy sub-path is already wired end-to-end. You don't need to touch `next.config.ts` or `api.ts` — just set `NEXT_PUBLIC_BASE_PATH` before the build.
- Halerium runners are **ephemeral** (spin down after ~10 min idle). The filesystem persists, daemons do not. `start.sh` handles that.

## Runner Environment (what's actually there)

| Preinstalled | Not preinstalled | Available |
|---|---|---|
| Node v17 (too old — `start.sh` upgrades to v20) | `pnpm` (installed by script) | `sudo` without password (user: `jovyan`) |
| `npm`, `node` | PostgreSQL (apt-installed by script) | `apt-get` |
| `git` | Playwright browsers | `curl` |

## Reverse-Proxy Sub-Path Model

Halerium mounts each app under a dynamic path:

```
public:    /apps/<org>/<workspace>/<AppName>/
internal:  /apps/<runner>/<port>/                (after a 302 from the public URL)
```

The Halerium nginx **strips** the `/apps/<runner>/<port>/` prefix before
forwarding to the runner. So the dev/prod server receives **bare paths** (e.g.
`/login`, `/_next/static/...`) — but the browser is sitting at a URL with the
prefix, and any link/asset URL that lacks the prefix will not reach the proxy
on the next hop.

This template handles the asymmetry in three places:

| Layer | How it works |
|---|---|
| **Static assets in HTML** | `next.config.ts` sets `assetPrefix: NEXT_PUBLIC_BASE_PATH`. Next.js renders `<script src="/apps/X/PORT/_next/static/...">` so the browser's request reaches the proxy, which strips the prefix and the server serves the asset at `/_next/static/...`. |
| **Links and client-side navigation** | Always import from `@/lib/nav` — never directly from `next/link` or `next/navigation`. The wrappers prepend `NEXT_PUBLIC_BASE_PATH` to every `<Link>` href, `router.push/replace/prefetch`, and strip it from `usePathname()`. The URL bar carries the prefix, so refreshing a deep link still routes through the proxy. |
| **API fetch (`/api/*`)** | `src/lib/api.ts` prepends `BASE_PATH` from `src/lib/basePath.ts` to every fetch URL. Server-side, the route handler still lives at `/api/...` (the proxy stripped the prefix). |

### Why not `basePath`?

Setting Next.js `basePath` would make rendered URLs prefix-aware, but it also
makes the server **require** the prefix on incoming requests. Since the proxy
strips, every request (including `/_next/static/...`) would 404 with a clean
log — exactly the symptom that "app starts fine, browser shows a 404, all
assets fail." Use `assetPrefix` + `@/lib/nav` instead.

### How `BASE_PATH` is resolved

`NEXT_PUBLIC_BASE_PATH` is a **build-time** constant (baked into JS bundles by
`next build`). `start.sh` exports it before building when `HALERIUM_ID` is set:

```bash
if [ -n "$HALERIUM_ID" ] && [ -z "$NEXT_PUBLIC_BASE_PATH" ]; then
  export NEXT_PUBLIC_BASE_PATH="/apps/${HALERIUM_ID}/${PORT}"
fi
```

**Important:** `NEXT_PUBLIC_BASE_PATH` is baked at build time — if the runner
is recycled with a new `HALERIUM_ID`, delete `.next/` to force a rebuild with
the new value.

## Startup Bootstrap (`start.sh`)

On every runner boot the script performs, idempotently:

1. Upgrades Node to v20 via `n`.
2. Installs `pnpm@10` if missing.
3. `apt-get install postgresql` if missing.
4. Runs `initdb` on first boot (creates `pg-data/`).
5. Removes stale `pg-data/postmaster.pid` if the PID is gone (the daemon died with the previous spin-down).
6. Starts the daemon, creates the `app` role and `app_db` database.
7. `pnpm install` (if `node_modules` missing), `pnpm db:push --force` (schema sync), `pnpm db:seed`.
8. **Prod mode** (default): exports `NEXT_PUBLIC_BASE_PATH` if on Halerium, runs `pnpm build` if `.next/BUILD_ID` is missing, then `pnpm start`.
   **Dev mode** (`--dev`): skip build, `pnpm dev` for Next.js HMR.

`PORT` is exported to the environment so both `pnpm dev` and `pnpm start` pick it up. Use dev mode while iterating; prod mode for deploys and verification.

`setup-postgres.sh` is the **local** installer for dev machines. On runners, use `start.sh`.

## Verification

- **Local root**: `pnpm dev` on `:8497` still works — nothing regresses.
- **Sub-path simulation**: proxy `/some/path/` → `:8497` locally (nginx or similar) with `X-Forwarded-Prefix: /some/path`. Assets, routes, and API calls should all resolve.
- **Halerium deploy**: create a `nano` app, run `bash start.sh`, open the app URL. First boot takes ~5 min (installing Postgres). Subsequent boots ~30 s.

## Troubleshooting

When the app fails to start or behaves unexpectedly on a runner, check logs **before** making code changes:

1. **`app-startup.log`** (repo root) — bootstrap output from `start.sh`. Shows whether Node upgrade, pnpm install, Postgres, migrations, build, or seed failed.
2. **`logs/error.<date>.log.ndjson`** — server runtime errors (pino, NDJSON format). If the process started but requests fail, look here. One file per day — restarts on the same day append to the existing file.
3. **`pg-data/pg.log`** — PostgreSQL daemon log. Check if the database won't start or connections are refused.
4. **Browser dev tools → Console / Network** — if the page loads but is blank or shows errors, check for failed asset requests.

| Symptom | Likely cause | Fix |
|---|---|---|
| Blank page / 404 on all routes | `.next/` missing or stale — production build not run. | Run `pnpm build` and check for errors. On runners, delete `.next/` and re-run `start.sh`. |
| App process exits immediately | Build never ran, or `.next/BUILD_ID` is missing. | Run `pnpm build` first. Check `app-startup.log` for build errors. |
| Port conflict / app not reachable | Runner restarted but a stale process holds the port. | Check `app-startup.log` for "Port X is busy." The server auto-selects the next free port — find the actual port in the log. |
| Database errors | Postgres daemon not running or stale PID. | Re-run `start.sh` (it cleans stale PIDs). Check `pg-data/pg.log`. |
| 401 on every API call | `JWT_SECRET` not set in `.env`. | Add it: `openssl rand -hex 32`. |
| Wrong base path after runner recycle | `NEXT_PUBLIC_BASE_PATH` was baked into the previous build with a different `HALERIUM_ID`. | Delete `.next/` and re-run `start.sh` to rebuild with the new path. |
| App opens to a 404 page; every JS/CSS asset 404s in DevTools | Some file imports `next/link` or `next/navigation` directly, OR `basePath` is set in `next.config.ts`. The proxy strips the prefix and Next.js can't route the bare path back to the matching page. | Replace direct imports with `@/lib/nav` (`import { Link, useRouter, usePathname } from "@/lib/nav"`). Confirm `next.config.ts` uses `assetPrefix`, not `basePath`. |

See also the **Build & Run** and **Common Failures** sections in `llm.txt` for the full reference.

## Anti-Patterns

- Do not import `next/link` or `next/navigation` directly. Always import from `@/lib/nav` so navigation URLs carry the basePath through Halerium's prefix-stripping proxy.
- Do not set `basePath` in `next.config.ts`. The proxy strips the prefix before forwarding, so `basePath` would 404 every request. Use `assetPrefix` instead.
- Do not hardcode absolute URLs in client code. Use `BASE_PATH` / `getApiBase()` from `src/lib/basePath.ts`.
- Do not assume Postgres is running. `start.sh` guarantees it on app boot; don't skip it on runner deployments.
- Do not pick `standard` / `small` runner types until you have a reason — `nano` is what works here.
- Do not run `pnpm start` without building first. `pnpm start` serves from `.next/`, which must be created by `pnpm build`. Use `start.sh` on runners — it handles the build automatically.
- Do not claim the app works without verifying. After starting, check: `curl localhost:PORT/api/health` → `{"status":"ok"}`, then open the app in a browser.
