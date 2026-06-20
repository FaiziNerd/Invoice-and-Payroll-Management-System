-- Company invite tokens (single-use signup codes)
-- Run in Supabase SQL Editor. Safe to re-run.

create table if not exists public.company_invites (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  token text not null unique,
  role text not null check (role in ('admin', 'accountant', 'hr')) default 'accountant',
  created_by uuid not null references auth.users(id) on delete cascade,
  used_by uuid references auth.users(id) on delete set null,
  used_at timestamp with time zone,
  expires_at timestamp with time zone not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create index if not exists company_invites_token_idx on public.company_invites (token);
create index if not exists company_invites_company_id_idx on public.company_invites (company_id);

alter table public.company_invites enable row level security;

drop policy if exists "Admins read company invites" on public.company_invites;
drop policy if exists "Admins create company invites" on public.company_invites;
drop policy if exists "Admins delete company invites" on public.company_invites;

create policy "Admins read company invites"
  on public.company_invites for select to authenticated
  using (public.user_company_role(company_id) = 'admin');

create policy "Admins create company invites"
  on public.company_invites for insert to authenticated
  with check (public.user_company_role(company_id) = 'admin');

create policy "Admins delete company invites"
  on public.company_invites for delete to authenticated
  using (public.user_company_role(company_id) = 'admin');

notify pgrst, 'reload schema';
