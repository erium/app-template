# My App — Full-Stack Template

A production-ready full-stack TypeScript template: React + Express + PostgreSQL with auth, multi-tenancy, i18n, Stripe billing, and PDF export wired up.

Clone it, rename it, build your app on top.

## Features

- **Auth** — JWT session cookies, register/login/verify/reset, email-gated activation.
- **Multi-tenancy** — Tenant → users model, invitations with role-based access (viewer/editor/admin).
- **i18n** — `react-i18next` with English + German, auto language detection.
- **Stripe billing** — Checkout session creation, webhook-based fulfillment, transaction history.
- **PDF export** — Playwright-based HTML → PDF REST endpoint.
- **AI chat** — Vercel AI SDK streaming example at `/chat-example`, OpenAI-compatible (swap `OPENAI_BASE_URL` for Azure / OpenRouter / local).
- **Email** — Nodemailer with SMTP (logs to console if unconfigured).
- **UI** — shadcn/ui (53 components) on TailwindCSS 4, Radix primitives, dark-mode ready.
- **Type-safe API** — Express REST with zod validation and a typed `fetch` wrapper on the client.

## Prerequisites

- Node.js 20+
- pnpm 10+
- A POSIX shell (the Postgres setup script uses `bash`)
- `sudo` access if you don't already have PostgreSQL installed

## Quick Start

```bash
# 0. Detach from the template repo so you don't accidentally push upstream
bash detach.sh

# 1. Install dependencies
pnpm install

# 2. Set up local PostgreSQL (apt-installs + initializes + starts on :5432)
bash setup-postgres.sh

# 3. Configure env (at minimum, set JWT_SECRET)
cp .env.example .env
# edit .env — generate a JWT_SECRET with: openssl rand -hex 32

# 4. Apply migrations and seed a default tenant + admin user
pnpm db:migrate
pnpm db:seed

# 5. Start the dev server
pnpm dev
```

Open <http://localhost:8497> and log in with the seeded credentials:

- **Email:** `admin@example.com`
- **Password:** `ChangeMe!2026`

Change that password immediately.

## Project Structure

```
.
├── client/            React + Vite frontend
│   └── src/
│       ├── pages/     One file per route
│       ├── components/ui/  shadcn primitives
│       ├── lib/       api.ts (typed fetch), i18n.ts, utils.ts
│       └── locales/   de/, en/
├── server/            Express backend
│   ├── _core/         Entry point, env, cookies, vite dev middleware
│   ├── middleware/    auth.ts (requireAuth, requireAdmin)
│   ├── routes/        REST endpoints grouped by resource
│   └── db.ts          Drizzle queries
├── drizzle/           Schema, migrations, seed
├── shared/            config.ts, const.ts shared by client + server
├── docs/              Architecture documentation
├── CONVENTIONS.md     Coding standards (read before writing code)
├── llm.txt            AI-agent brief
└── setup-postgres.sh  Local PostgreSQL installer
```

## Scripts

| Script | What it does |
|---|---|
| `pnpm dev` | Dev server with Vite + `tsx watch`. |
| `pnpm build` | Vite client build + esbuild server bundle into `dist/`. |
| `pnpm start` | Run the production bundle. |
| `pnpm check` | TypeScript check (`tsc --noEmit`). |
| `pnpm lint` / `pnpm lint:fix` | ESLint. |
| `pnpm format` | Prettier write. |
| `pnpm test` | Vitest. |
| `pnpm db:generate` | Generate a migration from `drizzle/schema.ts` changes. |
| `pnpm db:migrate` | Apply pending migrations to PostgreSQL. |
| `pnpm db:push` | Destructive schema sync — **first-time local setup only**. |
| `pnpm db:seed` | Idempotent default tenant + admin user. |

## Environment Variables

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `JWT_SECRET` | **yes** | — | Signs session JWTs. Generate: `openssl rand -hex 32`. |
| `DATABASE_URL` | no | `postgresql://app:app@localhost:5432/app_db` | PostgreSQL connection string. |
| `APP_URL` | no | `http://localhost:8497` | Public URL used in email links. |
| `PORT` | no | `8497` | HTTP port. |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` / `SMTP_FROM` | no | — | Email sender. Without these, emails log to console. |
| `STRIPE_SECRET_KEY` | no | — | Stripe API key. Without it, billing is disabled. |
| `STRIPE_WEBHOOK_SECRET` | no | — | Used to verify Stripe webhook signatures. |

See [`.env.example`](./.env.example) for the template.

## Building on This Template

- **`llm.txt`** — AI-agent brief: architecture, tech stack, commands, feature-addition recipe. Read first if you're letting an agent write code.
- **[`CONVENTIONS.md`](./CONVENTIONS.md)** — Coding standards, naming, file layout, API/DB patterns, anti-patterns. Read before writing code yourself.
- **[`ARCHITECTURE.md`](./ARCHITECTURE.md)** — System overview with ASCII diagrams: request lifecycle, auth flow, multi-tenancy, file upload, PDF export.
- **[`docs/architecture-logical.md`](./docs/architecture-logical.md)** — Runtime view: components, sequences, integrations (mermaid).
- **[`docs/architecture-development.md`](./docs/architecture-development.md)** — Build pipeline and code organization.
- **[`docs/architecture-data.md`](./docs/architecture-data.md)** — Schema, data flow, state management.

## Customization

### Branding

Edit [`shared/config.ts`](./shared/config.ts):

```ts
export const APP_NAME = "My App";
export const APP_DESCRIPTION = "A full-stack application template";
export const SUPPORT_EMAIL = "support@example.com";
```

Replace [`client/public/favicon.svg`](./client/public/favicon.svg) with your own icon. That's it for branding — `APP_NAME` flows through UI, page titles, and email templates.

### Adding Features

- **New page** — add a file to `client/src/pages/`, wire it into `client/src/App.tsx`.
- **New API route** — add a file to `server/routes/`, register it in `server/routes/index.ts`.
- **New DB table** — edit `drizzle/schema.ts`, run `pnpm db:generate` + `pnpm db:migrate`, add helpers to `server/db.ts`.
- **New i18n string** — add the key to both `client/src/locales/de/common.json` and `en/common.json`.

See the "Feature Recipe" section of `llm.txt` for the full step-by-step.

### Database Setup

This repo uses local PostgreSQL installed via `setup-postgres.sh`, not Docker — the script installs via `apt`, initializes `./pg-data/`, and starts a server on port 5432.

- Start / re-setup: `bash setup-postgres.sh`
- Stop and uninstall: `bash setup-postgres.sh uninstall`

If you want to use an existing PostgreSQL instance, skip the script and set `DATABASE_URL` in `.env` accordingly.

## License

MIT — see [`LICENSE`](./LICENSE) if present, otherwise refer to the license field in `package.json`.
