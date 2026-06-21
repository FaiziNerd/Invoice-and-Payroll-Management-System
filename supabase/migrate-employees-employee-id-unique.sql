-- Fix employees.employee_id uniqueness to be per-company (not global).
-- Safe to re-run.

alter table public.employees drop constraint if exists employees_employee_id_key;
alter table public.employees drop constraint if exists employees_company_id_employee_id_key;

alter table public.employees
  add constraint employees_company_id_employee_id_key unique (company_id, employee_id);

notify pgrst, 'reload schema';
