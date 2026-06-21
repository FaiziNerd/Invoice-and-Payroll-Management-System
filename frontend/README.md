# Invoice & Payroll Management System (IPMS)

A multi-company **Invoice & Payroll Management Platform** built with **Next.js 15**, **TypeScript**, **Tailwind CSS**, and **Supabase** (PostgreSQL + Auth). Business data lives in Supabase; the Next.js app exposes company-scoped REST API routes that enforce row-level security.

## Getting Started

### Prerequisites

- Node.js 18+
- npm
- A Supabase project (URL + anon/service keys)

### Installation

From the repository root:

```bash
cd frontend
npm install
cp .env.local.example .env.local   # set NEXT_PUBLIC_SUPABASE_URL, keys, etc.
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Apply `supabase/schema.sql` in the Supabase SQL Editor. Use `migrate-multi-company.sql` only when upgrading an older database.

### Email (invoice send)

Set in `.env.local` (see `.env.local.example`):

- `RESEND_API_KEY` — from [resend.com](https://resend.com)
- `RESEND_FROM_EMAIL` — e.g. `onboarding@resend.dev` on the free tier
- `NEXT_PUBLIC_APP_URL` — public app URL for share links in emails

Invoice send only writes history and updates status **after** Resend accepts the message. On failure, the UI shows an error and no false "sent" entry is recorded.

### Auth

- **`/signup`** — create a new company (admin account)
- **`/login`** — sign in with an existing Supabase-backed account
- **`/admin/users`** — admins invite team members with single-use codes

Roles: **admin**, **accountant**, **hr**.

### Demo seed (live presentation)

Re-run before every demo to reset a fully populated company:

```bash
cd frontend
npm run seed:demo
```

**Credentials after seed:**

| Field | Value |
|-------|-------|
| Email | `demo@ipms.app` |
| Password | `DemoIPMS2026!` |
| Company | Northstar Operations |

The script wipes the previous demo company by slug, then seeds clients, invoices (including 2+ overdue for the aging chart), employees, a paid payroll run with salary slips, templates/branding, and audit log entries. Requires `SUPABASE_SERVICE_ROLE_KEY` in `.env.local`.

---

## Demo Walkthrough

1. **Landing page** — Visit `/`, then **Get Started** or **Sign in**.
2. **Sign up / Login** — Create a company or sign in.
3. **Multi-company (Admin)** — Switch companies from the header dropdown. Data is scoped per company.
4. **Dashboard** — Revenue, payroll, outstanding invoices, aging chart, MoM KPI badges, smart summary card, and payment-reminder widget.
5. **Invoices** — Create, edit, send/resend emails, reminders, PDFs, and public share links + QR codes.
6. **Designer** — Customize invoice templates (classic / modern / minimal) with branding and live preview.
7. **Clients** — Manage client records (delete blocked when invoices exist).
8. **Employees & Departments** — HR workflows with salary structures.
9. **Payroll** — Monthly runs, reports, CSV export, salary slip PDFs.
10. **Admin** — Users, organization settings (company name/address for PDFs), audit log.
11. **Public share** — `/share/invoice/[token]` for client-facing invoice views.

---

## Routes

| Route | Access | Description |
|-------|--------|-------------|
| `/` | Public | Landing page |
| `/login`, `/signup` | Public | Authentication |
| `/dashboard` | Authenticated | Dashboard & analytics |
| `/invoices` | Admin, Accountant | Invoice list |
| `/invoices/new` | Admin, Accountant | Create invoice (+ quick draft suggestions) |
| `/invoices/[id]` | Admin, Accountant | Detail, PDF, email, share |
| `/invoices/[id]/edit` | Admin, Accountant | Edit invoice |
| `/clients` | Admin, Accountant | Client management |
| `/designer` | Admin, Accountant | Template list |
| `/designer/[templateId]` | Admin, Accountant | Template editor |
| `/designer/preview/[templateId]` | Admin, Accountant | Template preview |
| `/employees` | Admin, HR | Employee list |
| `/employees/new` | Admin, HR | Add employee |
| `/employees/[id]` | Admin, HR | Employee profile |
| `/employees/[id]/edit` | Admin, HR | Edit employee |
| `/employees/[id]/salary-history` | Admin, HR | Salary slip history + PDF |
| `/departments` | Admin, HR | Department management |
| `/payroll` | Admin, Accountant, HR | Payroll runs |
| `/payroll/run` | Admin, Accountant, HR | Create payroll run |
| `/payroll/[runId]` | Admin, Accountant, HR | Payroll run detail |
| `/payroll/reports` | Admin, Accountant, HR | Reports & charts |
| `/salary-slips` | Admin, HR | Salary slip list |
| `/salary-slips/[runId]` | Admin, HR | Bulk PDF ZIP |
| `/admin/users` | Admin | User management |
| `/admin/settings` | Admin | Organization settings |
| `/admin/activity` | Admin | Audit log |
| `/share/invoice/[token]` | Public | Shared invoice view |

---

## Architecture

```
Browser (Next.js App Router)
    │
    ├── Server Components / Client Components (dashboard UI)
    │
    └── /api/* route handlers  ──►  Supabase client (service role / user JWT)
                                        │
                                        └── PostgreSQL + RLS (company_id scoping)
```

- **Auth:** Supabase Auth with HTTP-only session cookies via `/api/auth/*`.
- **Data:** Repository facades in `src/lib/repositories/` call `/api/*` routes; an in-memory cache keeps the UI reactive between mutations.
- **Multi-company:** `company_id` on all business tables; admins switch active company via cookie + header dropdown.
- **PDFs:** Generated client-side with `@react-pdf/renderer`, branded from organization settings and invoice templates.

---

## Feature Checklist

### Core Platform

- [x] Public landing page
- [x] Supabase authentication with role-based access (Admin, Accountant, HR)
- [x] Protected dashboard layout with sidebar navigation
- [x] Dark mode toggle and mobile-responsive layout
- [x] Audit logging for key actions

### Invoice Module

- [x] Invoice CRUD with status workflow (draft → sent → paid / overdue)
- [x] Line items, tax calculation, invoice numbering
- [x] PDF download, public share links + QR codes
- [x] Email send / resend / payment reminders via Resend (share link in email)
- [x] Invoice history timeline
- [x] Quick draft suggestions (rule-based line-item helper on new invoice)

### Payroll & HR

- [x] Client, employee, and department management
- [x] Monthly payroll runs with bonus/deductions
- [x] Salary slip PDFs (individual + bulk ZIP)
- [x] Payroll reports with charts and CSV export
- [x] Delete guards when records are referenced

### Analytics & Dashboard

- [x] Smart summary card (rule-based billing highlights)
- [x] Month-over-month KPI badges
- [x] Department payroll breakdown chart
- [x] Invoice aging chart and dashboard CSV/ZIP export
- [x] AI payroll insights card (LLM with rule-based fallback)
- [x] Automated invoice email on draft → sent status change
- [x] Daily cron payment reminders (`/api/cron/invoice-reminders`)
- [x] Audit logging on HR, template, and salary-slip mutations

### Multi-Company

- [x] Company entity with per-user memberships
- [x] Company switcher in header (any user with 2+ companies)
- [x] Company-scoped data with RLS — no cross-company leakage

### Designer & Settings

- [x] Custom invoice templates (classic / modern / minimal)
- [x] Organization settings — company name/address on PDFs

---

## Tech Stack

- **Framework:** Next.js 15 (App Router) + TypeScript
- **Database & Auth:** Supabase (PostgreSQL + Auth + RLS)
- **UI:** Tailwind CSS + shadcn/ui
- **Charts:** Recharts
- **PDF:** @react-pdf/renderer
- **State:** TanStack Query + Zustand repository cache

## Project Structure

```
src/
  app/
    (auth)/                 # Login & signup
    (dashboard)/            # Protected app routes
    api/                    # REST routes → Supabase
    share/invoice/[token]   # Public invoice view
  components/
    layout/                 # Header, sidebar, company switcher
    invoices/               # Forms, quick-draft generator, PDF views
  lib/
    auth/                   # Session client
    repositories/           # API facades + cache
    analytics/              # Dashboard metrics & smart summary
    pdf/                    # PDF generation
  providers/                # Auth, theme, query
```

## Scripts

```bash
npm run dev      # Development server
npm run build    # Production build
npm run start    # Production server
npm run lint     # ESLint
npm run test:problem-statement  # Bonus feature integration tests
```

### Bonus features (email & cron)

- **Auto-send:** Marking an invoice `sent` from `draft` triggers email delivery when Resend is configured (`RESEND_API_KEY`, `RESEND_FROM_EMAIL`).
- **Cron reminders:** Set `CRON_SECRET` in `.env.local` (and Vercel env). Vercel runs `/api/cron/invoice-reminders` daily at 09:00 UTC via `vercel.json`.
- **Local cron test:** `curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/invoice-reminders`
- **Payroll insights:** Optional AI keys (xAI/Groq/OpenAI/Anthropic) power the dashboard Payroll Insights card; falls back to rules without keys.

## Notes

New companies receive three default invoice templates on signup. Organization name and address from **Admin → Settings** appear on invoice and salary-slip PDFs when set.
