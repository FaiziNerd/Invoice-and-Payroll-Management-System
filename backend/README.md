# IPMS Backend

Server-side code for the Smart Invoice & Payroll Management Platform: Supabase schema, API logic, validation, and business rules.

The Next.js UI lives in [`../frontend`](../frontend).

## Structure

```
backend/
  supabase/           # SQL schema & future migrations
  src/
    config/           # Environment validation
    lib/
      api/            # Standard API response helpers
      supabase/       # Supabase clients (admin + anon)
    routes/           # HTTP route handlers (added as we build)
    services/         # Business logic (invoice totals, payroll math, etc.)
    modules/          # Per-domain code (auth, invoices, payroll, …)
    types/            # Shared TypeScript types for API contracts
    index.ts          # Entry point
```

## Frontend vs backend — what goes where

| Goes in **backend** | Stays in **frontend** |
|---------------------|------------------------|
| Supabase schema & migrations | Pages, layouts, UI components |
| Service-role Supabase access | Browser Supabase client (`@supabase/ssr`) |
| Money math (invoice totals, payroll gross/net) | Display formatting, charts, PDF layout |
| Zod validation for API inputs | Form UX, client-side hints |
| RLS-aware data access patterns | `middleware.ts` (Next.js cookie session refresh) |
| Public share lookup by token (server) | Public invoice **view** component |
| Audit log writes to DB | Toast notifications, loading states |
| REST/route handler implementations | `mock-db/` until wired to API |

**Note:** Next.js `middleware.ts` and cookie-based Supabase SSR client stay in `frontend/` because they depend on Next.js APIs (`cookies()`, edge runtime). They call the same Supabase project configured here.

## Setup

```bash
cd backend
cp .env.example .env
# Fill in Supabase credentials (same project as frontend)
npm install
npm run dev
```

Apply schema in Supabase SQL editor or CLI:

```bash
# File: supabase/schema.sql
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

Use helpers in `src/lib/api/response.ts` and `src/lib/api/errors.ts`.
