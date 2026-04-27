# Development (Implementation) Architecture View

This document describes the code organization, module structure, technology stack, and build pipeline.

---

## Project Structure

Top-level directory layout and the role of each package.

```mermaid
graph TD
    Root["/ (project root)"]

    Root --> App["app/<br/>Next.js App Router"]
    Root --> Src["src/<br/>Client components + helpers"]
    Root --> Server["server/<br/>Business logic"]
    Root --> Shared["shared/<br/>Shared types + config"]
    Root --> Drizzle["drizzle/<br/>DB schema"]
    Root --> Public["public/<br/>Static assets"]
    Root --> Data["pg-data/<br/>PostgreSQL data"]
    Root --> Uploads["uploads/<br/>File storage"]
    Root --> Docs["docs/<br/>Documentation"]
    Root --> NextOut[".next/<br/>Production build"]

    App --> ALayout["layout.tsx — HTML shell"]
    App --> AProviders["providers.tsx — QueryClient, theme"]
    App --> APages["*/page.tsx — thin wrappers"]
    App --> AAPI["api/*/route.ts — Route Handlers"]

    Src --> SViews["views/ — 13 route pages"]
    Src --> SComp["components/ — UI + domain"]
    Src --> SCompUI["components/ui/ — shadcn/ui"]
    Src --> SHooks["hooks/ — useMobile, usePersistFn"]
    Src --> SCoreHooks["_core/hooks/ — useAuth"]
    Src --> SLib["lib/ — api.ts, basePath.ts, i18n.ts"]
    Src --> SLocales["locales/ — de/, en/"]
    Src --> SCtx["contexts/ — ThemeContext"]
    Src --> SServer["server/getUser.ts — auth helpers"]

    Server --> SCore["_core/ — auth.ts, env.ts, cookies.ts"]
    Server --> SUtils["utils/ — logger.ts"]
    Server --> SServices["db.ts, email.ts, stripe.ts,<br/>storage.ts, pdfExport.ts"]

    Drizzle --> Schema["schema.ts — 4 tables"]

    Shared --> Types["config.ts, const.ts"]
```

---

## Server Module Architecture

How server modules depend on each other, from Route Handler to database.

```mermaid
graph TD
    AuthH["app/api/auth/*/route.ts<br/>register, login, verify, reset, logout"]
    TenantH["app/api/tenant/*/route.ts<br/>users, invites, settings"]
    PayH["app/api/payment/*/route.ts<br/>checkout, transactions"]
    ExpH["app/api/export/pdf/route.ts<br/>PDF generation"]
    UploadH["app/api/upload/route.ts<br/>File uploads"]
    WebhookH["app/api/webhook/stripe/route.ts<br/>Stripe events (raw body)"]
    ChatH["app/api/chat/route.ts<br/>AI streaming"]

    GU["src/server/getUser.ts<br/>requireUser / requireAdmin"]

    AuthH --> GU
    TenantH --> GU
    PayH --> GU
    ExpH --> GU
    ChatH --> GU

    GU --> AuthCore["server/_core/auth.ts<br/>JWT sign/verify"]
    GU --> DB["server/db.ts<br/>Drizzle queries"]

    AuthH --> DB
    AuthH --> EmailS["server/email.ts<br/>Nodemailer"]
    TenantH --> DB
    TenantH --> EmailS
    PayH --> DB
    PayH --> StripeS["server/stripe.ts<br/>Stripe SDK"]
    ExpH --> PDF["server/pdfExport.ts<br/>Playwright"]
    UploadH --> Storage["server/storage.ts<br/>Local FS"]
    WebhookH --> DB
    WebhookH --> StripeS

    DB --> Schema["drizzle/schema.ts"]

    style GU fill:#e8f4fd,stroke:#2196F3
    style DB fill:#fff3e0,stroke:#FF9800
    style Schema fill:#fff3e0,stroke:#FF9800
```

---

## Client Module Architecture

How the Next.js frontend is structured from layout down to the API layer.

```mermaid
graph TD
    Layout["app/layout.tsx<br/>HTML shell + Providers"]

    Layout --> Providers["app/providers.tsx<br/>QueryClient, ThemeProvider, i18n"]
    Layout --> Pages["app/*/page.tsx<br/>Thin wrappers"]

    Pages --> Views["src/views/<br/>13 business-logic pages"]
    Views --> Home["Home"]
    Views --> Dashboard["Dashboard"]
    Views --> Login["Login"]
    Views --> Register["Register"]
    Views --> Settings["Settings"]
    Views --> Billing["Billing"]
    Views --> Other["AdminUsers, Join, Verify,<br/>ForgotPassword, ResetPassword, NotFound"]

    Views --> Comp["src/components/"]
    Views --> Hooks["Hooks"]

    Comp --> UILib["components/ui/<br/>~53 shadcn/ui components<br/>(Button, Dialog, Form, Table...)"]
    Comp --> Domain["Domain components<br/>(DashboardLayout, ErrorBoundary...)"]

    Hooks --> UseAuth["useAuth()<br/>session + logout"]
    Hooks --> UseMobile["useMobile()<br/>responsive breakpoints"]

    UseAuth --> APIClient["src/lib/api.ts<br/>Typed fetch wrapper"]
    Views --> APIClient

    APIClient --> RQ["TanStack React Query<br/>Caching + mutations"]
    RQ -->|"HTTP fetch<br/>credentials: include"| Server["Next.js Route Handlers<br/>app/api/*"]

    Providers --> I18n["src/lib/i18n.ts<br/>i18next (de, en)"]
    I18n --> Locales["src/locales/<br/>de/common.json<br/>en/common.json"]

    style Layout fill:#e8f4fd,stroke:#2196F3
    style Server fill:#f3e5f5,stroke:#9C27B0
```

