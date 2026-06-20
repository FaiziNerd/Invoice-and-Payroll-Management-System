-- Upgrade single-org Supabase project → multi-company schema.
-- Safe to re-run: uses IF NOT EXISTS / column-existence checks.
-- Run in Supabase Dashboard → SQL Editor before using company-scoped APIs.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- COMPANIES & MEMBERSHIP
-- ---------------------------------------------------------------------------
create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.companies enable row level security;

create table if not exists public.company_members (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('admin', 'accountant', 'hr')) default 'accountant',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique (company_id, user_id)
);

alter table public.company_members enable row level security;

-- Default company for existing rows
insert into public.companies (id, name, slug)
values ('00000000-0000-0000-0000-000000000001', 'Default Company', 'default')
on conflict (slug) do nothing;

-- ---------------------------------------------------------------------------
-- ADD company_id TO EXISTING TABLES (when missing)
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'clients' and column_name = 'company_id'
  ) then
    alter table public.clients
      add column company_id uuid references public.companies(id) on delete cascade;
    update public.clients
      set company_id = '00000000-0000-0000-0000-000000000001'
      where company_id is null;
    alter table public.clients alter column company_id set not null;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'invoices' and column_name = 'company_id'
  ) then
    alter table public.invoices
      add column company_id uuid references public.companies(id) on delete cascade;
    update public.invoices
      set company_id = '00000000-0000-0000-0000-000000000001'
      where company_id is null;
    alter table public.invoices alter column company_id set not null;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'invoice_templates' and column_name = 'company_id'
  ) then
    alter table public.invoice_templates
      add column company_id uuid references public.companies(id) on delete cascade;
    update public.invoice_templates
      set company_id = '00000000-0000-0000-0000-000000000001'
      where company_id is null;
    alter table public.invoice_templates alter column company_id set not null;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'departments' and column_name = 'company_id'
  ) then
    alter table public.departments
      add column company_id uuid references public.companies(id) on delete cascade;
    update public.departments
      set company_id = '00000000-0000-0000-0000-000000000001'
      where company_id is null;
    alter table public.departments alter column company_id set not null;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'employees' and column_name = 'company_id'
  ) then
    alter table public.employees
      add column company_id uuid references public.companies(id) on delete cascade;
    update public.employees
      set company_id = '00000000-0000-0000-0000-000000000001'
      where company_id is null;
    alter table public.employees alter column company_id set not null;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'audit_logs' and column_name = 'company_id'
  ) then
    alter table public.audit_logs
      add column company_id uuid references public.companies(id) on delete cascade;
    update public.audit_logs
      set company_id = '00000000-0000-0000-0000-000000000001'
      where company_id is null;
    alter table public.audit_logs alter column company_id set not null;
  end if;
end $$;

-- organization_settings: migrate from legacy single-row id PK → company_id PK
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'organization_settings' and column_name = 'id'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'organization_settings' and column_name = 'company_id'
  ) then
    alter table public.organization_settings rename column id to company_id;
    update public.organization_settings
      set company_id = '00000000-0000-0000-0000-000000000001'
      where company_id is null;
  elsif not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'organization_settings' and column_name = 'company_id'
  ) then
    alter table public.organization_settings
      add column company_id uuid references public.companies(id) on delete cascade;
    update public.organization_settings
      set company_id = '00000000-0000-0000-0000-000000000001'
      where company_id is null;
    alter table public.organization_settings alter column company_id set not null;
  end if;
end $$;

-- Backfill company_members for existing auth users → default company as admin
insert into public.company_members (company_id, user_id, role)
select '00000000-0000-0000-0000-000000000001', u.id, 'admin'
from auth.users u
where not exists (
  select 1 from public.company_members cm where cm.user_id = u.id
);

-- ---------------------------------------------------------------------------
-- HELPER FUNCTIONS
-- ---------------------------------------------------------------------------
create or replace function public.user_company_ids()
returns setof uuid
language sql stable security definer set search_path = public
as $$
  select company_id from public.company_members where user_id = auth.uid();
$$;

create or replace function public.user_has_company(p_company_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.company_members
    where user_id = auth.uid() and company_id = p_company_id
  );
$$;

create or replace function public.user_company_role(p_company_id uuid)
returns text
language sql stable security definer set search_path = public
as $$
  select role from public.company_members
  where user_id = auth.uid() and company_id = p_company_id limit 1;
$$;

create or replace function public.invoice_company_id(p_invoice_id uuid)
returns uuid
language sql stable security definer set search_path = public
as $$
  select company_id from public.invoices where id = p_invoice_id;
$$;

-- ---------------------------------------------------------------------------
-- RLS POLICIES (drop legacy permissive policies if present, add company-scoped)
-- ---------------------------------------------------------------------------
drop policy if exists "Members read company clients" on public.clients;
drop policy if exists "Admins and accountants modify clients" on public.clients;
drop policy if exists "Enable read access for all users" on public.clients;
drop policy if exists "Enable insert for authenticated users only" on public.clients;
drop policy if exists "Enable update for authenticated users only" on public.clients;
drop policy if exists "Enable delete for authenticated users only" on public.clients;

create policy "Members read company clients"
  on public.clients for select to authenticated
  using (public.user_has_company(company_id));

create policy "Admins and accountants modify clients"
  on public.clients for all to authenticated
  using (public.user_company_role(company_id) in ('admin', 'accountant'))
  with check (public.user_company_role(company_id) in ('admin', 'accountant'));

drop policy if exists "Members read company membership" on public.company_members;
create policy "Members read company membership"
  on public.company_members for select to authenticated
  using (company_id in (select public.user_company_ids()));

drop policy if exists "Authenticated users can read companies" on public.companies;
drop policy if exists "Members read own companies" on public.companies;
create policy "Members read own companies"
  on public.companies for select to authenticated
  using (id in (select public.user_company_ids()));

-- handle_new_user trigger (profiles on signup)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, name, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    new.email
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
