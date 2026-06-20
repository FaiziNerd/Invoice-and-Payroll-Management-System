# IPMS Backend

Shared server-side utilities for the Smart Invoice & Payroll Management Platform: Supabase clients, API response helpers, and environment validation.

The Next.js UI and **live API routes** live in [`../frontend`](../frontend). All HTTP endpoints are implemented under `frontend/src/app/api/`.

The Supabase SQL schema lives at [`../supabase`](../supabase) (not inside this folder).

## Structure

```
backend/
  src/
    config/           # Environment validation
    lib/
      api/            # Standard API response helpers
      supabase/       # Supabase clients (admin + anon)
    types/            # Shared TypeScript types for API contracts
    index.ts          # Re-exports (library entry point)
```

## Frontend vs backend — what goes where

| Goes in **backend** (shared lib) | Implemented in **frontend** |
|----------------------------------|-----------------------------|
| Supabase client factories | Pages, layouts, UI components |
| Service-role Supabase access patterns | Browser Supabase client (`@supabase/ssr`) |
| Standard API response helpers | Next.js route handlers (`src/app/api/`) |
| Zod validation for API inputs | Form UX, client-side hints |
| RLS-aware data access patterns | `middleware.ts` (Next.js cookie session refresh) |
| Audit log writes to DB | Toast notifications, loading states |

**Note:** Next.js `middleware.ts` and cookie-based Supabase SSR client stay in `frontend/` because they depend on Next.js APIs (`cookies()`, edge runtime). They call the same Supabase project configured here.

## Setup

```bash
cd backend
cp .env.example .env
# Fill in Supabase credentials (same project as frontend)
npm install
npm run typecheck
```

Apply schema in Supabase SQL editor or CLI:

```bash
# File: ../supabase/schema.sql
# For existing databases, also run incremental migrations in ../supabase/
```

## API contract

All endpoints should return:

```json
{ "success": true, "data": { ... } }
```

or

```json
{ "success": false, "error": { "message": "...", "code": "..." } }
```

Use helpers in `src/lib/api/response.ts` and `src/lib/api/errors.ts`. The frontend duplicates these helpers at `frontend/src/lib/api/response.ts` for Next.js route handlers.
