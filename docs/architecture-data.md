# Data Architecture View

This document describes the data model, data flow patterns, and state management across the system.

---

## Entity-Relationship Diagram

All database tables, their columns, and relationships.

```mermaid
erDiagram
    TENANTS {
        integer id PK "auto-increment"
        text name "required"
        text slug UK "unique, URL-safe"
        text billingEmail "optional"
        integer credits "default 0"
        timestamp createdAt "auto"
    }

    USERS {
        integer id PK "auto-increment"
        text email UK "unique, required"
        text passwordHash "bcrypt, cost 12"
        text name "optional"
        integer tenantId FK "→ tenants.id"
        text role "viewer | editor | admin"
        integer credits "default 0"
        text language "de | en"
        timestamp createdAt "auto"
        timestamp updatedAt "auto"
        timestamp lastSignedIn "auto"
        timestamp emailVerified "nullable"
        text verificationToken "nullable"
        text resetToken "nullable"
        timestamp resetTokenExpires "nullable"
    }

    INVITATIONS {
        integer id PK "auto-increment"
        integer tenantId FK "→ tenants.id"
        text email "required"
        text role "viewer | editor | admin"
        text token UK "unique"
        timestamp expiresAt "7 days"
        text status "pending | accepted | expired"
        timestamp createdAt "auto"
    }

    TRANSACTIONS {
        integer id PK "auto-increment"
        integer userId FK "→ users.id"
        integer amount "cents"
        integer credits "purchased credits"
        text stripeSessionId "idempotency key"
        text status "pending | completed | failed"
        timestamp createdAt "auto"
    }

    TENANTS ||--o{ USERS : "has many (cascade delete)"
    TENANTS ||--o{ INVITATIONS : "has many (cascade delete)"
    USERS ||--o{ TRANSACTIONS : "has many (cascade delete)"
```

---

## End-to-End Data Flow

How data moves between the browser, server, and database.

```mermaid
graph LR
    subgraph Browser["Browser"]
        UI["React Components"]
        RQ["React Query<br/>Cache"]
        Fetch["fetch()<br/>credentials: include"]
    end

    subgraph Server["Next.js Route Handlers"]
        MW["Auth Helper<br/>requireUser / requireAdmin"]
        Handler["Route Handler<br/>(app/api/*/route.ts)"]
        Service["Service Layer<br/>(email, stripe, pdf)"]
        ORM["Drizzle ORM"]
    end

    subgraph Storage["Storage"]
        DB[("PostgreSQL<br/>app_db")]
        FS["File System<br/>uploads/"]
    end

    UI -->|"User action"| RQ
    RQ -->|"Query / Mutation"| Fetch
    Fetch -->|"HTTP + cookie"| MW
    MW -->|"AuthUser"| Handler
    Handler --> ORM
    Handler --> Service
    ORM -->|"SQL"| DB
    Service -->|"Read/Write"| FS
    DB -->|"Result"| ORM
    ORM -->|"Typed result"| Handler
    Handler -->|"JSON"| Fetch
    Fetch -->|"Response"| RQ
    RQ -->|"Re-render"| UI
```

---

## Client-Side State Management

How state is managed in the React frontend.

```mermaid
graph TD
    subgraph ServerState["Server State (React Query)"]
        AuthQ["useAuth()<br/>queryKeys.auth.me<br/>User session data"]
        TenantQ["Tenant queries<br/>queryKeys.tenant.*<br/>Settings, users, invites"]
        PayQ["Payment queries<br/>queryKeys.payment.*<br/>Transactions"]
    end

    subgraph LocalState["Local State"]
        Theme["ThemeContext<br/>(localStorage)"]
        Forms["Form state<br/>(React useState)"]
        Lang["i18next language<br/>(browser detection)"]
    end

    subgraph Persistence["Persistence"]
        Cookie["app_session_id<br/>httpOnly cookie<br/>(JWT, 1yr TTL)"]
        LS["localStorage<br/>theme preference"]
    end

    AuthQ -->|"Invalidate on<br/>login/logout"| Cookie
    Theme -->|"Persist"| LS
    Forms -->|"Mutation"| ServerState
```

---

## Authentication Token Lifecycle

How JWT sessions are created, used, and expire.

```mermaid
stateDiagram-v2
    [*] --> Created: POST /register or /login

    Created --> Cookie: Set-Cookie: app_session_id
    note right of Cookie
        httpOnly, sameSite=lax
        path="/", 1 year TTL
    end note

    Cookie --> Verified: Each request
    note right of Verified
        requireUser(request):
        1. Parse cookie header
        2. Verify JWT signature (HS256)
        3. Fetch user from DB
        4. Match tenantId
        5. Return AuthUser (or throw 401)
    end note

    Verified --> Active: Valid
    Verified --> Rejected: Invalid / Expired / Tenant mismatch

    Active --> Cookie: Next request

    Active --> Cleared: POST /logout
    note right of Cleared
        Clear cookie
        (maxAge: 0)
    end note

    Cleared --> [*]
    Rejected --> [*]
```

