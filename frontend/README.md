# Invoice & Payroll Management System

A multi-company **Invoice & Payroll Management Platform** built with Next.js 15, TypeScript, Tailwind CSS, and **Supabase** (PostgreSQL + Auth). Business data is stored in Supabase; the frontend uses repository facades that call REST API routes with company-scoped RLS.

## Getting Started

### Prerequisites

- Node.js 18+
- npm

### Installation

From the repository root:

```bash
cd frontend
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Environment

Copy `.env.local.example` to `.env.local` and set your Supabase project URL and keys. Apply `supabase/schema.sql` (and `migrate-multi-company.sql` only if upgrading an older database) in the Supabase SQL Editor.

### Auth

Use `/signup` to create a company (admin) or `/login` for existing users. Admins can invite users at `/admin/users`. Roles: **admin**, **accountant**, **hr**.

---

## Demo Walkthrough

1. **Landing page** — Visit `/` for the public marketing page, then click **Get Started** or **Sign in**.
2. **Sign up / Login** — Create a company or sign in with your Supabase-backed account.
3. **Multi-company (Admin)** — Use the company dropdown in the header to switch companies. Invoices, clients, employees, payroll, and settings are scoped per company.
4. **Dashboard** — Review revenue, payroll, outstanding invoices, aging chart, MoM KPI badges, AI insights card, and payment-reminder widget.
5. **Invoices** — Create, edit, send/resend emails, send payment reminders, download PDFs, and share via public link + QR code.
6. **Designer** — Customize invoice templates (classic / modern / minimal themes) with branding colors and live preview.
7. **Clients** — Manage client records (delete blocked when invoices exist).
8. **Employees & Departments** — HR workflows with salary structures; delete guards when referenced in payroll.
9. **Payroll** — Run monthly payroll, view reports, export CSV, generate salary slip PDFs.
10. **Admin** — Manage users, organization settings (company name/address for PDFs), and audit activity log.
11. **Public share** — Open `/share/invoice/[token]` from an invoice detail page to preview the client-facing view.

---

## Routes

| Route | Access | Description |
|-------|--------|-------------|
| `/` | Public | Landing page |
| `/login` | Public | Demo login |
| `/dashboard` | Authenticated | Main dashboard & analytics |
| `/invoices` | Admin, Accountant | Invoice list |
| `/invoices/new` | Admin, Accountant | Create invoice (+ AI mock generator) |
| `/invoices/[id]` | Admin, Accountant | Invoice detail, PDF, email, share |
| `/invoices/[id]/edit` | Admin, Accountant | Edit invoice |
| `/clients` | Admin, Accountant | Client management |
| `/designer` | Admin, Accountant | Invoice template list |
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
| `/payroll/reports` | Admin, Accountant, HR | Payroll reports & charts |
| `/salary-slips` | Admin, HR | Salary slip list |
| `/salary-slips/[runId]` | Admin, HR | Slips for a run (bulk PDF ZIP) |
| `/admin/users` | Admin | User management |
| `/admin/settings` | Admin | Organization settings |
| `/admin/activity` | Admin | Audit log |
| `/share/invoice/[token]` | Public | Shared invoice view |

---

## Feature Checklist

### Phase A — Core Platform

- [x] Public landing page at `/`
- [x] Demo authentication with role-based access (Admin, Accountant, HR)
- [x] Protected dashboard layout with sidebar navigation
- [x] Dark mode toggle
- [x] Mobile-responsive layout
- [x] `localStorage` mock DB with seed data on first load
- [x] Audit logging for key actions

### Phase B — Invoice Module

- [x] Invoice CRUD with status workflow (draft → sent → paid / overdue)
- [x] Line items, tax calculation, invoice numbering
- [x] PDF download
- [x] Public share links + QR codes
- [x] Mock email send on draft invoices
- [x] Invoice history timeline

### Phase C — Payroll & HR Module

- [x] Client management
- [x] Employee profiles with salary structures
- [x] Department management
- [x] Monthly payroll runs with bonus/deductions
- [x] Salary slip PDF generation (individual + bulk ZIP)
- [x] Payroll reports with charts and CSV export
- [x] Employee salary history page

### Phase D — UX Polish

- [x] Delete guards (client with invoices, department with employees, employee in payroll)
- [x] Shared `EmptyState` component on list and not-found views
- [x] Salary slip PDF branding from template primary color
- [x] `salary_slip` entity filter on Activity page

### Phase E — Bonus Mocks (Email & Reminders)

- [x] Payment reminders for sent/overdue invoices (mock)
- [x] Dashboard widget for invoices needing reminders
- [x] Resend invoice email for sent/overdue
- [x] Email preview dialog with recipient, subject, body template
- [x] Distinct history actions: sent, resent, reminder_sent

### Phase F — Bonus Mocks (AI & Analytics)

- [x] AI Invoice Generator on new invoice page (rule-based mock, no API)
- [x] AI Payroll Insights card on dashboard
- [x] Month-over-month % on revenue, outstanding, payroll, and net margin KPIs
- [x] Department payroll breakdown chart on dashboard
- [x] Net margin trend (admin/accountant)
- [x] Extended dashboard ZIP export (aging, analytics CSVs)

### Phase G — Multi-Company

- [x] `Company` entity with two seeded companies (DotCode Solutions, Acme Holdings)
- [x] Company switcher in header (Admin only)
- [x] Company-scoped storage for invoices, clients, employees, departments, payroll, settings, templates, audit logs
- [x] Switching companies reloads scoped data without cross-company leakage

### Phase H — Documentation

- [x] README with feature checklist, demo walkthrough, routes, and credentials

### Additional Features

- [x] Custom Invoice Designer — branded templates (classic / modern / minimal)
- [x] Organization settings — company name/address in PDFs
- [x] Invoice aging chart on dashboard
- [x] Dashboard CSV/ZIP export
- [x] `useStorageData` hook for reactive localStorage reads

---

## Tech Stack

- **Framework:** Next.js 15 (App Router) + TypeScript
- **UI:** Tailwind CSS + shadcn/ui
- **Charts:** Recharts
- **PDF:** @react-pdf/renderer
- **QR:** qrcode.react
- **Theming:** next-themes

## Project Structure

```
src/
  app/
    (auth)/login/           # Public login & signup
    (dashboard)/            # Protected app routes
    api/                    # REST routes → Supabase (company-scoped)
    share/invoice/[token]   # Public invoice view
  components/
    layout/                 # Header, sidebar, company switcher
    shared/                 # EmptyState, PageHeader, etc.
  data/seed.ts              # Legacy stub (no demo seed on login)
  hooks/use-storage-data.ts # Reactive data hook (DATA_CHANGE_EVENT)
  lib/
    auth/client.ts          # Session client
    company/context.ts      # Active company id (localStorage)
    repositories/           # API facades + in-memory cache
    api/                    # Shared fetch helpers, Zod schemas
  lib/pdf/                  # PDF generation
  providers/                # Auth, theme, query providers
  types/                    # TypeScript interfaces
```

## Scripts

```bash
npm run dev      # Start development server
npm run build    # Production build
npm run start    # Start production server
npm run lint     # Run ESLint
```

## Notes

Data persists in **Supabase**. On login, the auth provider preloads company data via `/api/*` routes. Row-level security enforces company isolation. New companies receive three default invoice templates on signup; existing companies may need templates seeded manually if the table is empty.
