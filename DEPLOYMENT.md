# Deployment (Halerium App Runners)

Short, agent-oriented brief for deploying this template to Halerium. For local dev, `README.md` is enough — read this only when targeting a Halerium App or any other reverse-proxy sub-path host.

## TL;DR

- Runner type: **`nano`**. `standard` silently fails on this environment.
- Launch production: `bash start.sh [PORT]` — bootstraps Node, pnpm, Postgres, schema, builds, runs `pnpm start`.
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
7. `pnpm install` (if `node_modules` missing), `pnpm db:push`, `pnpm db:seed`.
8. **Prod mode** (default): `pnpm build` if `dist/` is missing, then `pnpm start`.
   **Dev mode** (`--dev`): skip build, `pnpm dev` for HMR + tsx watch.

`PORT` is exported to the environment so both `pnpm dev` and `pnpm start` pick it up (the server reads `process.env.PORT`). Use dev mode while iterating; prod mode for deploys and verification.

`setup-postgres.sh` is the **local** installer for dev machines. On runners, use `start.sh`.

## Verification

- **Local root**: `pnpm dev` on `:8497` still works — nothing regresses.
- **Sub-path simulation**: proxy `/some/path/` → `:8497` locally (nginx or similar) with `X-Forwarded-Prefix: /some/path`. Assets, routes, and API calls should all resolve.
- **Halerium deploy**: create a `nano` app, run `bash start.sh`, open the app URL. First boot takes ~5 min (installing Postgres). Subsequent boots ~30 s.

## Anti-Patterns

- Do not hardcode absolute URLs in client code. Use `BASE_PATH` / `getApiBase()` from `client/src/lib/basePath.ts`.
- Do not assume Postgres is running. `start.sh` guarantees it on app boot; don't skip it on runner deployments.
- Do not pick `standard` / `small` runner types until you have a reason — `nano` is what works here.
