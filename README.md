# Invoice & Payroll Management System (IPMS)

Monorepo layout:

| Folder | Purpose |
|--------|---------|
| [`frontend/`](./frontend) | Next.js 15 UI (App Router) + `/api/*` route handlers |
| [`backend/`](./backend) | Supabase schema, migrations, and server-side reference |

## Quick start

**Frontend (app + API routes):**

```bash
cd frontend
cp .env.local.example .env.local   # Supabase URL and keys
npm install
npm run dev
```

**Database schema:**

```bash
cd backend
cp .env.example .env
# Apply supabase/schema.sql in the Supabase SQL Editor
```

See [frontend/README.md](./frontend/README.md) for routes, architecture, and feature checklist.  
See [backend/README.md](./backend/README.md) for schema and migration notes.

## Architecture

The live product uses **Supabase** for PostgreSQL storage and authentication. The Next.js frontend calls its own **`/api/*` routes**, which use the Supabase service role and enforce **company-scoped row-level security**. There is no localStorage-only demo database or seeded third-party company data.
