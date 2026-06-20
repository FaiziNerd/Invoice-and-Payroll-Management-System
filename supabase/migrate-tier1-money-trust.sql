-- Tier 1: Money & Trust migration
-- Run after schema.sql and prior migrations.
-- Standardizes invoice numbers to INV-NNNN (4-digit sequential per company).

-- ---------------------------------------------------------------------------
-- INVOICE NUMBER SEQUENCES (gap-free, row-locked)
-- ---------------------------------------------------------------------------
create table if not exists public.invoice_number_sequences (
  company_id uuid primary key references public.companies(id) on delete cascade,
  last_number integer not null default 0 check (last_number >= 0)
);

create or replace function public.next_invoice_number(p_company_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_next integer;
begin
  insert into public.invoice_number_sequences (company_id, last_number)
  values (p_company_id, 0)
  on conflict (company_id) do nothing;

  update public.invoice_number_sequences
  set last_number = last_number + 1
  where company_id = p_company_id
  returning last_number into v_next;

  return 'INV-' || lpad(v_next::text, 4, '0');
end;
$$;

-- Legacy DBs may have a global unique on invoice_number (pre multi-company).
-- Numbers must be unique per company, not globally.
alter table public.invoices drop constraint if exists invoices_invoice_number_key;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.invoices'::regclass
      and contype = 'u'
      and pg_get_constraintdef(oid) like '%company_id%invoice_number%'
  ) then
    alter table public.invoices
      add constraint invoices_company_id_invoice_number_key
      unique (company_id, invoice_number);
  end if;
end $$;

-- Seed sequences from existing INV-NNNN invoices
insert into public.invoice_number_sequences (company_id, last_number)
select company_id, coalesce(max(
  case
    when invoice_number ~ '^INV-[0-9]{4}$' then substring(invoice_number from 5)::integer
    else 0
  end
), 0)
from public.invoices
group by company_id
on conflict (company_id) do update
set last_number = greatest(
  public.invoice_number_sequences.last_number,
  excluded.last_number
);

-- Normalize legacy numbers (e.g. INV-2026-001) without colliding with existing INV-NNNN.
-- Phase 1: move legacy rows to temporary unique values.
update public.invoices
set invoice_number = '_MIG_' || replace(id::text, '-', '')
where invoice_number !~ '^INV-[0-9]{4}$'
  and invoice_number not like '_MIG_%';

-- Phase 2: assign sequential numbers after each company's current max.
with legacy as (
  select
    id,
    company_id,
    row_number() over (partition by company_id order by created_at, id) as rn
  from public.invoices
  where invoice_number like '_MIG_%'
),
maxes as (
  select
    company_id,
    coalesce(max(
      case
        when invoice_number ~ '^INV-[0-9]{4}$'
          then substring(invoice_number from 5)::integer
        else 0
      end
    ), 0) as max_num
  from public.invoices
  where invoice_number not like '_MIG_%'
  group by company_id
)
update public.invoices i
set invoice_number = 'INV-' || lpad((m.max_num + l.rn)::text, 4, '0')
from legacy l
join maxes m on m.company_id = l.company_id
where i.id = l.id;

-- Re-sync sequences after renumbering
insert into public.invoice_number_sequences (company_id, last_number)
select company_id, max(substring(invoice_number from 5)::integer)
from public.invoices
where invoice_number ~ '^INV-[0-9]{4}$'
group by company_id
on conflict (company_id) do update
set last_number = greatest(
  public.invoice_number_sequences.last_number,
  excluded.last_number
);

-- ---------------------------------------------------------------------------
-- ORG TAX CONFIGURATION (single primary rule per company; extendable to multi-tax)
-- ---------------------------------------------------------------------------
create table if not exists public.org_tax_configs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null default 'Sales Tax',
  rate numeric not null default 0 check (rate >= 0),
  is_inclusive boolean not null default false,
  is_active boolean not null default true,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create unique index if not exists org_tax_configs_company_unique
  on public.org_tax_configs (company_id);

alter table public.org_tax_configs enable row level security;

