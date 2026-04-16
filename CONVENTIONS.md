# Conventions

Rules any contributor — human or AI — should follow when writing code in this repo.
These are the source of truth.

## TypeScript

- `strict` is on in `tsconfig.json`. Don't weaken it.
- Avoid `any`. Use `unknown` and narrow, or define a real type.
- Prefer inferred types; only annotate public function signatures and exported values.
- Use named exports. Default exports only for React pages wired into the router.
- Use `const` by default; `let` only when the binding is actually reassigned.
- Validate all untrusted input (request bodies, query params, env vars) with zod.

## Naming

| What | Convention | Example |
|---|---|---|
| React components | PascalCase | `DashboardLayout.tsx` |
| Pages (files in `client/src/pages/`) | PascalCase | `AdminUsers.tsx` |
| Hooks | `use*` camelCase | `useAuth.ts` |
| Other TS files | camelCase | `pdfExport.ts`, `webhookRoutes.ts` |
| Functions / variables | camelCase | `getUserByEmail` |
| Constants | SCREAMING_SNAKE in `shared/const.ts`, else camelCase | `COOKIE_NAME`, `ONE_YEAR_MS` |
| DB columns | `snake_case` in the DB, camelCase in the Drizzle model | `tenant_id` → `tenantId` |
| API paths | `/api/<resource>/<action>` kebab-case | `/api/auth/forgot-password` |

## File Organization

```
client/src/
  pages/          One file per route in App.tsx
  components/     Reusable components (DashboardLayout, ErrorBoundary, …)
  components/ui/  shadcn primitives — don't hand-edit, regenerate via shadcn CLI
  lib/            api.ts (typed fetch wrapper), i18n.ts, utils.ts
  _core/hooks/    Cross-cutting hooks (useAuth)
  locales/        i18n resources (de/, en/)

server/
  _core/          Entry point, env, cookies, vite dev middleware
  middleware/     Express middleware (auth.ts)
  routes/         REST endpoints grouped by resource (auth, tenant, payment, export)
  db.ts           All Drizzle queries live here — route handlers call these helpers
  email.ts        Nodemailer transport + email templates
  stripe.ts       Stripe client
  pdfExport.ts    Playwright HTML→PDF
  webhookRoutes.ts Stripe webhook (registered BEFORE json body parser)

drizzle/
  schema.ts       Tables, columns, types
  seed.ts         Idempotent default tenant + admin user
  migrations/     drizzle-kit output

shared/
  config.ts       APP_NAME, APP_DESCRIPTION, SUPPORT_EMAIL
  const.ts        COOKIE_NAME, time constants
```

## Components

- Functional components only. No class components.
- Base all interactive UI on shadcn primitives in `components/ui/`. Compose, don't fork.
- All user-facing strings go through `useTranslation()` → i18n keys. No hardcoded copy.
- Use `useAuth()` for session state; do not call `/api/auth/me` directly.
- Toast feedback via `sonner` (`toast.success`, `toast.error`). Don't use browser `alert`.
- Client-side routing via `wouter` (`Link`, `useLocation`). Don't add `react-router`.

## API Routes

- One file per resource under `server/routes/`. Export an Express `Router`.
- Register the router in `server/routes/index.ts` — never import route files into the entry point directly.
- Apply auth at the router level when every handler needs it:
  ```ts
  router.use(requireAuth);
  router.put("/users/:id/role", requireAdmin, handler);
  ```
- Validate the body with zod before using it:
  ```ts
  const body = schema.parse(req.body);
  ```
- On success, return JSON. On failure, return `{ error: string }` with a 4xx/5xx status. Let middleware catch thrown errors.
- Log errors with context: `console.error("[Tenant] getSettings error:", err)`.

## DB Operations

- All Drizzle queries live in `server/db.ts`. Route handlers call helpers from there.
- Single-row queries: destructure the result.
  ```ts
  const [user] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  ```
- Inserts and updates: use `.returning()` and return the first row.
  ```ts
  const [row] = await db.insert(users).values(data).returning();
  ```
- Multi-step writes: wrap in `db.transaction(async (tx) => { … })`. Use `tx`, not `db`, inside.
- Cascade deletes on tenants → users / invitations / transactions are already configured in the schema. Rely on them.

## Client API Pattern

