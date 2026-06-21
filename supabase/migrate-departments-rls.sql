-- Fix departments RLS policies (run in Supabase SQL Editor if inserts fail with RLS errors).
-- Safe to re-run: drops and recreates policies.

create or replace function public.user_company_role(p_company_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role
  from public.company_members
  where user_id = auth.uid()
    and company_id = p_company_id
    and coalesce(status, 'active') = 'active'
  limit 1;
$$;

drop policy if exists "Members read company departments" on public.departments;
drop policy if exists "Admins and HR modify departments" on public.departments;
drop policy if exists "Admins and HR insert departments" on public.departments;
drop policy if exists "Admins and HR update departments" on public.departments;
drop policy if exists "Admins and HR delete departments" on public.departments;

create policy "Members read company departments"
  on public.departments for select to authenticated
  using (public.user_has_company(company_id));

create policy "Admins and HR insert departments"
  on public.departments for insert to authenticated
  with check (public.user_company_role(company_id) in ('admin', 'hr'));

create policy "Admins and HR update departments"
  on public.departments for update to authenticated
  using (public.user_company_role(company_id) in ('admin', 'hr'))
  with check (public.user_company_role(company_id) in ('admin', 'hr'));

create policy "Admins and HR delete departments"
  on public.departments for delete to authenticated
  using (public.user_company_role(company_id) in ('admin', 'hr'));

notify pgrst, 'reload schema';
