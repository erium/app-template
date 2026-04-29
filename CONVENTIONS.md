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
| Views (files in `src/views/`) | PascalCase | `AdminUsers.tsx` |
| Hooks | `use*` camelCase | `useAuth.ts` |
| Other TS files | camelCase | `pdfExport.ts`, `webhookRoutes.ts` |
| Functions / variables | camelCase | `getUserByEmail` |
| Constants | SCREAMING_SNAKE in `shared/const.ts`, else camelCase | `COOKIE_NAME`, `ONE_YEAR_MS` |
| DB columns | `snake_case` in the DB, camelCase in the Drizzle model | `tenant_id` → `tenantId` |
| API paths | `/api/<resource>/<action>` kebab-case | `/api/auth/forgot-password` |

## File Organization

```
app/
  layout.tsx, providers.tsx    Root layout (server component) and client providers
  */page.tsx                   Thin page wrappers — re-export from src/views/
  not-found.tsx                404 page
  api/*/route.ts               Route Handlers — one file per endpoint group

src/
  views/          One file per App Router route ("use client" components)
  components/     Reusable components (DashboardLayout, ErrorBoundary, …)
  components/ui/  shadcn primitives — don't hand-edit, regenerate via shadcn CLI
  lib/            api.ts (typed fetch wrapper), basePath.ts, i18n.ts, utils.ts
  server/
    getUser.ts    Auth helpers for Route Handlers (getUser, requireUser, requireAdmin)
  _core/hooks/    Cross-cutting hooks (useAuth)
  locales/        i18n resources (de/, en/)

server/
  _core/          env.ts, auth.ts (JWT sign/verify), cookies.ts
  utils/          logger.ts (pino) — use this, not console
  db.ts           All Drizzle queries live here — route handlers call these helpers
  email.ts        Nodemailer transport + email templates
  stripe.ts       Stripe client
  pdfExport.ts    Playwright HTML→PDF
  storage.ts      Local file storage helpers

drizzle/
  schema.ts       Tables, columns, types
  seed.ts         Idempotent default tenant + admin user
  migrations/     drizzle-kit output

shared/
  config.ts       APP_NAME, APP_DESCRIPTION, SUPPORT_EMAIL
  const.ts        COOKIE_NAME, time constants

public/           Static assets (favicon.svg, etc.)
```

## Components

- Functional components only. No class components.
- Base all interactive UI on shadcn primitives in `components/ui/`. Compose, don't fork.
- All user-facing strings go through `useTranslation()` → i18n keys. No hardcoded copy.
- Use `useAuth()` for session state; do not call `/api/auth/me` directly.
- Toast feedback via `sonner` (`toast.success`, `toast.error`). Don't use browser `alert`.
- Client-side routing via `next/link` (`Link`) and `next/navigation` (`useRouter`, `usePathname`). Don't add wouter or react-router.
- All page components in `src/views/` must have `"use client"` at the top. Guard any `localStorage`/`window` access with `if (typeof window === "undefined")` — Next.js SSRs client components for the initial HTML.

## API Routes

- One file per endpoint group under `app/api/`. Export named functions (`GET`, `POST`, `PUT`, `DELETE`).
- Import `requireUser` or `requireAdmin` from `src/server/getUser.ts` — never inline auth logic.
- Both helpers throw a `Response` object. Wrap the handler body in try/catch:
  ```ts
  export async function GET(request: Request) {
    try {
      const user = await requireUser(request);
      const body = schema.parse(await request.json()); // for POST/PUT
      const result = await db.someHelper(user.tenantId);
      return NextResponse.json(result);
    } catch (err) {
      if (err instanceof Response) return err;
      logger.error({ err }, "[Resource] handler error");
      return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
  }
  ```
- Validate the body with zod before using it. On success, return `NextResponse.json(data)`. On validation failure, zod throws and the catch block returns 500 — catch `ZodError` explicitly if you want a 400.
- Log errors with `logger` from `server/utils/logger.ts` (never `console.*`).

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

- Only call the server through `api.*` from `src/lib/api.ts`. Never call `fetch` directly in components.
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

Three tiers, enforced per-handler via helpers from `src/server/getUser.ts`:

- **Public** — no helper call. Login, register, verify email, health check.
- **Protected** — `const user = await requireUser(request)`. Dashboard, settings, self-service.
- **Admin** — `const user = await requireAdmin(request)`. Tenant-wide management.

Both helpers throw a `Response` when access is denied; the `catch (err) { if (err instanceof Response) return err; }` pattern propagates the 401/403 back to the client. Never inline JWT parsing or role checks in handler bodies.

## Branding & Config

- `APP_NAME` etc. live in `shared/config.ts`. Import from there.
- Never hardcode the app name, support email, or domain URLs anywhere else.
- Secrets live in `.env`. `.env.example` documents every variable.

## Logging

- Server code uses `logger` from `server/utils/logger.ts` (pino). Never use `console.*` on the server.
- Call sites: `logger.info("message")`, `logger.warn({ key: value }, "message")`, `logger.error({ err }, "message")`. Passing errors as `{ err }` preserves stack traces.
- Files land in `logs/` at the repo root: `app.<YYYY-MM-DD>.log.ndjson` (all levels) and `error.<YYYY-MM-DD>.log.ndjson` (errors only). Format is NDJSON (one JSON object per line, ISO 8601 timestamps). One file per day per stream — restarts on the same day append to the existing file.
- Levels: dev defaults to `debug`, prod to `info`. Override with `LOG_LEVEL` in `.env` (e.g. `LOG_LEVEL=trace`).

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
| `pnpm dev` | Next.js dev server with HMR |
| `pnpm build` | Next.js production build → `.next/` |
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

- Reintroduce tRPC or Express. The API uses Next.js Route Handlers by design.
- Add `axios`. Use `fetch` via `api.ts`.
- Scatter DB queries across route handlers. Put them in `server/db.ts`.
- Hardcode copy. Use i18n keys.
- Access `localStorage` or `window` at component top level — guard with `if (typeof window === "undefined")`.
- Commit `.env`, `pg-data/`, `uploads/`, `data/`, `.next/`, or `logs/`.
- Skip pre-commit hooks with `--no-verify`.
- Add backwards-compat shims for code that doesn't exist yet.
- Use `console.log/warn/error` in server code. Import `logger` from `server/utils/logger.ts` instead.
- Write multi-paragraph doc comments — the code should speak for itself.