---

## Credit & Payment Data Flow

How money flows from Stripe through to tenant credits.

```mermaid
graph TD
    subgraph Client["Client"]
        BuyBtn["Buy Credits button"]
        TxList["Transaction history"]
    end

    subgraph API["Route Handlers"]
        Checkout["POST /api/payment/checkout<br/>Create Stripe session"]
        WebhookH["POST /api/webhook/stripe<br/>Handle payment event"]
        TxGet["GET /api/payment/transactions"]
    end

    subgraph Stripe["Stripe"]
        StripeCheckout["Checkout Page<br/>(hosted by Stripe)"]
        StripeEvent["Webhook Event<br/>checkout.session.completed"]
    end

    subgraph DB["PostgreSQL"]
        TxTable["transactions<br/>{amount, credits,<br/>stripeSessionId, status}"]
        TenantTable["tenants<br/>{credits}"]
    end

    BuyBtn -->|"1. Request"| Checkout
    Checkout -->|"2. Create session"| StripeCheckout
    StripeCheckout -->|"3. User pays"| StripeEvent
    StripeEvent -->|"4. Webhook POST"| WebhookH

    WebhookH -->|"5a. Check idempotency<br/>(stripeSessionId)"| TxTable
    WebhookH -->|"5b. Insert record"| TxTable
    WebhookH -->|"5c. Add credits<br/>(1 cent = 1 credit)"| TenantTable

    TxGet -->|"6. Query"| TxTable
    TxTable -->|"7. History"| TxList

    style Stripe fill:#f3e5f5,stroke:#9C27B0
```

---

## Tenant Data Isolation

How multi-tenancy is enforced at the data level.

```mermaid
graph TD
    subgraph Auth["Authentication Layer"]
        JWT["JWT Payload<br/>{userId, email, tenantId}"]
        MW["src/server/getUser.ts<br/>Verifies token.tenantId<br/>matches user.tenantId in DB"]
    end

    subgraph Queries["Query Scoping"]
        UserQ["getUsers(tenantId)<br/>WHERE tenantId = ?"]
        InviteQ["getInvitations<br/>WHERE tenantId = ?"]
        TenantQ["getTenantById(id)<br/>Only own tenant"]
    end

    subgraph Cascade["Cascade Delete"]
        DelTenant["deleteTenantFull()"]
        DelInvitations["DELETE invitations<br/>WHERE tenantId = ?"]
        DelUsers["DELETE users<br/>WHERE tenantId = ?"]
        DelTenantRow["DELETE tenant"]
    end

    JWT --> MW
    MW -->|"user.tenantId"| Queries

    DelTenant --> DelInvitations
    DelInvitations --> DelUsers
    DelUsers --> DelTenantRow
```

---

## Email Token Data Flows

How verification and reset tokens are managed.

```mermaid
graph TD
    subgraph Verification["Email Verification"]
        Reg["POST /register"] -->|"Generate token"| VToken["users.verificationToken<br/>(random string)"]
        VToken -->|"Email link:<br/>APP_URL/verify?token=..."| VEmail["Verification Email"]
        VEmail -->|"User clicks"| VVerify["POST /verify-email"]
        VVerify -->|"Match token,<br/>set emailVerified = now(),<br/>clear verificationToken"| VDone["Verified"]
    end

    subgraph Reset["Password Reset"]
        Forgot["POST /forgot-password"] -->|"Generate token + expiry"| RToken["users.resetToken<br/>users.resetTokenExpires<br/>(1 hour)"]
        RToken -->|"Email link:<br/>APP_URL/reset-password?token=..."| REmail["Reset Email"]
        REmail -->|"User clicks"| RReset["POST /reset-password"]
        RReset -->|"Match token,<br/>check expiry,<br/>update passwordHash,<br/>clear resetToken"| RDone["Password Updated"]
    end

    subgraph Invitation["Invitation"]
        Invite["POST /tenant/invite"] -->|"Generate token + 7d expiry"| IToken["invitations.token<br/>invitations.expiresAt"]
        IToken -->|"Email link:<br/>APP_URL/join?token=..."| IEmail["Invitation Email"]
        IEmail -->|"User clicks"| IJoin["POST /auth/join"]
        IJoin -->|"Match token,<br/>create user,<br/>set status = accepted"| IDone["User Joined"]
    end
```

---

## Database Technology Details

| Property | Value |
|----------|-------|
| **Engine** | PostgreSQL (node-postgres) |
| **ORM** | Drizzle ORM 0.44 |
| **Connection** | `postgresql://app:app@localhost:5432/app_db` (configurable via `DATABASE_URL`) |
| **Schema Management** | `drizzle-kit generate` + `drizzle-kit migrate` (versioned migrations committed to git) |
| **Transactions** | Used for tenant+user creation, tenant deletion |
| **Cascade Deletes** | ON DELETE CASCADE on all foreign keys |
| **Type Safety** | Full TypeScript inference via `$inferSelect` / `$inferInsert` |
