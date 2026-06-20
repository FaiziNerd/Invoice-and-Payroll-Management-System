# Remaining Features — Invoice & Payroll Management System

This document tracks **outstanding work** for the frontend-only IPMS demo app. All items below are scoped to the `frontend/` directory unless noted otherwise.

**Project path:** `frontend/`  
**Data layer:** `localStorage` mock services (no real backend, AI, or SMTP)

---

## Progress Overview

| Status | Count | Items |
|--------|------:|-------|
| **Completed** | 7 | Landing page, payroll seed, storage hook, org settings, aging chart, salary PDF, theme layouts |
| **Remaining** | 9 | Phase D (4), Phase E (2), Phase F (2), Phase G (1), Phase H (1) |

---

## Completed (Do Not Rebuild)

| # | Feature | Route / Notes |
|---|---------|---------------|
| 1 | Public landing page + routing | `/` landing, `/dashboard` app home |
| 2 | Demo payroll seed | `frontend/src/data/seed.ts` — 3 runs + salary slips |
| 3 | `useStorageData` hook | `frontend/src/hooks/use-storage-data.ts` |
| 4 | Organization settings | `/admin/settings` — company name/address in PDFs |
| 5 | Invoice aging chart | Dashboard buckets + `invoice-aging.csv` in ZIP export |
| 6 | Salary history PDF | Employee profile + salary history pages |
| 7 | Distinct theme layouts | `classic` / `modern` / `minimal` in preview, PDF, share |

---

## Remaining Features

### Phase D — UX Polish

#### D1. Delete Guards

| | |
|---|---|
| **Phase** | D |
| **Description** | Block destructive deletes when related records exist: client with invoices, department with employees, employee referenced in payroll runs. Show a clear toast or dialog explaining why delete is blocked. |
| **Key files** | `frontend/src/lib/mock-db/clients.ts`, `departments.ts`, `employees.ts`, `invoices.ts`, `payroll.ts`; UI in `clients/page.tsx`, `departments/page.tsx`, `employees/[id]/edit/page.tsx` |
| **Acceptance criteria** | Deleting a client with ≥1 invoice fails with user-visible message; deleting a department with ≥1 employee fails; deleting an employee in any payroll run fails; unrelated records still delete normally; audit log records blocked attempts (optional) or successful deletes unchanged |

---

#### D2. Empty States

| | |
|---|---|
| **Phase** | D |
| **Description** | Replace remaining plain-text empty and not-found UI with the shared `EmptyState` component for consistent UX. |
| **Key files** | `frontend/src/components/shared/empty-state.tsx`; pages still using plain text: `invoices/page.tsx`, `share/invoice/[token]/page.tsx`, `salary-slips/[runId]/page.tsx`, `payroll/reports/page.tsx`, `invoices/[id]/page.tsx` (if applicable) |
| **Acceptance criteria** | All list empty states and not-found views use `EmptyState` with icon, title, description, and action link where appropriate; no bare `<p>No … found</p>` on primary pages |

---

#### D3. Slip Branding

| | |
|---|---|
| **Phase** | D |
| **Description** | Apply the default (or selected) invoice template `primaryColor` to salary slip PDF header, table header, and accent styles instead of hardcoded `#2563eb`. |
| **Key files** | `frontend/src/lib/pdf/salary-slip-pdf.tsx`, `frontend/src/lib/mock-db/templates.ts` |
| **Acceptance criteria** | Salary slip PDF reflects template primary color; company name still comes from org settings; bulk ZIP download uses same branding |

---

#### D4. Audit Filter — Salary Slip

| | |
|---|---|
| **Phase** | D |
| **Description** | Add `salary_slip` as a filterable entity on the admin Activity page alongside existing entity types. |
| **Key files** | `frontend/src/app/(dashboard)/admin/activity/page.tsx`, `frontend/src/types/index.ts` (if entity union needs update), `frontend/src/lib/audit/index.ts` |
| **Acceptance criteria** | Activity filter dropdown includes “Salary Slip”; filtering shows slip generation audit entries; “All entities” still works |

---

### Phase E — Bonus Mocks (Email & Reminders)

#### E1. Payment Reminders (Mock)

| | |
|---|---|
| **Phase** | E |
| **Description** | “Send Reminder” on `sent` and `overdue` invoices: confirm dialog → toast → audit log → invoice history entry. Dashboard widget listing invoices overdue > 7 days. |
| **Key files** | `frontend/src/app/(dashboard)/invoices/[id]/page.tsx`, `frontend/src/app/(dashboard)/dashboard/page.tsx`, `frontend/src/lib/mock-db/invoices.ts`, `frontend/src/lib/audit/index.ts` |
| **Acceptance criteria** | Reminder button visible only for sent/overdue; action creates history entry `reminder_sent`; audit log recorded; dashboard widget shows overdue > 7 days with link to invoice; draft/paid invoices have no reminder action |

---

#### E2. Enhanced Email (Mock)

