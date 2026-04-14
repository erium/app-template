# Development (Implementation) Architecture View

This document describes the code organization, module structure, technology stack, and build pipeline.

---

## Monorepo Structure

Top-level directory layout and the role of each package.

```mermaid
graph TD
    Root["/ (project root)"]

    Root --> Client["client/<br/>React SPA (Vite)"]
    Root --> Server["server/<br/>Express API"]
    Root --> Shared["shared/<br/>Shared types"]
    Root --> Drizzle["drizzle/<br/>DB schema"]
    Root --> Data["pg-data/<br/>PostgreSQL data"]
    Root --> Uploads["uploads/<br/>File storage"]
    Root --> Docs["docs/<br/>Documentation"]
    Root --> Dist["dist/<br/>Production build"]

    Client --> CSrc["src/"]
    CSrc --> CPages["pages/ — 12 route pages"]
    CSrc --> CComp["components/ — UI + domain"]
    CSrc --> CCompUI["components/ui/ — shadcn/ui"]
    CSrc --> CHooks["hooks/ — useMobile, usePersistFn"]
    CSrc --> CCoreHooks["_core/hooks/ — useAuth"]
    CSrc --> CLib["lib/ — api.ts, i18n.ts, utils.ts"]
    CSrc --> CLocales["locales/ — de/, en/"]
    CSrc --> CCtx["contexts/ — ThemeContext"]

    Server --> SCore["_core/ — index.ts, auth.ts, env.ts"]
    Server --> SRoutes["routes/ — auth, tenant, payment, export"]
    Server --> SMW["middleware/ — auth.ts"]
    Server --> SUtils["utils/ — video.ts"]
    Server --> SServices["db.ts, email.ts, stripe.ts,<br/>storage.ts, pdfExport.ts"]

    Drizzle --> Schema["schema.ts — 4 tables"]

    Shared --> Types["types.ts — re-exports from schema"]
```

---

## Server Module Architecture

How server modules depend on each other, from entry point to database.

```mermaid
graph TD
    Entry["_core/index.ts<br/>Server Entry"]

    Entry --> WH["webhookRoutes.ts<br/>Stripe webhooks<br/>(raw body)"]
    Entry --> BP["express.json()<br/>Body parsers"]
    Entry --> UL["uploadRoutes.ts<br/>Multer file uploads"]
    Entry --> AM["middleware/auth.ts<br/>authenticateUser"]
    Entry --> AR["routes/index.ts<br/>API router"]
    Entry --> Vite["_core/vite.ts<br/>Vite dev / static prod"]

    AR --> AuthR["routes/auth.ts<br/>register, login, verify,<br/>reset, logout"]
    AR --> TenantR["routes/tenant.ts<br/>users, invites, settings"]
    AR --> PayR["routes/payment.ts<br/>checkout, transactions"]
    AR --> ExpR["routes/export.ts<br/>PDF generation"]

    AuthR --> DB["db.ts<br/>Drizzle queries"]
    AuthR --> EmailS["email.ts<br/>Nodemailer"]
    AuthR --> AuthCore["_core/auth.ts<br/>JWT sign/verify"]
    TenantR --> DB
    TenantR --> EmailS
    PayR --> DB
    PayR --> StripeS["stripe.ts<br/>Stripe SDK"]
    ExpR --> PDF["pdfExport.ts<br/>Playwright"]
    WH --> DB
    WH --> StripeS
    UL --> Storage["storage.ts<br/>Local FS"]

    AM --> AuthCore
    AM --> DB

    DB --> Schema["drizzle/schema.ts"]

    style Entry fill:#e8f4fd,stroke:#2196F3
    style DB fill:#fff3e0,stroke:#FF9800
    style Schema fill:#fff3e0,stroke:#FF9800
```

---

## Client Module Architecture

How the React frontend is structured from pages down to the API layer.

