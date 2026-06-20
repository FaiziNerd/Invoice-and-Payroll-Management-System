-- Fix: users must always read their own company_members row (session bootstrap).
-- Without this, pending (and some active) users get empty membership on login → false "Pending approval" screen.

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
