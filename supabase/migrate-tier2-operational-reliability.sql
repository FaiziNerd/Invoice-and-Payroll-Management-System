-- Tier 2: Operational Reliability
-- Run in Supabase SQL Editor after schema.sql and prior migrations.

-- ---------------------------------------------------------------------------
-- Soft deletes
-- ---------------------------------------------------------------------------
alter table public.clients
  add column if not exists deleted_at timestamp with time zone;

alter table public.employees
  add column if not exists deleted_at timestamp with time zone;

alter table public.invoice_templates
  add column if not exists deleted_at timestamp with time zone;

create index if not exists clients_deleted_at_idx on public.clients (company_id, deleted_at);
create index if not exists employees_deleted_at_idx on public.employees (company_id, deleted_at);
create index if not exists invoice_templates_deleted_at_idx on public.invoice_templates (company_id, deleted_at);

-- ---------------------------------------------------------------------------
-- Member status (active vs pending approval)
-- ---------------------------------------------------------------------------
alter table public.company_members
  add column if not exists status text not null default 'active'
  check (status in ('active', 'pending'));

alter table public.company_members
  add column if not exists employee_id uuid references public.employees(id) on delete set null;

update public.company_members set status = 'active' where status is null;

-- Extend roles to include employee self-service
alter table public.company_members drop constraint if exists company_members_role_check;
alter table public.company_members
  add constraint company_members_role_check
  check (role in ('admin', 'accountant', 'hr', 'employee'));

-- Link employee records to login accounts
alter table public.employees
  add column if not exists user_id uuid references auth.users(id) on delete set null;

create unique index if not exists employees_user_id_company_idx
  on public.employees (company_id, user_id)
  where user_id is not null;

-- ---------------------------------------------------------------------------
-- Email-specific invites + revoke
-- ---------------------------------------------------------------------------
alter table public.company_invites
  add column if not exists email text;

alter table public.company_invites
  add column if not exists revoked_at timestamp with time zone;

alter table public.company_invites
  add column if not exists employee_id uuid references public.employees(id) on delete cascade;

alter table public.company_invites drop constraint if exists company_invites_role_check;
alter table public.company_invites
  add constraint company_invites_role_check
  check (role in ('admin', 'accountant', 'hr', 'employee'));

create index if not exists company_invites_email_idx on public.company_invites (company_id, email);

-- ---------------------------------------------------------------------------
-- RLS: employee self-service (read own salary slips + profile)
-- ---------------------------------------------------------------------------
drop policy if exists "Members read company salary slips" on public.salary_slips;
create policy "Members read company salary slips"
  on public.salary_slips for select to authenticated
  using (
    public.user_has_company(company_id)
    and (
      public.user_company_role(company_id) in ('admin', 'hr', 'accountant')
      or (
        public.user_company_role(company_id) = 'employee'
        and employee_id = (
          select cm.employee_id
          from public.company_members cm
          where cm.user_id = auth.uid()
            and cm.company_id = salary_slips.company_id
            and cm.status = 'active'
          limit 1
        )
      )
    )
  );

drop policy if exists "Members read company employees" on public.employees;
create policy "Members read company employees"
  on public.employees for select to authenticated
  using (
    public.user_has_company(company_id)
    and (
      public.user_company_role(company_id) in ('admin', 'hr', 'accountant')
      or (
        public.user_company_role(company_id) = 'employee'
        and id = (
          select cm.employee_id
          from public.company_members cm
          where cm.user_id = auth.uid()
            and cm.company_id = employees.company_id
            and cm.status = 'active'
          limit 1
        )
      )
    )
  );

drop policy if exists "Members read company membership" on public.company_members;
create policy "Members read company membership"
  on public.company_members for select to authenticated
  using (
    user_id = auth.uid()
    or (
      company_id in (select public.user_company_ids())
      and (
        public.user_company_role(company_id) = 'admin'
        or status = 'active'
      )
    )
  );

notify pgrst, 'reload schema';