create policy "Members read org tax configs"
  on public.org_tax_configs for select to authenticated
  using (public.user_has_company(company_id));

create policy "Admins accountants manage org tax configs"
  on public.org_tax_configs for all to authenticated
  using (public.user_company_role(company_id) in ('admin', 'accountant'))
  with check (public.user_company_role(company_id) in ('admin', 'accountant'));

-- Seed default 10% exclusive tax from existing invoice defaults
insert into public.org_tax_configs (company_id, name, rate, is_inclusive, is_active)
select c.id, 'Sales Tax', 10.0, false, true
from public.companies c
where not exists (
  select 1 from public.org_tax_configs t where t.company_id = c.id
);

-- ---------------------------------------------------------------------------
-- INVOICES: payments tracking, partial pay, void
-- ---------------------------------------------------------------------------
alter table public.invoices
  add column if not exists amount_paid numeric not null default 0,
  add column if not exists payment_variance text not null default 'none'
    check (payment_variance in ('none', 'overpayment')),
  add column if not exists void_reason text,
  add column if not exists voided_at timestamp with time zone;

-- Expand status constraint
alter table public.invoices drop constraint if exists invoices_status_check;
alter table public.invoices add constraint invoices_status_check
  check (status in ('draft', 'sent', 'partially_paid', 'paid', 'overdue', 'void'));

-- ---------------------------------------------------------------------------
-- PAYMENTS
-- ---------------------------------------------------------------------------
create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  invoice_id uuid not null references public.invoices(id) on delete restrict,
  amount numeric not null check (amount > 0),
  method text not null check (method in ('bank_transfer', 'cash', 'gateway')),
  reference_number text,
  payment_date timestamp with time zone not null,
  recorded_by uuid not null references public.profiles(id) on delete restrict,
  proof_url text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create index if not exists payments_invoice_id_idx on public.payments (invoice_id);
create index if not exists payments_company_id_idx on public.payments (company_id);

alter table public.payments enable row level security;

create policy "Members read company payments"
  on public.payments for select to authenticated
  using (public.user_has_company(company_id));

create policy "Admins accountants record payments"
  on public.payments for insert to authenticated
  with check (public.user_company_role(company_id) in ('admin', 'accountant'));

-- ---------------------------------------------------------------------------
-- AI DRAFT RATE LIMITING
-- ---------------------------------------------------------------------------
create table if not exists public.ai_draft_usage (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  used_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create index if not exists ai_draft_usage_company_time_idx
  on public.ai_draft_usage (company_id, used_at desc);

alter table public.ai_draft_usage enable row level security;

create policy "Members append ai draft usage"
  on public.ai_draft_usage for insert to authenticated
  with check (public.user_has_company(company_id));

-- ---------------------------------------------------------------------------
-- PAYROLL COMPLIANCE SCHEMA (data model only — calculation wired separately)
-- ---------------------------------------------------------------------------

-- Configurable income-tax slab brackets (jurisdiction-agnostic)
create table if not exists public.tax_slabs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  jurisdiction_code text not null default 'PK',
  tax_year integer not null,
  min_annual_income numeric not null default 0,
  max_annual_income numeric,
  rate_percent numeric not null check (rate_percent >= 0),
  fixed_amount numeric not null default 0,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create index if not exists tax_slabs_company_year_idx
  on public.tax_slabs (company_id, tax_year, sort_order);

alter table public.tax_slabs enable row level security;

create policy "Members read tax slabs"
  on public.tax_slabs for select to authenticated
  using (public.user_has_company(company_id));

create policy "Admins HR manage tax slabs"
  on public.tax_slabs for all to authenticated
  using (public.user_company_role(company_id) in ('admin', 'hr'))
  with check (public.user_company_role(company_id) in ('admin', 'hr'));

-- Statutory deductions (EOBI, social security, etc.)
create table if not exists public.statutory_deduction_configs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  code text not null,
  name text not null,
  employee_rate_percent numeric not null default 0,
  employer_rate_percent numeric not null default 0,
  employee_fixed_amount numeric not null default 0,
  employer_fixed_amount numeric not null default 0,
  applies_to_gross boolean not null default true,
  is_active boolean not null default true,
  effective_from date not null default current_date,
  effective_to date,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique (company_id, code)
);

