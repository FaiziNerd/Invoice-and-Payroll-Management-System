# Invoice & Payroll Management System

Monorepo layout:

| Folder | Purpose |
|--------|---------|
| [`frontend/`](./frontend) | Next.js UI (App Router) |
| [`backend/`](./backend) | Supabase schema, API logic, server-side business rules |

## Quick start

**Frontend (demo UI):**

```bash
cd frontend
npm install
npm run dev
```

**Backend (schema & future API):**

```bash
cd backend
cp .env.example .env
npm install
npm run dev
```

See [frontend/README.md](./frontend/README.md) for demo credentials and feature checklist.  
See [backend/README.md](./backend/README.md) for what belongs in backend vs frontend.
