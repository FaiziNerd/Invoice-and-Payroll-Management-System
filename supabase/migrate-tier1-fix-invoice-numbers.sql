-- Fix invoice numbering after a failed Tier 1 migration.
-- Safe to re-run. Run this alone in Supabase SQL Editor, then continue with
-- migrate-tier1-money-trust.sql from the "ORG TAX CONFIGURATION" section onward.

-- ---------------------------------------------------------------------------
-- Sequences table + allocator (created here because main migration may have failed early)
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

-- ---------------------------------------------------------------------------
-- Per-company uniqueness (drop legacy global unique if present)
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- Renumber legacy formats (e.g. INV-2026-001) without colliding with INV-NNNN
-- ---------------------------------------------------------------------------

-- Phase 1: stage non-standard numbers to temporary unique values
update public.invoices
set invoice_number = '_MIG_' || replace(id::text, '-', '')
where invoice_number !~ '^INV-[0-9]{4}$'
  and invoice_number not like '_MIG_%';

-- Phase 2: assign INV-NNNN after each company's current max (0 if none yet)
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
    l.company_id,
    coalesce((
      select max(substring(i.invoice_number from 5)::integer)
      from public.invoices i
      where i.company_id = l.company_id
        and i.invoice_number ~ '^INV-[0-9]{4}$'
    ), 0) as max_num
  from (select distinct company_id from public.invoices where invoice_number like '_MIG_%') l
)
update public.invoices i
set invoice_number = 'INV-' || lpad((m.max_num + leg.rn)::text, 4, '0')
from legacy leg
join maxes m on m.company_id = leg.company_id
where i.id = leg.id;

-- Sync sequence counters
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
