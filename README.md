# Invoice & Payroll Management System

A frontend-only **Invoice & Payroll Management Platform** built with Next.js 15, TypeScript, and Tailwind CSS. All data is stored in `localStorage` with a mock service layer — no backend required.

## Features

### Core Modules
- **User & Access Management** — Demo login, role-based access (Admin, Accountant, HR), audit logs
- **Invoice Management** — CRUD, status workflow, PDF download, share links, QR codes, email mock
- **Custom Invoice Designer** — Branded templates with logo, colors, fonts, live preview
- **Employee Management** — Profiles, departments, salary structures
- **Payroll Management** — Monthly runs, calculations, bonus/deductions, reports, CSV export
- **Salary Slip Generation** — PDF slips per employee, bulk download
- **Dashboard & Reporting** — Revenue charts, invoice analytics, payroll trends, outstanding payments

### Bonus Features
- Dark mode toggle
- Mobile responsive layout
- CSV export (payroll, dashboard)
- QR code invoice sharing
- Audit logs & activity tracking
- Mock email delivery

## Getting Started

### Prerequisites
- Node.js 18+
- npm

### Installation

```bash
cd Invoice-and-Payroll-Management-System
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Demo Accounts

| Role       | Email                    | Password  |
|------------|--------------------------|-----------|
| Admin      | admin@dotcode.com        | admin123  |
| Accountant | accountant@dotcode.com   | acc123    |
| HR         | hr@dotcode.com           | hr123     |

## Tech Stack

- **Framework:** Next.js 15 (App Router) + TypeScript
- **UI:** Tailwind CSS + shadcn/ui components
- **State:** Zustand-ready mock layer + TanStack Query
- **Charts:** Recharts
- **PDF:** @react-pdf/renderer
- **QR:** qrcode.react
- **Theming:** next-themes

## Project Structure

```
src/
  app/
    (auth)/login/          # Public login
    (dashboard)/           # Protected app routes
    share/invoice/[token]  # Public invoice view
  components/              # UI, layout, auth components
  lib/mock-db/             # localStorage CRUD repositories
  lib/pdf/                 # PDF generation
  providers/               # Auth, theme, query providers
  types/                   # TypeScript interfaces
  data/seed.ts             # Demo data initializer
```

## Scripts

```bash
npm run dev      # Start development server
npm run build    # Production build
npm run start    # Start production server
npm run lint     # Run ESLint
```

## Notes

This is a **frontend-only** prototype. Data persists in browser `localStorage` and resets if you clear site data. Designed for demo and UI/UX validation before connecting a real backend.
