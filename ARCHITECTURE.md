# Architecture

A single-file overview of how this template is assembled. ASCII diagrams so it renders in any terminal, IDE, or git host. For deeper views, see `docs/architecture-logical.md`, `docs/architecture-development.md`, and `docs/architecture-data.md` (mermaid).

## System Overview

```
                         ┌───────────────────┐
                         │  Browser (User)   │
                         └─────────┬─────────┘
                                   │ HTTPS
                                   ▼
                    ┌───────────────────────────┐
                    │   React SPA (Vite build)  │
                    │   wouter routing          │
                    │   React Query + api.ts    │
                    └─────────────┬─────────────┘
                                  │ fetch  /api/*
                                  │ cookie: app_session_id (JWT)
                                  ▼
                    ┌───────────────────────────┐
                    │       Express Server      │
                    │  webhookRouter (raw body) │
                    │  express.json             │
                    │  authenticateUser         │
                    │  /api/* routers           │
                    │  /uploads static          │
                    │  Vite middleware (dev)    │
                    └──┬─────────────┬────────┬─┘
                       │             │        │
                ┌──────┴──────┐  ┌───┴────┐  ┌┴───────────┐
                │  server/db  │  │ stripe │  │ nodemailer │
                │  drizzle-orm│  │  SDK   │  │   SMTP     │
                └──────┬──────┘  └───┬────┘  └──┬─────────┘
                       │             │          │
                       ▼             ▼          ▼
              ┌──────────────┐  ┌────────┐  ┌────────┐
              │ PostgreSQL   │  │ Stripe │  │  SMTP  │
              │   app_db     │  │  API   │  │ server │
              └──────────────┘  └────────┘  └────────┘

              ┌──────────────┐  ┌─────────────────────┐
              │  uploads/    │  │  Playwright + FFprobe
              │  (multer)    │  │  (PDF export / probes)
              └──────────────┘  └─────────────────────┘
```

The SPA and API are a single Node process. In dev, Vite middleware serves the client; in prod, Express serves `dist/public/`.

## Request Lifecycle

```
┌─── Browser ─────────────────────────────────────────────────────────┐
│   fetch("/api/tenant/settings", { credentials: "include" })          │
└──────────────────────────────────────┬──────────────────────────────┘
                                       │
                                       ▼
┌─── Express ─────────────────────────────────────────────────────────┐
│  1. webhookRouter   (skipped: not /api/webhook/stripe)               │
│  2. express.json    (parse JSON body)                                │
│  3. authenticateUser                                                 │
│       ├── read app_session_id cookie                                 │
│       ├── verify JWT with JWT_SECRET (jose)                          │
│       └── populate req.user (id, email, tenantId, role, …)           │
│  4. Router match:  /api/tenant → tenantRouter                        │
│  5. router.use(requireAuth)   → 401 if !req.user                     │
│  6. handler:                                                         │
│       ├── zod.parse(req.body | req.params)                           │
│       ├── await db.getTenantById(req.user.tenantId)                  │
│       └── res.json({ … })                                            │
└──────────────────────────────────────┬──────────────────────────────┘
                                       │
                                       ▼
┌─── server/db.ts (Drizzle) ──────────────────────────────────────────┐
│   db.select().from(tenants).where(eq(tenants.id, id)).limit(1)       │
└──────────────────────────────────────┬──────────────────────────────┘
                                       │ pg.Pool
                                       ▼
┌─── PostgreSQL (app_db) ─────────────────────────────────────────────┐
│   Row returned → { id, name, slug, … }                               │
└─────────────────────────────────────────────────────────────────────┘
```

On failure, handlers `return res.status(4xx|5xx).json({ error })`. The `authenticateUser` middleware never rejects — `requireAuth` and `requireAdmin` are the gates.

## Authentication Flow

```
Register
──────────────────────────────────────────────────────────────────────
User ─┬─ POST /api/auth/register { email, password, name, companyName }
      │
      ▼
Express ── createTenantWithAdmin() (one tx: tenant + admin user)
      │   emailVerified: null
      │   verificationToken: randomUUID()
      ▼
fire-and-forget: sendVerificationEmail(email, token)
      │
      ▼
200 OK { success: true }   ← NO session cookie issued yet

Email Verification
──────────────────────────────────────────────────────────────────────
User clicks link ─ POST /api/auth/verify-email { token }
      │
      ▼
db.getUserByVerificationToken(token) → user
db.verifyUserEmail(user.id)          (emailVerified = now, token = null)
      │
      ▼
authService.createSessionToken()  → JWT signed with JWT_SECRET
Set-Cookie: app_session_id=<JWT>; HttpOnly; SameSite; 1y TTL
200 OK

Login
──────────────────────────────────────────────────────────────────────
POST /api/auth/login { email, password }
      │
      ▼
db.getUserByEmail → user
   if !user.emailVerified      → 403
   if !bcrypt.compare          → 401
      │
      ▼
Set-Cookie: app_session_id=<JWT>; 1y TTL
200 OK { user }

Subsequent Request
──────────────────────────────────────────────────────────────────────
fetch("/api/...", { credentials: "include" })
      │   Cookie: app_session_id=<JWT>
      ▼
authenticateUser → jose.jwtVerify(JWT, JWT_SECRET)
                → populate req.user
      │
      ▼
requireAuth / requireAdmin → handler
```