alter table public.statutory_deduction_configs enable row level security;

create policy "Members read statutory deductions"
  on public.statutory_deduction_configs for select to authenticated
  using (public.user_has_company(company_id));

create policy "Admins HR manage statutory deductions"
  on public.statutory_deduction_configs for all to authenticated
  using (public.user_company_role(company_id) in ('admin', 'hr'))
  with check (public.user_company_role(company_id) in ('admin', 'hr'));

-- Overtime configuration per company
create table if not exists public.overtime_configs (
  company_id uuid primary key references public.companies(id) on delete cascade,
  hourly_multiplier numeric not null default 1.5 check (hourly_multiplier > 0),
  daily_multiplier numeric not null default 2.0 check (daily_multiplier > 0),
  standard_hours_per_day numeric not null default 8,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.overtime_configs enable row level security;

create policy "Members read overtime config"
  on public.overtime_configs for select to authenticated
  using (public.user_has_company(company_id));

create policy "Admins HR manage overtime config"
  on public.overtime_configs for all to authenticated
  using (public.user_company_role(company_id) in ('admin', 'hr'))
  with check (public.user_company_role(company_id) in ('admin', 'hr'));

-- Overtime hours per employee per payroll period
create table if not exists public.payroll_overtime_entries (
  id uuid primary key default gen_random_uuid(),
  payroll_run_id uuid not null references public.payroll_runs(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete restrict,
  overtime_hours numeric not null default 0 check (overtime_hours >= 0),
  overtime_type text not null default 'hourly' check (overtime_type in ('hourly', 'daily')),
  notes text,
  unique (payroll_run_id, employee_id)
);

alter table public.payroll_overtime_entries enable row level security;

create policy "Members read payroll overtime"
  on public.payroll_overtime_entries for select to authenticated
  using (public.user_has_company(public.payroll_run_company_id(payroll_run_id)));

create policy "Admins HR write payroll overtime"
  on public.payroll_overtime_entries for all to authenticated
  using (public.user_company_role(public.payroll_run_company_id(payroll_run_id)) in ('admin', 'hr'))
  with check (public.user_company_role(public.payroll_run_company_id(payroll_run_id)) in ('admin', 'hr'));

-- Pro-rating: unpaid leave / partial month days
create table if not exists public.payroll_attendance_adjustments (
  id uuid primary key default gen_random_uuid(),
  payroll_run_id uuid not null references public.payroll_runs(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete restrict,
  days_in_period integer not null check (days_in_period > 0),
  days_worked numeric not null check (days_worked >= 0),
  unpaid_leave_days numeric not null default 0 check (unpaid_leave_days >= 0),
  notes text,
  unique (payroll_run_id, employee_id)
);

alter table public.payroll_attendance_adjustments enable row level security;

create policy "Members read payroll attendance"
  on public.payroll_attendance_adjustments for select to authenticated
  using (public.user_has_company(public.payroll_run_company_id(payroll_run_id)));

create policy "Admins HR write payroll attendance"
  on public.payroll_attendance_adjustments for all to authenticated
  using (public.user_company_role(public.payroll_run_company_id(payroll_run_id)) in ('admin', 'hr'))
  with check (public.user_company_role(public.payroll_run_company_id(payroll_run_id)) in ('admin', 'hr'));

-- ---------------------------------------------------------------------------
-- AUDIT LOGS: insert-only, expanded actions
-- ---------------------------------------------------------------------------
alter table public.audit_logs drop constraint if exists audit_logs_action_check;
alter table public.audit_logs add constraint audit_logs_action_check
  check (action in (
    'create', 'update', 'delete', 'login', 'logout', 'send', 'process',
    'export', 'status_change', 'void', 'payment'
  ));

-- Revoke mutation on audit_logs from application roles (insert + select only)
revoke update, delete on public.audit_logs from authenticated;
revoke update, delete on public.audit_logs from anon;
