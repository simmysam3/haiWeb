# CLAUDE.md -- haiWeb (HAIWAVE Account Portal & Marketing Site)

## Project Overview
HAIWAVE Account Portal: the browser-based administration interface where registered HAIWAVE participants manage their network presence. Includes the public marketing site, custom auth flows, billing via Stripe, and manifest/agent configuration.

## Tech Stack
- **Framework:** Next.js 16 (App Router)
- **Language:** TypeScript (strict mode)
- **Styling:** Tailwind CSS v4 with HAIWAVE brand tokens
- **Auth:** Keycloak (OIDC Authorization Code Flow, custom login/registration forms via Keycloak Admin REST API)
- **Billing:** Stripe (subscriptions for platform fees, metered billing for connection fees)
- **API:** BFF pattern via Next.js API routes → haiCore API, Keycloak Admin API, Stripe API
- **Deployment:** GCP Cloud Run (containerized Next.js)

## Key Commands
```
npm install           # install dependencies
npm run dev           # start dev server
npm run build         # production build
npm run lint          # run eslint
```

## Project Structure
```
src/
├── app/
│   ├── page.tsx                    # Marketing landing page (public)
│   ├── login/page.tsx              # Custom login form
│   ├── register/page.tsx           # Registration flow (3 steps)
│   ├── account/                    # Account portal (authenticated)
│   │   ├── layout.tsx              # Sidebar navigation
│   │   ├── page.tsx                # Dashboard
│   │   ├── profile/               # Company profile management
│   │   ├── users/                  # User management (owner only)
│   │   ├── agents/                 # Agent provisioning & monitoring
│   │   ├── manifests/              # Counterparty & pricing manifests
│   │   ├── partners/               # Trading partner directory & management
│   │   ├── scores/                 # Behavioral score viewer
│   │   └── billing/                # Stripe billing & invoices (owner only)
│   ├── admin/                      # HAIWAVE admin console (admin:manage scope)
│   │   ├── layout.tsx
│   │   └── page.tsx
│   └── api/
│       ├── auth/                   # Keycloak-backed auth routes
│       │   ├── login/route.ts
│       │   ├── register/route.ts
│       │   ├── logout/route.ts
│       │   └── refresh/route.ts
│       └── webhooks/
│           └── stripe/route.ts     # Stripe webhook handler
├── components/                     # Shared UI components
└── lib/
    ├── keycloak.ts                 # Keycloak Admin REST API client
    ├── stripe.ts                   # Stripe client configuration
    └── haiwave-api.ts              # haiCore API client
```

## Architectural Boundaries
- The portal is a **frontend + BFF** (backend-for-frontend). It does NOT replicate business logic.
- All network operations (manifests, Go Fish, behavioral scores, trading relationships) go through the haiCore API.
- The portal does NOT directly access the central PostgreSQL database.
- Auth is custom forms backed by Keycloak Admin REST API (not Keycloak's built-in login pages).

## Brand Standards
- **Colors:** Deep Navy #1A1F36, Orange #F58220, Teal #29B0C3
- **Typography:** Space Grotesk (headlines), DM Sans (body)
- **Spacing:** 4px baseline grid, 20px within components, 40px between sections
- **Design:** Light and airy, high contrast, generous white space
- **Accessibility:** WCAG 2.1 AA compliance required

## Coding Conventions
- Use `camelCase` for TypeScript variables/functions
- Use `snake_case` for API request/response bodies (matching haiCore protocol)
- Server Components by default; `'use client'` only when needed
- Route handlers in `app/api/` for BFF logic
- No `any` types. Use `unknown` and narrow.
- `kebab-case` for file names

## Requirements Document
- Full spec: `../haiCore/docs/haiweb-account-requirements.md`
- Phase 1 scope: registration, billing, profile, users, agents, manifests, partners, scores
- Phase 2 deferred: pricing inheritance UI, admin analytics, ERP integration, SSO/SAML