- Only call the server through `api.*` from `client/src/lib/api.ts`. Never call `fetch` directly in components.
- Data fetching uses `@tanstack/react-query`:
  ```ts
  useQuery({ queryKey: queryKeys.me, queryFn: api.getMe });
  useMutation({ mutationFn: api.login, onSuccess: … });
  ```
- Errors bubble as `ApiError` (status + body). Components show `toast.error(err.message)`.

## i18n

- All strings via `t("some.key")`. Both `de/common.json` and `en/common.json` must contain every key.
- New keys: add to both locales or translation will fall back silently.
- Placeholders: use i18next interpolation — `t("welcome_user", { name })` with `"{{name}}"` in the JSON.

## Auth Patterns

Three tiers, applied via middleware from `server/middleware/auth.ts`:

- **Public** — no middleware. Login, register, verify email.
- **Protected** — `requireAuth`. Dashboard, settings, self-service.
- **Admin** — `requireAuth` + `requireAdmin`. Tenant-wide management.

Never check roles inside a handler if middleware can enforce it.

## Branding & Config

- `APP_NAME` etc. live in `shared/config.ts`. Import from there.
- Never hardcode the app name, support email, or domain URLs anywhere else.
- Secrets live in `.env`. `.env.example` documents every variable.

## Logging

- Server code uses `logger` from `server/utils/logger.ts` (pino). Never use `console.*` on the server.
- Call sites: `logger.info("message")`, `logger.warn({ key: value }, "message")`, `logger.error({ err }, "message")`. Passing errors as `{ err }` preserves stack traces.
- HTTP access logs are emitted automatically by `pino-http` — you don't need to log requests manually.
- Files land in `<pkg-name>_logs/` at the repo root: `app.log` (all levels) and `error.log` (errors). `pino-roll` rotates daily / at 10 MB.
- Levels: dev defaults to `debug`, prod to `info`. Override with `LOG_LEVEL` in `.env` (e.g. `LOG_LEVEL=trace`).
- `<pkg-name>` is derived from `package.json`'s `name` field.

## Testing

- Framework: `vitest`. Run with `pnpm test`.
- Test files: colocated `*.test.ts` (node) or `*.test.tsx` (jsdom) next to the unit under test.
- Default environment is `node`. Files under `client/**/*.test.tsx` automatically use `jsdom` — see `vitest.config.ts`.
- Prefer integration tests that hit the real DB over heavily mocked unit tests.
- Integration tests isolate themselves by creating their own tenant + user with a `randomUUID()`-based email / slug and deleting the tenant in `afterAll` (cascade drops dependents). Tests run sequentially (`fileParallelism: false`) so they can share the dev database safely.
- Prerequisite for integration tests: `bash setup-postgres.sh && pnpm db:migrate`.

## Scripts Cheat Sheet

| Script | What it does |
|---|---|
| `pnpm dev` | Dev server with Vite + tsx watch |
| `pnpm build` | Vite client build + esbuild server bundle |
| `pnpm start` | Run the production bundle |
| `pnpm check` | TypeScript `--noEmit` |
| `pnpm lint` / `pnpm lint:fix` | ESLint |
| `pnpm format` | Prettier write |
| `pnpm test` | Vitest |
| `pnpm db:generate` | Generate migration from schema changes |
| `pnpm db:migrate` | Apply pending migrations |
| `pnpm db:push` | Destructive sync — first-time setup only |
| `pnpm db:seed` | Idempotent seed (default tenant + admin) |

## Migrations

Schema changes go through `drizzle/schema.ts` → `pnpm db:generate` → review SQL → `pnpm db:migrate` → commit the `.sql` file. Never use `db:push` on a database with real data. Never run raw DDL (`CREATE TABLE`, `ALTER TABLE`). See the **Database Migrations** section in `llm.txt` for full details.

## Anti-Patterns

Do not:

- Reintroduce tRPC. The API is Express REST by choice.
- Add `axios`. Use `fetch` via `api.ts`.
- Scatter DB queries across route handlers. Put them in `server/db.ts`.
- Hardcode copy. Use i18n keys.
- Commit `.env`, `pg-data/`, `uploads/`, `data/`, `dist/`, or `*_logs/`.
- Skip pre-commit hooks with `--no-verify`.
- Add backwards-compat shims for code that doesn't exist yet.
- Use `console.log/warn/error` in server code. Import `logger` from `server/utils/logger.ts` instead.
- Write multi-paragraph doc comments — the code should speak for itself.