The JWT is the full session. There is no server-side session store. Invalidation is time-based (1-year TTL) + client-side logout clears the cookie.

## Multi-Tenancy Model

```
             tenants                        users                       invitations
    ┌─────────────────────┐       ┌─────────────────────┐       ┌────────────────────┐
    │ id (PK)              │◄──┐   │ id (PK)              │   ┌──►│ id (PK)              │
    │ name                 │   │   │ email (unique)       │   │   │ tenant_id (FK)       │
    │ slug (unique)        │   └───│ tenant_id (FK)       │   │   │ email                │
    │ billing_email        │       │ role enum            │   │   │ role enum            │
    │ credits              │       │   viewer|editor|admin│   │   │ token (unique)       │
    │ created_at           │       │ password_hash        │   │   │ expires_at           │
    └─────────────────────┘       │ language de|en       │   │   │ status               │
              ▲                   │ email_verified       │   │   │   pending|accepted   │
              │                   │ verification_token   │   │   │   |expired           │
              └───── cascade ─────│ reset_token          │   │   │ created_at           │
                   on delete      │ …                    │   │   └────────────────────┘
                                  └─────────────────────┘   │          ▲
                                                            │          │ cascade on
                                                            └──────────┘ tenant delete
```

- A tenant is a company / organization. A user belongs to exactly one tenant.
- Roles: `viewer` (read-only), `editor` (standard), `admin` (tenant-wide management).
- An invitation is a pending user, carried by an unguessable token emailed out. `/api/auth/join` consumes it to create the real user under the invitation's tenant.
- `deleteTenantFull()` wraps invitations, users, and the tenant row in a single transaction. FK cascades back this up.

### Authorization tiers

| Tier | Middleware | Example endpoints |
|---|---|---|
| Public | — | `POST /api/auth/login`, `POST /api/auth/register` |
| Protected | `requireAuth` | `GET /api/auth/me`, `POST /api/payment/checkout`, `POST /api/export/pdf` |
| Admin | `requireAuth` + `requireAdmin` | `POST /api/tenant/invite`, `PUT /api/tenant/name`, `DELETE /api/tenant` |

Routers apply the tier once via `router.use(requireAuth)` and add `requireAdmin` on individual handlers when needed. Role checks are middleware-only — never in handler bodies.

## File Upload

```
User drops file in UI
      │
      ▼
POST /api/upload   multipart/form-data, field "file"
      │
      ▼
registerUploadRoutes (server/uploadRoutes.ts)
  ├── multer.diskStorage → writes to uploads/<nanoid><.ext>
  ├── limit: 1 GB, timeout: 30 min
  └── 200 { url: "/uploads/<filename>", filename, originalName }
                                  │
                                  ▼
Express.static("/uploads", UPLOAD_DIR) serves the file back.
```

- `uploads/` is `.gitignored`. Nothing touches DB from this flow — URLs are stored by whatever feature needs them.
- The `/api/upload` endpoint is not behind `requireAuth` today; add the middleware before handing it to users if you don't want open uploads.

## PDF Export

```
Client: const pdfBytes = await (await fetch("/api/export/pdf", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ html }),
        })).arrayBuffer();
      │
      ▼
/api/export/pdf  (router.use(requireAuth))
  ├── zod: { html: string.min(1) }
  └── generatePdfFromHtml(html)  (server/pdfExport.ts)
         ├── launch headless Chromium (Playwright)
         ├── setContent(html, { waitUntil: "networkidle" })
         ├── page.pdf({ format: "A4", printBackground: true })
         └── return Buffer
      │
      ▼
res.setHeader("Content-Type", "application/pdf")
res.setHeader("Content-Disposition", "attachment; filename=export.pdf")
res.send(pdf)
```

The endpoint is deliberately minimal — the caller supplies the HTML. Build templates client-side (or in a dedicated helper) and POST the rendered string. Keeps Playwright out of the routes layer.

## Stripe Webhook (Payments)

```
Stripe → POST /api/webhook/stripe   (raw body, registered BEFORE express.json)
  ├── stripe.webhooks.constructEvent(rawBody, signature, STRIPE_WEBHOOK_SECRET)
  ├── event.type === "checkout.session.completed":
  │     ├── db.getTransactionByStripeSessionId(sessionId)  (idempotency)
  │     ├── db.createTransaction(...)
  │     └── db.addTenantCredits(user.tenantId, creditsToAdd)
  └── 200 { received: true }
```

Stripe requires the raw body to verify signatures. `webhookRouter` is mounted before the JSON body parser for that reason — see `server/_core/index.ts`.

## Further Reading

- **[`llm.txt`](./llm.txt)** — AI-agent brief with the feature-addition recipe.
- **[`CONVENTIONS.md`](./CONVENTIONS.md)** — coding standards, patterns, anti-patterns.
- **[`docs/architecture-logical.md`](./docs/architecture-logical.md)** — runtime view with mermaid sequence diagrams.
- **[`docs/architecture-development.md`](./docs/architecture-development.md)** — code organization and build pipeline.
- **[`docs/architecture-data.md`](./docs/architecture-data.md)** — ER diagram and data flow details.
