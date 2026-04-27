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
                    │   Next.js App (App Router)│
                    │   app/*/page.tsx routing  │
                    │   React Query + api.ts    │
                    └─────────────┬─────────────┘
                                  │ fetch  /api/*
                                  │ cookie: app_session_id (JWT)
                                  ▼
                    ┌───────────────────────────┐
                    │     Next.js Server        │
                    │  app/api/*/route.ts       │
                    │  requireUser/requireAdmin │
                    │  /api/uploads/* (static)  │
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
              │  uploads/    │  │  Playwright          │
              │  (formData)  │  │  (PDF export)        │
              └──────────────┘  └─────────────────────┘
```

The frontend and API run as a single Next.js process. In dev, `next dev` serves everything with HMR; in prod, `next build` + `next start`.

## Request Lifecycle

```
┌─── Browser ─────────────────────────────────────────────────────────┐
│   fetch("/api/tenant/settings", { credentials: "include" })          │
└──────────────────────────────────────┬──────────────────────────────┘
                                       │
                                       ▼
┌─── Next.js Route Handler ───────────────────────────────────────────┐
│   app/api/tenant/settings/route.ts  GET handler                      │
│                                                                      │
│  try {                                                               │
│    1. requireUser(request)                                           │
│         ├── parse app_session_id cookie                              │
│         ├── verify JWT with JWT_SECRET (jose)                        │
│         ├── fetch user from DB + match tenantId                      │
│         └── throws Response(401) if any check fails                  │
│    2. zod.parse(body | params)                                       │
│    3. await db.getTenantById(user.tenantId)                          │
│    4. return NextResponse.json({ … })                                │
│  } catch (err) {                                                     │
│    if (err instanceof Response) return err   ← 401/403               │
│    return NextResponse.json({ error }, { status: 500 })              │
│  }                                                                   │
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

Auth helpers live in `src/server/getUser.ts`. `requireUser` throws a `Response(401)`; `requireAdmin` throws `Response(403)`. The `catch` block returns the thrown Response unchanged.

## Authentication Flow

```
Register
──────────────────────────────────────────────────────────────────────
User ─┬─ POST /api/auth/register { email, password, name, companyName }
      │
      ▼
Route Handler ── createTenantWithAdmin() (one tx: tenant + admin user)
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
requireUser(request) → parse cookie → jose.jwtVerify(JWT, JWT_SECRET)
                     → fetch user from DB → verify tenantId match
      │
      ▼
handler logic → NextResponse.json({ … })
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

| Tier | Helper | Example endpoints |
|---|---|---|
| Public | — | `POST /api/auth/login`, `POST /api/auth/register` |
| Protected | `requireUser(request)` | `GET /api/auth/me`, `POST /api/payment/checkout`, `POST /api/export/pdf` |
| Admin | `requireAdmin(request)` | `POST /api/tenant/invite`, `PUT /api/tenant/name`, `DELETE /api/tenant` |

Each Route Handler calls the appropriate helper explicitly. Role checks are always via these helpers — never inline in handler bodies.

## File Upload

```
User drops file in UI
      │
      ▼
POST /api/upload   multipart/form-data, field "file"
      │
      ▼
app/api/upload/route.ts
  ├── await request.formData() → formData.get("file")
  ├── writes to uploads/<nanoid><.ext>
  └── 200 { url: "/uploads/<filename>", filename, originalName }
                                  │
                                  ▼
app/api/uploads/[...path]/route.ts serves the file back (streams from uploads/).
```

- `uploads/` is `.gitignored`. Nothing touches DB from this flow — URLs are stored by whatever feature needs them.
- The `/api/upload` endpoint is not behind `requireUser` today; add the helper before handing it to users if you don't want open uploads.

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
app/api/export/pdf/route.ts  (requireUser)
  ├── zod: { html: string.min(1) }
  └── generatePdfFromHtml(html)  (server/pdfExport.ts)
         ├── launch headless Chromium (Playwright)
         ├── setContent(html, { waitUntil: "networkidle" })
         ├── page.pdf({ format: "A4", printBackground: true })
         └── return Buffer
      │
      ▼
new Response(new Uint8Array(pdf), {
  headers: { "Content-Type": "application/pdf",
             "Content-Disposition": "attachment; filename=export.pdf" }
})
```

The endpoint is deliberately minimal — the caller supplies the HTML. Build templates client-side (or in a dedicated helper) and POST the rendered string. Keeps Playwright out of the routes layer.

## Stripe Webhook (Payments)

```
Stripe → POST /api/webhook/stripe
  app/api/webhook/stripe/route.ts
  ├── const rawBody = await request.text()
  ├── stripe.webhooks.constructEvent(rawBody, signature, STRIPE_WEBHOOK_SECRET)
  ├── event.type === "checkout.session.completed":
  │     ├── db.getTransactionByStripeSessionId(sessionId)  (idempotency)
  │     ├── db.createTransaction(...)
  │     └── db.addTenantCredits(user.tenantId, creditsToAdd)
  └── 200 { received: true }
```

Stripe requires the raw body to verify signatures. `request.text()` reads the body before any JSON parsing — this works natively in Next.js Route Handlers.

## Further Reading

- **[`llm.txt`](./llm.txt)** — AI-agent brief with the feature-addition recipe.
- **[`CONVENTIONS.md`](./CONVENTIONS.md)** — coding standards, patterns, anti-patterns.
- **[`docs/architecture-logical.md`](./docs/architecture-logical.md)** — runtime view with mermaid sequence diagrams.
- **[`docs/architecture-development.md`](./docs/architecture-development.md)** — code organization and build pipeline.
- **[`docs/architecture-data.md`](./docs/architecture-data.md)** — ER diagram and data flow details.
