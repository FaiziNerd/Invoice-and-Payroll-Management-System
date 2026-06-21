-- Fix employees RLS policies (run in Supabase SQL Editor if inserts/updates fail with RLS errors).
-- Safe to re-run.

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

drop policy if exists "Admins and HR modify employees" on public.employees;
drop policy if exists "Admins and HR insert employees" on public.employees;
drop policy if exists "Admins and HR update employees" on public.employees;
drop policy if exists "Admins and HR delete employees" on public.employees;

create policy "Admins and HR insert employees"
  on public.employees for insert to authenticated
  with check (public.user_company_role(company_id) in ('admin', 'hr'));

create policy "Admins and HR update employees"
  on public.employees for update to authenticated
  using (public.user_company_role(company_id) in ('admin', 'hr'))
  with check (public.user_company_role(company_id) in ('admin', 'hr'));

create policy "Admins and HR delete employees"
  on public.employees for delete to authenticated
  using (public.user_company_role(company_id) in ('admin', 'hr'));

drop policy if exists "Admins and HR modify allowances" on public.employee_allowances;
drop policy if exists "Admins and HR insert allowances" on public.employee_allowances;
drop policy if exists "Admins and HR update allowances" on public.employee_allowances;
drop policy if exists "Admins and HR delete allowances" on public.employee_allowances;

create policy "Admins and HR insert allowances"
  on public.employee_allowances for insert to authenticated
  with check (public.user_company_role(public.employee_company_id(employee_id)) in ('admin', 'hr'));

create policy "Admins and HR update allowances"
  on public.employee_allowances for update to authenticated
  using (public.user_company_role(public.employee_company_id(employee_id)) in ('admin', 'hr'))
  with check (public.user_company_role(public.employee_company_id(employee_id)) in ('admin', 'hr'));

create policy "Admins and HR delete allowances"
  on public.employee_allowances for delete to authenticated
  using (public.user_company_role(public.employee_company_id(employee_id)) in ('admin', 'hr'));

drop policy if exists "Admins and HR modify deductions" on public.employee_deductions;
drop policy if exists "Admins and HR insert deductions" on public.employee_deductions;
drop policy if exists "Admins and HR update deductions" on public.employee_deductions;
drop policy if exists "Admins and HR delete deductions" on public.employee_deductions;

create policy "Admins and HR insert deductions"
  on public.employee_deductions for insert to authenticated
  with check (public.user_company_role(public.employee_company_id(employee_id)) in ('admin', 'hr'));

create policy "Admins and HR update deductions"
  on public.employee_deductions for update to authenticated
  using (public.user_company_role(public.employee_company_id(employee_id)) in ('admin', 'hr'))
  with check (public.user_company_role(public.employee_company_id(employee_id)) in ('admin', 'hr'));

create policy "Admins and HR delete deductions"
  on public.employee_deductions for delete to authenticated
  using (public.user_company_role(public.employee_company_id(employee_id)) in ('admin', 'hr'));

notify pgrst, 'reload schema';