| | |
|---|---|
| **Phase** | E |
| **Description** | Resend invoice email for `sent` and `overdue` (not only `draft`). Email preview dialog: recipient, subject, body template. Distinct history actions: `sent`, `resent`, `reminder_sent`. |
| **Key files** | `frontend/src/app/(dashboard)/invoices/[id]/page.tsx`, `frontend/src/lib/mock-db/invoices.ts` |
| **Acceptance criteria** | Resend available on sent/overdue; preview dialog shows realistic template before confirm; history distinguishes first send vs resend; no real email sent (mock only) |

---

### Phase F — Bonus Mocks (AI & Analytics)

#### F1. AI Mock Features

| | |
|---|---|
| **Phase** | F |
| **Description** | **AI Invoice Generator** on new invoice page: dialog with client + description → rule-based line item pre-fill (no external API). **AI Payroll Insights** card on dashboard: computed insights from seed data (e.g. payroll up X% vs last month, N invoices overdue 30+ days). |
| **Key files** | `frontend/src/app/(dashboard)/invoices/new/page.tsx`, `frontend/src/app/(dashboard)/dashboard/page.tsx`; optional helper `frontend/src/lib/ai/mock-insights.ts` |
| **Acceptance criteria** | Generator dialog pre-fills line items from simple rules; insights card shows 2–4 dynamic bullets from real localStorage data; labeled as demo/AI mock; no network calls |

---

#### F2. Advanced Analytics

| | |
|---|---|
| **Phase** | F |
| **Description** | Month-over-month % on revenue and payroll summary cards; department payroll breakdown chart on main dashboard (reuse payroll reports logic); net margin trend line (admin/accountant only); include new datasets in dashboard ZIP export. |
| **Key files** | `frontend/src/app/(dashboard)/dashboard/page.tsx`, `frontend/src/app/(dashboard)/payroll/reports/page.tsx` |
| **Acceptance criteria** | MoM % shown on KPI cards when prior-month data exists; dept breakdown chart on dashboard for eligible roles; net margin trend visible to admin/accountant; ZIP export includes new CSV files |

---

### Phase G — Multi-Company

#### G1. Multi-Company Switcher

| | |
|---|---|
| **Phase** | G |
| **Description** | Lightweight multi-company support: `Company` entity with 2 seeded companies; switcher in header (Admin only); scope data via `companyId` on entities or prefixed storage keys; switching reloads scoped data. |
| **Key files** | `frontend/src/data/seed.ts`, `frontend/src/lib/mock-db/storage.ts`, `frontend/src/components/layout/header.tsx`, `frontend/src/types/index.ts`, mock-db modules |
| **Acceptance criteria** | Two companies seeded; admin sees switcher; switching changes invoices/clients/employees visible data; other roles unaffected; no data leak across companies |

---

### Phase H — Documentation

#### H1. README Update

| | |
|---|---|
| **Phase** | H |
| **Description** | Update `frontend/README.md` with full feature checklist (completed + bonus), demo walkthrough, all routes, demo credentials, and correct install path (`cd frontend`). |
| **Key files** | `frontend/README.md`, optionally root `README.md` |
| **Acceptance criteria** | README lists all 7 modules + bonus features; routes table includes `/`, `/dashboard`, `/admin/settings`; install steps use `frontend/` folder; demo accounts documented; feature checklist matches app behavior |

---

## Suggested Execution Order

| Order | Phase | Features | Est. effort |
|------:|-------|----------|-------------|
| 1 | **D** | Delete guards → Empty states → Slip branding → Audit filter | ~0.5 day |
| 2 | **E** | Payment reminders → Enhanced email | ~0.5 day |
| 3 | **F** | AI mock → Advanced analytics | ~1 day |
| 4 | **G** | Multi-company switcher | ~1 day |
| 5 | **H** | README update | ~0.25 day |

**Total remaining estimate:** ~3–4 days

---

## Definition of Done (Full Project)

- [ ] Public landing at `/`; authenticated dashboard at `/dashboard`
- [ ] All missing required / partial spec items implemented
- [ ] All problem-statement bonus features implemented (mocked where noted)
- [ ] Fresh seed produces full demo without manual setup
- [ ] README documents routes, features, and demo credentials
- [ ] `npm run build` and `npm run lint` pass from `frontend/`

### Explicitly Out of Scope

- Real backend, database, or server auth
- Real AI API integration
- Real SMTP / email delivery

---

## Quick Reference — Key Paths

```
frontend/
├── src/
│   ├── app/                    # Next.js routes
│   ├── components/             # UI + shared EmptyState
│   ├── data/seed.ts            # Demo seed data
│   ├── hooks/use-storage-data.ts
│   └── lib/mock-db/            # localStorage services
├── package.json
└── README.md                   # To update in Phase H
```

**Run locally:**

```bash
cd frontend
npm install
npm run dev
```

**Demo login:** `admin@dotcode.com` / `admin123`
