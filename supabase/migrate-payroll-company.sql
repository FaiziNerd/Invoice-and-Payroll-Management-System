-- Payroll multi-company migration
-- Run in Supabase Dashboard → SQL Editor (after migrate-multi-company.sql).
-- Safe to re-run: uses IF NOT EXISTS / column-existence checks.
--
-- Fixes: "Could not find the 'company_id' column of 'payroll_runs' in the schema cache"

create extension if not exists "pgcrypto";

-- Default company (same id as migrate-multi-company.sql)
insert into public.companies (id, name, slug)
values ('00000000-0000-0000-0000-000000000001', 'Default Company', 'default')
on conflict (slug) do nothing;

-- ---------------------------------------------------------------------------
-- PAYROLL RUNS — create table or add company_id
-- ---------------------------------------------------------------------------
create table if not exists public.payroll_runs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  month integer not null check (month >= 1 and month <= 12),
  year integer not null check (year >= 2000),
  status text not null check (status in ('draft', 'processed', 'paid')) default 'draft',
  total_gross numeric not null default 0.0,
  total_net numeric not null default 0.0,
  processed_at timestamp with time zone,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique (company_id, month, year)
);

do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'payroll_runs'
      and column_name = 'company_id'
  ) then
    alter table public.payroll_runs
      add column company_id uuid references public.companies(id) on delete cascade;

    update public.payroll_runs
      set company_id = '00000000-0000-0000-0000-000000000001'
      where company_id is null;

    alter table public.payroll_runs alter column company_id set not null;
  end if;
end $$;

-- Replace legacy unique(month, year) with unique(company_id, month, year)
do $$
begin
  if exists (
    select 1 from pg_constraint
    where conname = 'payroll_runs_month_year_key'
  ) then
    alter table public.payroll_runs drop constraint payroll_runs_month_year_key;
  end if;
exception when undefined_object then
  null;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'payroll_runs_company_id_month_year_key'
  ) then
    alter table public.payroll_runs
      add constraint payroll_runs_company_id_month_year_key
      unique (company_id, month, year);
  end if;
exception when duplicate_object then
  null;
end $$;

alter table public.payroll_runs enable row level security;

-- ---------------------------------------------------------------------------
-- PAYROLL ENTRIES
-- ---------------------------------------------------------------------------
create table if not exists public.payroll_entries (
  id uuid primary key default gen_random_uuid(),
  payroll_run_id uuid not null references public.payroll_runs(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete restrict,
  base_salary numeric not null default 0.0,
  bonus numeric not null default 0.0,
  one_off_deduction numeric not null default 0.0,
  gross_pay numeric not null default 0.0,
  total_deductions numeric not null default 0.0,
  net_pay numeric not null default 0.0,
  allowances jsonb not null default '[]'::jsonb,
  deductions jsonb not null default '[]'::jsonb,
  unique (payroll_run_id, employee_id)
);

alter table public.payroll_entries enable row level security;

-- ---------------------------------------------------------------------------
-- SALARY SLIPS — create table or add company_id
-- ---------------------------------------------------------------------------
create table if not exists public.salary_slips (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  payroll_run_id uuid not null references public.payroll_runs(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete restrict,
  month integer not null,
  year integer not null,
  base_salary numeric not null default 0.0,
  bonus numeric not null default 0.0,
  one_off_deduction numeric not null default 0.0,
  gross_pay numeric not null default 0.0,
  total_deductions numeric not null default 0.0,
  net_pay numeric not null default 0.0,
  allowances jsonb not null default '[]'::jsonb,
  deductions jsonb not null default '[]'::jsonb,
  generated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique (payroll_run_id, employee_id)
);

do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'salary_slips'
      and column_name = 'company_id'
  ) then
    alter table public.salary_slips
      add column company_id uuid references public.companies(id) on delete cascade;

    update public.salary_slips ss
      set company_id = pr.company_id
      from public.payroll_runs pr
      where ss.payroll_run_id = pr.id
        and ss.company_id is null;

    update public.salary_slips
      set company_id = '00000000-0000-0000-0000-000000000001'
      where company_id is null;

    alter table public.salary_slips alter column company_id set not null;
  end if;
end $$;

alter table public.salary_slips enable row level security;

-- ---------------------------------------------------------------------------
-- HELPER (requires user_has_company / user_company_role from migrate-multi-company)
-- ---------------------------------------------------------------------------
create or replace function public.payroll_run_company_id(p_run_id uuid)
returns uuid
language sql stable security definer set search_path = public
as $$
  select company_id from public.payroll_runs where id = p_run_id;
$$;

-- ---------------------------------------------------------------------------
-- RLS POLICIES
-- ---------------------------------------------------------------------------
drop policy if exists "Members read company payroll runs" on public.payroll_runs;
drop policy if exists "Admins accountants HR write payroll runs" on public.payroll_runs;
drop policy if exists "Enable read access for all users" on public.payroll_runs;
drop policy if exists "Enable insert for authenticated users only" on public.payroll_runs;
drop policy if exists "Enable update for authenticated users only" on public.payroll_runs;
drop policy if exists "Enable delete for authenticated users only" on public.payroll_runs;

create policy "Members read company payroll runs"
  on public.payroll_runs for select to authenticated
  using (public.user_has_company(company_id));

create policy "Admins accountants HR write payroll runs"
  on public.payroll_runs for all to authenticated
  using (public.user_company_role(company_id) in ('admin', 'accountant', 'hr'))
  with check (public.user_company_role(company_id) in ('admin', 'accountant', 'hr'));

drop policy if exists "Members read payroll entries" on public.payroll_entries;
drop policy if exists "Admins accountants HR write payroll entries" on public.payroll_entries;

create policy "Members read payroll entries"
  on public.payroll_entries for select to authenticated
  using (public.user_has_company(public.payroll_run_company_id(payroll_run_id)));

create policy "Admins accountants HR write payroll entries"
  on public.payroll_entries for all to authenticated
  using (public.user_company_role(public.payroll_run_company_id(payroll_run_id)) in ('admin', 'accountant', 'hr'))
  with check (public.user_company_role(public.payroll_run_company_id(payroll_run_id)) in ('admin', 'accountant', 'hr'));

drop policy if exists "Members read company salary slips" on public.salary_slips;
drop policy if exists "Admins and HR modify salary slips" on public.salary_slips;

create policy "Members read company salary slips"
  on public.salary_slips for select to authenticated
  using (public.user_has_company(company_id));

create policy "Admins and HR modify salary slips"
  on public.salary_slips for all to authenticated
  using (public.user_company_role(company_id) in ('admin', 'hr'))
  with check (public.user_company_role(company_id) in ('admin', 'hr'));

-- Refresh PostgREST schema cache (Supabase picks this up within ~1 minute)
notify pgrst, 'reload schema';
