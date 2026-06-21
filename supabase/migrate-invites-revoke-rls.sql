-- Allow admins to revoke (update) company invites
-- Safe to re-run.

drop policy if exists "Admins revoke company invites" on public.company_invites;
create policy "Admins revoke company invites"
  on public.company_invites for update to authenticated
  using (public.user_company_role(company_id) = 'admin')
  with check (public.user_company_role(company_id) = 'admin');

notify pgrst, 'reload schema';