---

## Request Handling Pipeline

How Next.js processes each incoming request.

```mermaid
graph LR
    Req["Incoming<br/>Request"] --> NX{"Next.js<br/>Router"}

    NX -->|"app/api/*"| Handler["Route Handler<br/>(app/api/*/route.ts)"]
    NX -->|"app/*/page"| Page["Page Render<br/>(RSC shell → client hydrate)"]
    NX -->|"public/*"| Static["Static File"]

    Handler --> Auth{"needs auth?"}
    Auth -->|"requireUser"| Check["src/server/getUser.ts<br/>parse cookie → verify JWT<br/>→ throws Response(401/403)"]
    Auth -->|"public"| Logic["Handler Logic"]

    Check --> Logic
    Logic --> DB["server/db.ts<br/>Drizzle queries"]
    Logic --> Res["NextResponse.json(...)"]

    DB --> Res

    Page --> Providers["app/providers.tsx<br/>QueryClient, theme, i18n"]
    Providers --> Views["src/views/<br/>Client components"]

    style Req fill:#e8f4fd,stroke:#2196F3
    style Res fill:#c8e6c9,stroke:#4CAF50
```

---

## Build Pipeline

Development vs. production build processes.

```mermaid
graph TB
    subgraph Dev["Development Mode"]
        DevCmd["pnpm dev"]
        DevCmd --> DevServer["next dev<br/>HMR for pages + Route Handlers<br/>Port from PORT env (default 8497)"]
    end

    subgraph Prod["Production Build"]
        BuildCmd["pnpm build"]
        BuildCmd --> NextBuild["next build<br/>→ .next/<br/>(RSC, code splitting, static assets)"]

        StartCmd["pnpm start"]
        NextBuild --> StartCmd
        StartCmd --> ProdServer["next start<br/>Serves .next/ build"]
    end

    subgraph Tools["Dev Tools"]
        Check["pnpm check<br/>tsc --noEmit"]
        Lint["pnpm lint<br/>eslint"]
        Test["pnpm test<br/>vitest run"]
        DBGen["pnpm db:generate<br/>drizzle-kit generate"]
    end

    style Dev fill:#e8f4fd,stroke:#2196F3
    style Prod fill:#fff3e0,stroke:#FF9800
    style Tools fill:#f3e5f5,stroke:#9C27B0
```

---

## Technology Stack

```mermaid
graph LR
    subgraph Runtime["Runtime"]
        Node["Node.js<br/>(ESM)"]
    end

    subgraph Backend["Backend"]
        NextJS["Next.js 15<br/>(App Router + Route Handlers)"]
        DrizzleORM["Drizzle ORM"]
        PG["node-postgres (pg)"]
        Jose["jose (JWT)"]
        Bcrypt["bcryptjs"]
        Nodemailer["Nodemailer"]
        StripeSdk["Stripe SDK"]
        PlaywrightLib["Playwright"]
    end

    subgraph Frontend["Frontend"]
        React["React 19"]
        Tailwind["TailwindCSS 4"]
        ShadcnUI["shadcn/ui<br/>(Radix primitives)"]
        RQuery["TanStack<br/>React Query"]
        I18Next["i18next"]
        Framer["Framer Motion"]
        Recharts["Recharts"]
        AISDk["Vercel AI SDK 4"]
    end

    subgraph Build["Build Tools"]
        TSC["TypeScript 5.9"]
        ESLint["ESLint 10"]
        Vitest["Vitest"]
        DrizzleKit["Drizzle Kit"]
    end

    Node --> Backend
    Node --> Frontend
    Node --> Build
```

---

## API Route Map

All REST endpoints, each implemented as a Route Handler in `app/api/`.

```mermaid
graph TD
    API["/api"]

    API --> Health["/health<br/>GET — status check"]

    API --> Auth["/auth"]
    Auth --> AuthMe["GET /me"]
    Auth --> AuthReg["POST /register"]
    Auth --> AuthLogin["POST /login"]
    Auth --> AuthLogout["POST /logout"]
    Auth --> AuthVerify["POST /verify-email"]
    Auth --> AuthJoin["POST /join"]
    Auth --> AuthForgot["POST /forgot-password"]
    Auth --> AuthReset["POST /reset-password"]
    Auth --> AuthLang["POST /language 🔒"]
    Auth --> AuthDel["DELETE /account 🔒"]

    API --> Tenant["/tenant"]
    Tenant --> TSettings["GET /settings 🔒"]
    Tenant --> TName["PUT /name 🛡️"]
    Tenant --> TUsers["GET /users 🛡️"]
    Tenant --> TInvite["POST /invite 🛡️"]
    Tenant --> TInvites["GET /invites 🛡️"]
    Tenant --> TInvDel["DELETE /invites/:id 🛡️"]
    Tenant --> TInvResend["POST /invites/:id/resend 🛡️"]
    Tenant --> TUserRole["PUT /users/:userId/role 🛡️"]
    Tenant --> TUserDel["DELETE /users/:userId 🛡️"]
    Tenant --> TDel["DELETE / 🛡️"]

    API --> Payment["/payment"]
    Payment --> PCheckout["POST /checkout 🔒"]
    Payment --> PTx["GET /transactions 🔒"]

    API --> Export["/export"]
    Export --> EPDF["POST /pdf 🔒"]

    API --> UploadEP["/upload<br/>POST — file upload"]
    API --> Webhook["/webhook/stripe<br/>POST — Stripe events"]
```

> 🔒 = `requireUser` &nbsp;&nbsp; 🛡️ = `requireAdmin`
