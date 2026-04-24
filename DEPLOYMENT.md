# Deployment (Halerium App Runners)

Short, agent-oriented brief for deploying this template to Halerium. For local dev, `README.md` is enough — read this only when targeting a Halerium App or any other reverse-proxy sub-path host.

## TL;DR

- Runner type: **`nano`**. `standard` silently fails on this environment.
- Launch production: `bash start.sh [PORT]` — bootstraps Node, pnpm, Postgres, migrations, builds, runs `pnpm start`.
- Launch dev (HMR): `bash start.sh --dev [PORT]` — same bootstrap, then `pnpm dev` (Vite + tsx watch).
- `start.sh` launches the app via `package.json` scripts only (`pnpm start` / `pnpm dev`). Do not invoke `node dist/index.js` directly.
- Reverse-proxy sub-path is already wired end-to-end. You don't need to touch `vite.config.ts`, wouter, or `api.ts`.
- Halerium runners are **ephemeral** (spin down after ~10 min idle). The filesystem persists, daemons do not. `start.sh` handles that.

## Runner Environment (what's actually there)

| Preinstalled | Not preinstalled | Available |
|---|---|---|
| Node v17 (too old — `start.sh` upgrades to v20) | `pnpm` (installed by script) | `sudo` without password (user: `jovyan`) |
| `npm`, `node` | PostgreSQL (apt-installed by script) | `apt-get` |
| `git` | Playwright browsers | `curl` |

## Reverse-Proxy Sub-Path Model

Halerium mounts each app under a dynamic path like:

```
/apps/<org>/<workspace>/<AppName>/
```

Three layers must be sub-path-aware. All three are wired in this template:

| Layer | How it works |
|---|---|
| **Vite assets** | `vite.config.ts` sets `base: "./"` — asset URLs become relative to `document.baseURI`. |
| **Client-side routing (`wouter`)** | `<Router base={BASE_PATH}>` in `client/src/App.tsx`. `BASE_PATH` comes from `client/src/lib/basePath.ts`. |
| **API fetch (`/api/*`)** | `client/src/lib/api.ts` prepends `BASE_PATH` via the same helper. |

### How `BASE_PATH` is resolved

`client/src/lib/basePath.ts` resolves in this order:

1. `import.meta.env.VITE_BASE_PATH` — set at build time if you know the prefix.
2. `<base href="…">` tag in `index.html` — the server **injects** this at request time (see below).
3. empty string (root deployment, local dev).

The Express server (`server/_core/vite.ts`) rewrites the placeholder `<base href="/">` in `index.html` to `<base href="${prefix}/">` on every request. `prefix` is resolved from:

1. `X-Forwarded-Prefix` header (emitted by most reverse proxies).
2. `BASE_PATH` env var (fallback).
3. empty (root).

Point Halerium's proxy to forward `X-Forwarded-Prefix` — or set `BASE_PATH` in the app env — and everything downstream (wouter, api client, Vite assets) resolves correctly.

## Startup Bootstrap (`start.sh`)

On every runner boot the script performs, idempotently:

1. Upgrades Node to v20 via `n`.
2. Installs `pnpm@10` if missing.
3. `apt-get install postgresql` if missing.
4. Runs `initdb` on first boot (creates `pg-data/`).
5. Removes stale `pg-data/postmaster.pid` if the PID is gone (the daemon died with the previous spin-down).
6. Starts the daemon, creates the `app` role and `app_db` database.
7. `pnpm install` (if `node_modules` missing), `pnpm db:migrate` (versioned migrations, not `db:push`), `pnpm db:seed`.
8. **Prod mode** (default): `pnpm build` if `dist/` is missing, then `pnpm start`.
   **Dev mode** (`--dev`): skip build, `pnpm dev` for HMR + tsx watch.

`PORT` is exported to the environment so both `pnpm dev` and `pnpm start` pick it up (the server reads `process.env.PORT`). Use dev mode while iterating; prod mode for deploys and verification.

`setup-postgres.sh` is the **local** installer for dev machines. On runners, use `start.sh`.

## Verification

- **Local root**: `pnpm dev` on `:8497` still works — nothing regresses.
- **Sub-path simulation**: proxy `/some/path/` → `:8497` locally (nginx or similar) with `X-Forwarded-Prefix: /some/path`. Assets, routes, and API calls should all resolve.
- **Halerium deploy**: create a `nano` app, run `bash start.sh`, open the app URL. First boot takes ~5 min (installing Postgres). Subsequent boots ~30 s.

## Troubleshooting

When the app fails to start or behaves unexpectedly on a runner, check logs **before** making code changes:

1. **`app-startup.log`** (repo root) — bootstrap output from `start.sh`. Shows whether Node upgrade, pnpm install, Postgres, migrations, build, or seed failed.
2. **`<pkg-name>_logs/error.log`** — server runtime errors (pino). If the process started but requests fail, look here.
3. **`pg-data/pg.log`** — PostgreSQL daemon log. Check if the database won't start or connections are refused.
4. **Browser dev tools → Console / Network** — if the page loads but is blank or shows errors, check for failed asset requests.

| Symptom | Likely cause | Fix |
|---|---|---|
| Blank page / "expected JavaScript, got text/html" | `dist/public/` missing — the catch-all returns `index.html` for every URL. | Run `pnpm build` and check for errors. On runners, delete `dist/` and re-run `start.sh`. |
| App process exits immediately | Build never ran, or `dist/index.js` is missing. | Run `pnpm build` first. Check `app-startup.log` for build errors. |
| Port conflict / app not reachable | Runner restarted but a stale process holds the port. | Check `app-startup.log` for "Port X is busy." The server auto-selects the next free port — find the actual port in the log. |
| Database errors | Postgres daemon not running or stale PID. | Re-run `start.sh` (it cleans stale PIDs). Check `pg-data/pg.log`. |
| 401 on every API call | `JWT_SECRET` not set in `.env`. | Add it: `openssl rand -hex 32`. |

See also the **Build & Run** and **Common Failures** sections in `llm.txt` for the full reference.

## Anti-Patterns

- Do not hardcode absolute URLs in client code. Use `BASE_PATH` / `getApiBase()` from `client/src/lib/basePath.ts`.
- Do not assume Postgres is running. `start.sh` guarantees it on app boot; don't skip it on runner deployments.
- Do not pick `standard` / `small` runner types until you have a reason — `nano` is what works here.
- Do not run `pnpm start` without building first. `pnpm start` serves from `dist/`, which must be created by `pnpm build`. Use `start.sh` on runners — it handles the build automatically.
- Do not claim the app works without verifying. After starting, check: `curl localhost:PORT/api/health` → `{"status":"ok"}`, then open the app in a browser.