```mermaid
graph TD
    AppTsx["App.tsx<br/>ErrorBoundary + ThemeProvider<br/>+ TooltipProvider + Router"]

    AppTsx --> Pages["Pages"]
    Pages --> Home["Home"]
    Pages --> Dashboard["Dashboard"]
    Pages --> Login["Login"]
    Pages --> Register["Register"]
    Pages --> Settings["Settings"]
    Pages --> Billing["Billing"]
    Pages --> AdminUsers["AdminUsers"]
    Pages --> Other["Join, Verify, ForgotPassword,<br/>ResetPassword, NotFound"]

    Pages --> Comp["components/"]
    Pages --> Hooks["Hooks"]

    Comp --> UILib["components/ui/<br/>~60 shadcn/ui components<br/>(Button, Dialog, Form, Table...)"]
    Comp --> Domain["Domain components<br/>(ErrorBoundary, Layout...)"]

    Hooks --> UseAuth["useAuth()<br/>session + logout"]
    Hooks --> UseMobile["useMobile()<br/>responsive breakpoints"]

    UseAuth --> APIClient["lib/api.ts<br/>Typed fetch wrapper"]
    Pages --> APIClient

    APIClient --> RQ["TanStack React Query<br/>Caching + mutations"]
    RQ -->|"HTTP fetch<br/>credentials: include"| Server["Express API"]

    AppTsx --> I18n["lib/i18n.ts<br/>i18next (de, en)"]
    I18n --> Locales["locales/<br/>de/common.json<br/>en/common.json"]

    style AppTsx fill:#e8f4fd,stroke:#2196F3
    style Server fill:#f3e5f5,stroke:#9C27B0
```

---

## Express Middleware Pipeline

The order in which middleware processes each incoming request.

```mermaid
graph LR
    Req["Incoming<br/>Request"] --> WH{"Path =<br/>/api/webhook/*?"}

    WH -->|Yes| Raw["express.raw()<br/>→ webhookRouter"]
    WH -->|No| JSON["express.json()<br/>express.urlencoded()<br/>(50MB limit)"]

    JSON --> Upload{"Path =<br/>/api/upload?"}
    Upload -->|Yes| Multer["Multer<br/>(1GB, 30min timeout)"]
    Upload -->|No| Auth["authenticateUser<br/>Parse JWT cookie<br/>→ req.user"]

    Multer --> Res["Response"]

    Auth --> API{"Path =<br/>/api/*?"}
    API -->|Yes| Routes["Route Handler<br/>(+ requireAuth / requireAdmin)"]
    API -->|No| Static{"NODE_ENV?"}

    Static -->|dev| ViteDev["Vite HMR<br/>Dev Server"]
    Static -->|prod| StaticFiles["Static Files<br/>dist/public/"]

    Routes --> Res
    ViteDev --> Res
    StaticFiles --> Res
    Raw --> Res

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
        DevCmd --> TSX["tsx watch<br/>server/_core/index.ts"]
        TSX --> DevServer["Express + Vite Dev Server<br/>HMR for client<br/>Auto-restart for server"]
    end

    subgraph Prod["Production Build"]
        BuildCmd["pnpm build"]
        BuildCmd --> ViteBuild["vite build<br/>→ dist/public/"]
        BuildCmd --> ESBuild["esbuild<br/>server/_core/index.ts<br/>→ dist/index.js<br/>(ESM, external deps)"]

        StartCmd["pnpm start"]
        ViteBuild --> StartCmd
        ESBuild --> StartCmd
        StartCmd --> ProdServer["node dist/index.js<br/>Serves static + API"]
    end

    subgraph Tools["Dev Tools"]
        Check["pnpm check<br/>tsc --noEmit"]
        Lint["pnpm lint<br/>eslint"]
        Test["pnpm test<br/>vitest run"]
        DBPush["pnpm db:push<br/>drizzle-kit push"]
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
        Express["Express 4"]
        DrizzleORM["Drizzle ORM"]
        PG["node-postgres (pg)"]
        Jose["jose (JWT)"]
        Bcrypt["bcryptjs"]
        Nodemailer["Nodemailer"]
        StripeSdk["Stripe SDK"]
        PlaywrightLib["Playwright"]
        MulterLib["Multer"]
    end

    subgraph Frontend["Frontend"]
        React["React 19"]
        Vite["Vite 7"]
        Tailwind["TailwindCSS 4"]
        ShadcnUI["shadcn/ui<br/>(Radix primitives)"]
        Wouter["wouter<br/>(routing)"]
        RQuery["TanStack<br/>React Query"]
        I18Next["i18next"]
        Framer["Framer Motion"]
        Recharts["Recharts"]
    end

    subgraph Build["Build Tools"]
        TSC["TypeScript"]
        ESBuildTool["esbuild"]
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

All REST endpoints grouped by module.

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

> 🔒 = `requireAuth` &nbsp;&nbsp; 🛡️ = `requireAdmin`
