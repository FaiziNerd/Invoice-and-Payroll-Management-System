-- Smart Invoice & Payroll Management Platform
-- Multi-company schema with company-scoped RLS.
--
-- Structural notes (repository layer maps app nested shapes to normalized tables):
--   • Employee salary  → salary_base + employee_allowances + employee_deductions
--   • Template branding → flat branding_* / branding_show_* columns
--   • Payroll runs      → payroll_runs + payroll_entries (entries assembled in repo)
--   • Payroll terminal status → "paid" (matches frontend PayrollStatus type)

-- ---------------------------------------------------------------------------
-- EXTENSIONS
-- ---------------------------------------------------------------------------
create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- COMPANIES & MEMBERSHIP
-- ---------------------------------------------------------------------------
create table public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.companies enable row level security;

create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  name text not null,
  email text not null,
  avatar text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.profiles enable row level security;

-- Role is per-company, not global.
create table public.company_members (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('admin', 'accountant', 'hr')) default 'accountant',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique (company_id, user_id)
);

alter table public.company_members enable row level security;

-- Single-use signup invite tokens (used by /api/invites and join signup flow)
create table public.company_invites (
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

alter table public.company_invites enable row level security;

-- ---------------------------------------------------------------------------
-- ORGANIZATION SETTINGS (one row per company)
-- ---------------------------------------------------------------------------
create table public.organization_settings (
  company_id uuid primary key references public.companies(id) on delete cascade,
  name text not null default 'My Company',
  address text,
  default_template_id uuid,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.organization_settings enable row level security;

-- ---------------------------------------------------------------------------
-- INVOICE TEMPLATES
-- branding_show_* columns map to app branding.sections.{logo,notes,paymentTerms,footer}
-- ---------------------------------------------------------------------------
create table public.invoice_templates (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  is_default boolean not null default false,
  is_active boolean not null default false,
  theme text not null check (theme in ('classic', 'modern', 'minimal')) default 'modern',
  branding_logo text,
  branding_primary_color text not null default '#2563eb',
  branding_secondary_color text not null default '#64748b',
  branding_font_family text not null default 'Inter',
  branding_show_logo boolean not null default true,
  branding_show_notes boolean not null default true,
  branding_show_payment_terms boolean not null default true,
  branding_show_footer boolean not null default true,
  branding_company_name text not null default 'My Company',
  branding_company_address text,
  branding_payment_terms text,
  branding_footer_text text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.invoice_templates enable row level security;

alter table public.organization_settings
  add constraint organization_settings_default_template_id_fkey
  foreign key (default_template_id) references public.invoice_templates(id) on delete set null;

-- ---------------------------------------------------------------------------
-- CLIENTS
-- ---------------------------------------------------------------------------
create table public.clients (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  email text not null,
  phone text,
  address text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.clients enable row level security;

-- ---------------------------------------------------------------------------
-- INVOICES
-- ---------------------------------------------------------------------------
create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  invoice_number text not null,
  client_id uuid not null references public.clients(id) on delete restrict,
  subtotal numeric not null default 0.0,
  tax_rate numeric not null default 10.0,
  tax_amount numeric not null default 0.0,
  total numeric not null default 0.0,
  status text not null check (status in ('draft', 'sent', 'paid', 'overdue')) default 'draft',
  template_id uuid not null references public.invoice_templates(id) on delete restrict,
  share_token text not null unique,
  issue_date timestamp with time zone default timezone('utc'::text, now()) not null,
  due_date timestamp with time zone not null,
  notes text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique (company_id, invoice_number)
);

alter table public.invoices enable row level security;

create table public.invoice_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  description text not null,
  quantity numeric not null default 1.0,
  unit_price numeric not null default 0.0,
  amount numeric not null default 0.0
);

alter table public.invoice_items enable row level security;

create table public.invoice_history (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  action text not null,
  timestamp timestamp with time zone default timezone('utc'::text, now()) not null,
  user_id uuid references public.profiles(id) on delete set null,
  user_name text not null
);

alter table public.invoice_history enable row level security;

-- ---------------------------------------------------------------------------
-- HR: DEPARTMENTS & EMPLOYEES
-- salary_base + employee_allowances + employee_deductions → app salaryStructure
-- ---------------------------------------------------------------------------
create table public.departments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  description text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.departments enable row level security;

create table public.employees (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  employee_id text not null,
  first_name text not null,
  last_name text not null,
  email text not null,
  phone text,
  department_id uuid not null references public.departments(id) on delete restrict,
  position text,
  join_date timestamp with time zone not null,
  status text not null check (status in ('active', 'inactive')) default 'active',
  salary_base numeric not null default 0.0,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique (company_id, employee_id)
);

alter table public.employees enable row level security;

create table public.employee_allowances (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete cascade,
  name text not null,
  amount numeric not null default 0.0
);

alter table public.employee_allowances enable row level security;

create table public.employee_deductions (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete cascade,
  name text not null,
  amount numeric not null default 0.0
);

alter table public.employee_deductions enable row level security;

-- ---------------------------------------------------------------------------
-- PAYROLL
-- payroll_entries rows assembled into app PayrollRun.entries[] in repository
-- Terminal status: "paid" (not "finalized") — matches frontend types & UI
-- ---------------------------------------------------------------------------
create table public.payroll_runs (
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

alter table public.payroll_runs enable row level security;

create table public.payroll_entries (
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

create table public.salary_slips (
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

alter table public.salary_slips enable row level security;

-- ---------------------------------------------------------------------------
-- AUDIT LOGS
-- ---------------------------------------------------------------------------
create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  action text not null check (action in ('create', 'update', 'delete', 'login', 'logout', 'send', 'process', 'export', 'status_change')),
  entity text not null,
  entity_id text,
  user_id uuid references public.profiles(id) on delete set null,
  user_name text not null,
  description text not null,
  metadata jsonb,
  timestamp timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.audit_logs enable row level security;


-- ---------------------------------------------------------------------------
-- HELPER FUNCTIONS (SECURITY DEFINER — used by RLS policies)
-- ---------------------------------------------------------------------------

create or replace function public.user_company_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select company_id
  from public.company_members
  where user_id = auth.uid();
$$;

create or replace function public.user_has_company(p_company_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.company_members
    where user_id = auth.uid()
      and company_id = p_company_id
  );
$$;

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

create or replace function public.invoice_company_id(p_invoice_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select company_id from public.invoices where id = p_invoice_id;
$$;

create or replace function public.employee_company_id(p_employee_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select company_id from public.employees where id = p_employee_id;
$$;

create or replace function public.payroll_run_company_id(p_run_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select company_id from public.payroll_runs where id = p_run_id;
$$;

-- ---------------------------------------------------------------------------
-- PUBLIC INVOICE SHARE (no anon table access — RPC only)
-- Confirms: SELECT * FROM invoices AS anon returns nothing (no anon policies).
-- Only this function exposes share data, filtered by share_token.
-- ---------------------------------------------------------------------------

create or replace function public.get_shared_invoice(p_share_token text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result json;
begin
  if p_share_token is null or length(trim(p_share_token)) = 0 then
    return null;
  end if;

  select json_build_object(
    'invoice', json_build_object(
      'id', inv.id,
      'invoice_number', inv.invoice_number,
      'subtotal', inv.subtotal,
      'tax_rate', inv.tax_rate,
      'tax_amount', inv.tax_amount,
      'total', inv.total,
      'status', inv.status,
      'issue_date', inv.issue_date,
      'due_date', inv.due_date,
      'notes', inv.notes
    ),
    'items', coalesce((
      select json_agg(
        json_build_object(
          'id', ii.id,
          'description', ii.description,
          'quantity', ii.quantity,
          'unit_price', ii.unit_price,
          'amount', ii.amount
        )
        order by ii.id
      )
      from public.invoice_items ii
      where ii.invoice_id = inv.id
    ), '[]'::json),
    'client', json_build_object(
      'name', c.name,
      'email', c.email,
      'phone', c.phone,
      'address', c.address
    ),
    'template', json_build_object(
      'theme', t.theme,
      'branding', json_build_object(
        'logo', t.branding_logo,
        'primary_color', t.branding_primary_color,
        'secondary_color', t.branding_secondary_color,
        'font_family', t.branding_font_family,
        'sections', json_build_object(
          'logo', t.branding_show_logo,
          'notes', t.branding_show_notes,
          'payment_terms', t.branding_show_payment_terms,
          'footer', t.branding_show_footer
        ),
        'company_name', t.branding_company_name,
        'company_address', t.branding_company_address,
        'payment_terms', t.branding_payment_terms,
        'footer_text', t.branding_footer_text
      )
    )
  )
  into v_result
  from public.invoices inv
  inner join public.clients c on c.id = inv.client_id and c.company_id = inv.company_id
  inner join public.invoice_templates t on t.id = inv.template_id and t.company_id = inv.company_id
  where inv.share_token = trim(p_share_token)
    and inv.status in ('sent', 'paid', 'overdue');

  return v_result;
end;
$$;

revoke all on function public.get_shared_invoice(text) from public;
grant execute on function public.get_shared_invoice(text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- AUTH TRIGGER
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, name, email, avatar)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    new.email,
    new.raw_user_meta_data->>'avatar'
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();


-- ---------------------------------------------------------------------------
-- ROW LEVEL SECURITY POLICIES (company-scoped + role within company)
-- NO anon SELECT policies on invoices or invoice_items.
-- ---------------------------------------------------------------------------

-- COMPANIES
create policy "Members read their companies"
  on public.companies for select to authenticated
  using (id in (select public.user_company_ids()));

create policy "Admins update their companies"
  on public.companies for update to authenticated
  using (public.user_company_role(id) = 'admin')
  with check (public.user_company_role(id) = 'admin');

-- PROFILES
create policy "Authenticated users read profiles in shared companies"
  on public.profiles for select to authenticated
  using (
    id = auth.uid()
    or exists (
      select 1
      from public.company_members cm_self
      join public.company_members cm_other on cm_other.company_id = cm_self.company_id
      where cm_self.user_id = auth.uid()
        and cm_other.user_id = profiles.id
    )
  );

create policy "Users update own profile"
  on public.profiles for update to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- COMPANY MEMBERS
create policy "Members read company membership"
  on public.company_members for select to authenticated
  using (company_id in (select public.user_company_ids()));

create policy "Company admins manage membership"
  on public.company_members for all to authenticated
  using (public.user_company_role(company_id) = 'admin')
  with check (public.user_company_role(company_id) = 'admin');

-- COMPANY INVITES
create policy "Admins read company invites"
  on public.company_invites for select to authenticated
  using (public.user_company_role(company_id) = 'admin');

create policy "Admins create company invites"
  on public.company_invites for insert to authenticated
  with check (public.user_company_role(company_id) = 'admin');

create policy "Admins delete company invites"
  on public.company_invites for delete to authenticated
  using (public.user_company_role(company_id) = 'admin');

create policy "Admins revoke company invites"
  on public.company_invites for update to authenticated
  using (public.user_company_role(company_id) = 'admin')
  with check (public.user_company_role(company_id) = 'admin');

-- ORGANIZATION SETTINGS
create policy "Members read company settings"
  on public.organization_settings for select to authenticated
  using (public.user_has_company(company_id));

create policy "Admins and accountants insert settings"
  on public.organization_settings for insert to authenticated
  with check (public.user_company_role(company_id) in ('admin', 'accountant'));

create policy "Admins and accountants update settings"
  on public.organization_settings for update to authenticated
  using (public.user_company_role(company_id) in ('admin', 'accountant'))
  with check (public.user_company_role(company_id) in ('admin', 'accountant'));

-- INVOICE TEMPLATES
create policy "Members read company templates"
  on public.invoice_templates for select to authenticated
  using (public.user_has_company(company_id));

create policy "Admins and accountants modify templates"
  on public.invoice_templates for all to authenticated
  using (public.user_company_role(company_id) in ('admin', 'accountant'))
  with check (public.user_company_role(company_id) in ('admin', 'accountant'));

-- CLIENTS
create policy "Members read company clients"
  on public.clients for select to authenticated
  using (public.user_has_company(company_id));

create policy "Admins and accountants modify clients"
  on public.clients for all to authenticated
  using (public.user_company_role(company_id) in ('admin', 'accountant'))
  with check (public.user_company_role(company_id) in ('admin', 'accountant'));

-- INVOICES (authenticated only — public access via get_shared_invoice RPC)
create policy "Members read company invoices"
  on public.invoices for select to authenticated
  using (public.user_has_company(company_id));

create policy "Admins and accountants modify invoices"
  on public.invoices for all to authenticated
  using (public.user_company_role(company_id) in ('admin', 'accountant'))
  with check (public.user_company_role(company_id) in ('admin', 'accountant'));

-- INVOICE ITEMS
create policy "Members read invoice items"
  on public.invoice_items for select to authenticated
  using (public.user_has_company(public.invoice_company_id(invoice_id)));

create policy "Admins and accountants modify invoice items"
  on public.invoice_items for all to authenticated
  using (public.user_company_role(public.invoice_company_id(invoice_id)) in ('admin', 'accountant'))
  with check (public.user_company_role(public.invoice_company_id(invoice_id)) in ('admin', 'accountant'));

-- INVOICE HISTORY
create policy "Members read invoice history"
  on public.invoice_history for select to authenticated
  using (public.user_has_company(public.invoice_company_id(invoice_id)));

create policy "Admins and accountants create history"
  on public.invoice_history for insert to authenticated
  with check (public.user_company_role(public.invoice_company_id(invoice_id)) in ('admin', 'accountant'));

create policy "Company admins delete history"
  on public.invoice_history for delete to authenticated
  using (public.user_company_role(public.invoice_company_id(invoice_id)) = 'admin');

-- DEPARTMENTS
create policy "Members read company departments"
  on public.departments for select to authenticated
  using (public.user_has_company(company_id));

create policy "Admins and HR modify departments"
  on public.departments for all to authenticated
  using (public.user_company_role(company_id) in ('admin', 'hr'))
  with check (public.user_company_role(company_id) in ('admin', 'hr'));

-- EMPLOYEES
create policy "Members read company employees"
  on public.employees for select to authenticated
  using (public.user_has_company(company_id));

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

-- EMPLOYEE ALLOWANCES
create policy "Members read allowances"
  on public.employee_allowances for select to authenticated
  using (public.user_has_company(public.employee_company_id(employee_id)));

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

-- EMPLOYEE DEDUCTIONS
create policy "Members read deductions"
  on public.employee_deductions for select to authenticated
  using (public.user_has_company(public.employee_company_id(employee_id)));

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

-- PAYROLL RUNS
create policy "Members read company payroll runs"
  on public.payroll_runs for select to authenticated
  using (public.user_has_company(company_id));

create policy "Admins accountants HR write payroll runs"
  on public.payroll_runs for all to authenticated
  using (public.user_company_role(company_id) in ('admin', 'accountant', 'hr'))
  with check (public.user_company_role(company_id) in ('admin', 'accountant', 'hr'));

-- PAYROLL ENTRIES
create policy "Members read payroll entries"
  on public.payroll_entries for select to authenticated
  using (public.user_has_company(public.payroll_run_company_id(payroll_run_id)));

create policy "Admins accountants HR write payroll entries"
  on public.payroll_entries for all to authenticated
  using (public.user_company_role(public.payroll_run_company_id(payroll_run_id)) in ('admin', 'accountant', 'hr'))
  with check (public.user_company_role(public.payroll_run_company_id(payroll_run_id)) in ('admin', 'accountant', 'hr'));

-- SALARY SLIPS
create policy "Members read company salary slips"
  on public.salary_slips for select to authenticated
  using (public.user_has_company(company_id));

create policy "Admins and HR modify salary slips"
  on public.salary_slips for all to authenticated
  using (public.user_company_role(company_id) in ('admin', 'hr'))
  with check (public.user_company_role(company_id) in ('admin', 'hr'));

-- AUDIT LOGS
create policy "Company admins read audit logs"
  on public.audit_logs for select to authenticated
  using (public.user_company_role(company_id) = 'admin');

create policy "Members append audit logs"
  on public.audit_logs for insert to authenticated
  with check (public.user_has_company(company_id));

-- ---------------------------------------------------------------------------
-- INDEXES (RLS and common query paths)
-- ---------------------------------------------------------------------------
create index company_members_user_id_idx on public.company_members (user_id);
create index company_invites_token_idx on public.company_invites (token);
create index company_invites_company_id_idx on public.company_invites (company_id);
create index clients_company_id_idx on public.clients (company_id);
create index invoices_company_id_idx on public.invoices (company_id);
create index invoice_items_invoice_id_idx on public.invoice_items (invoice_id);
create index invoice_history_invoice_id_idx on public.invoice_history (invoice_id);
create index departments_company_id_idx on public.departments (company_id);
create index employees_company_id_idx on public.employees (company_id);
create index payroll_runs_company_id_idx on public.payroll_runs (company_id);
create index payroll_entries_payroll_run_id_idx on public.payroll_entries (payroll_run_id);
create index salary_slips_company_id_idx on public.salary_slips (company_id);
create index audit_logs_company_id_idx on public.audit_logs (company_id);
