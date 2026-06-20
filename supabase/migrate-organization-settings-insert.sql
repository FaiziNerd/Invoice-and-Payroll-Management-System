-- Add missing INSERT policy for organization_settings (required for PATCH upsert).
-- Safe to re-run.

drop policy if exists "Admins and accountants insert settings" on public.organization_settings;

create policy "Admins and accountants insert settings"
  on public.organization_settings for insert to authenticated
  with check (public.user_company_role(company_id) in ('admin', 'accountant'));

notify pgrst, 'reload schema';
