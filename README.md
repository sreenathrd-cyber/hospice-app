# Hospice Connected-Care Platform

Turborepo monorepo. One repo, three apps, shared packages.

```
apps/
  mobile/   # Expo (SDK 57) — patient/caregiver + care-team in ONE app; sign-in role routes you
  web/      # Next.js 16 — care-team web dashboard
  api/      # NestJS 12 — the ONLY backend; all PHI flows through here
packages/
  types/    # zod v4 schemas — single source of truth for every domain type
  db/       # Drizzle ORM schema + migrations (PostgreSQL only)
  ui/       # (reserved) shared design tokens / cross-platform hooks
  config/   # shared tsconfig + eslint bases
```

## Rules of the repo

- Backend (`apps/api`) is the sole PHI authority. Mobile/web never touch the database.
- Every domain type is a zod v4 schema in `packages/types`, derived via `z.infer`. Never duplicate a type across apps.
- Domain models never contain `null`/`undefined` — absence is an explicit discriminated union.
- `useEffect` is a code smell: banned for data fetching / prop-sync / derived state; every remaining one carries a one-line justification.
- Patterns must pay rent: no pass-through Controller → Service → Repository ceremony.
- Full playbook: `../goals/hospice-smartphone-app-build/files/ai-codegen-playbook-hospice-app.md`

## Quick start

```bash
npm install
cp .env.example apps/api/.env   # then fill in TELNYX_API_KEY (server-side only)
turbo run db:generate           # emit Drizzle migrations (needs DATABASE_URL to apply)
turbo run typecheck lint test build
turbo run dev                   # all apps
```

## Secrets

`TELNYX_API_KEY` lives **only** in `apps/api/.env` (gitignored, server-side). It is never
bundled into mobile/web, never logged, never committed.
