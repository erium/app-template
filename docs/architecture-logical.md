# Logical Architecture View

This document describes the system from a functional perspective — its key abstractions, external dependencies, and how they interact at runtime.

---

## System Context

Shows the application boundary, its users, and the external systems it integrates with.

```mermaid
graph TB
    User["👤 User<br/>(Browser)"]

    subgraph System["Application"]
        SPA["React SPA<br/>(Client)"]
        API["Express API<br/>(Server)"]
        DB[("PostgreSQL<br/>Database")]
        FS["Local<br/>File Storage"]
    end

    SMTP["SMTP Server<br/>(Email)"]
    Stripe["Stripe<br/>(Payments)"]
    FFprobe["FFprobe<br/>(Video Analysis)"]
    Chromium["Chromium<br/>(PDF Export)"]

    User -->|"HTTPS"| SPA
    SPA -->|"REST API<br/>/api/*"| API
    API -->|"Drizzle ORM"| DB
    API -->|"Read/Write"| FS
    API -->|"SMTP"| SMTP
    API -->|"Checkout &<br/>Webhooks"| Stripe
    API -->|"Spawn"| FFprobe
    API -->|"Playwright"| Chromium
```

---

## Component Overview

The major logical components and their responsibilities.

```mermaid
graph LR
    subgraph Client["Client (React SPA)"]
        Pages["Pages<br/>12 routes"]
        Components["Components<br/>UI + Domain"]
        Hooks["Hooks<br/>useAuth, useMobile"]
        APIClient["API Client<br/>Typed fetch + React Query"]
    end

    subgraph Server["Server (Express)"]
        Middleware["Middleware<br/>Auth, Body Parser"]
        Routes["Route Modules<br/>auth, tenant, payment, export"]
        Services["Services<br/>Email, Stripe, Storage, PDF"]
        DBLayer["DB Layer<br/>Drizzle queries"]
    end

    subgraph Data["Data Stores"]
        PG[("PostgreSQL")]
        Uploads["uploads/"]
    end

    Pages --> Components
    Pages --> Hooks
    Hooks --> APIClient
    APIClient -->|"HTTP"| Middleware
    Middleware --> Routes
    Routes --> Services
    Routes --> DBLayer
    DBLayer --> PG
    Services --> Uploads
```

---

## Authentication Flow

How a user registers, logs in, and makes authenticated requests.

```mermaid
sequenceDiagram
    actor User
    participant Client as React SPA
    participant API as Express API
    participant DB as PostgreSQL
    participant Email as SMTP

    Note over User,Email: Registration
    User->>Client: Fill registration form
    Client->>API: POST /api/auth/register
    API->>DB: createTenantWithAdmin()<br/>(transaction: tenant + user)
    API->>Email: sendVerificationEmail()
    API-->>Client: Set app_session_id cookie (JWT)
    Client-->>User: Redirect to /dashboard

    Note over User,Email: Email Verification
    User->>Client: Click link in email
    Client->>API: POST /api/auth/verify-email { token }
    API->>DB: verifyUserEmail()
    API-->>Client: 200 OK

    Note over User,Email: Subsequent Login
    User->>Client: Enter credentials
    Client->>API: POST /api/auth/login
    API->>DB: getUserByEmail() + bcrypt verify
    API-->>Client: Set app_session_id cookie (JWT, 1yr TTL)

    Note over User,Email: Authenticated Request
    Client->>API: GET /api/tenant/settings<br/>(cookie: app_session_id)
    API->>API: authenticateUser middleware<br/>JWT verify → populate req.user
    API->>API: requireAuth middleware
    API->>DB: getTenantById()
    API-->>Client: { name: "..." }
```

---

## Payment Flow

How credits are purchased via Stripe Checkout.

```mermaid
sequenceDiagram
    actor User
    participant Client as React SPA
    participant API as Express API
    participant Stripe as Stripe
    participant DB as PostgreSQL

    User->>Client: Select credit package
    Client->>API: POST /api/payment/checkout<br/>{ amount, credits }
    API->>Stripe: Create Checkout Session<br/>(EUR, one-time, metadata: credits)
    Stripe-->>API: { sessionId, url }
    API-->>Client: { url }
    Client->>Stripe: Redirect to Stripe Checkout

    User->>Stripe: Complete payment
    Stripe->>API: POST /api/webhook/stripe<br/>(checkout.session.completed)
    API->>API: Verify webhook signature
    API->>DB: Check idempotency<br/>(stripeSessionId)
    API->>DB: Insert transaction record
    API->>DB: Update tenant credits<br/>(1 cent = 1 credit)
    API-->>Stripe: 200 OK

    User->>Client: Return to app
    Client->>API: GET /api/payment/transactions
    API->>DB: Query transactions
    API-->>Client: Transaction history
```

---

## Multi-Tenant Authorization Model

How roles and tenant isolation work.

```mermaid
graph TD
    subgraph Tenant["Tenant (Company)"]
        Admin["Admin<br/>Full access"]
        Editor["Editor<br/>Standard access"]
        Viewer["Viewer<br/>Read-only access"]
    end

    subgraph Permissions["Endpoint Authorization"]
        Public["Public<br/>/api/auth/login<br/>/api/auth/register<br/>/api/health"]
        AuthRequired["requireAuth<br/>/api/payment/*<br/>/api/export/*<br/>/api/auth/language"]
        AdminOnly["requireAdmin<br/>/api/tenant/users<br/>/api/tenant/invite<br/>/api/tenant/name"]
    end

    Admin -->|"Access"| Public
    Admin -->|"Access"| AuthRequired
    Admin -->|"Access"| AdminOnly
    Editor -->|"Access"| Public
    Editor -->|"Access"| AuthRequired
    Viewer -->|"Access"| Public
    Viewer -->|"Access"| AuthRequired

    style AdminOnly fill:#fee,stroke:#c33
    style AuthRequired fill:#ffd,stroke:#cc3
    style Public fill:#dfd,stroke:#3c3
```

---

## Invitation Flow

How users are invited to join a tenant.

```mermaid
sequenceDiagram
    actor Admin
    participant Client as React SPA
    participant API as Express API
    participant DB as PostgreSQL
    participant Email as SMTP
    actor Invitee

    Admin->>Client: Enter email + role
    Client->>API: POST /api/tenant/invite
    API->>DB: createInvitation()<br/>(token, 7-day expiry)
    API->>Email: sendInvitationEmail()
    API-->>Client: 201 Created

    Invitee->>Client: Click invitation link<br/>→ /join?token=...
    Client->>API: POST /api/auth/join<br/>{ token, name, password }
    API->>DB: getInvitationByToken()
    API->>DB: createUser()<br/>(tenantId from invitation)
    API->>DB: acceptInvitation()
    API-->>Client: Set session cookie
    Client-->>Invitee: Redirect to /dashboard
```
