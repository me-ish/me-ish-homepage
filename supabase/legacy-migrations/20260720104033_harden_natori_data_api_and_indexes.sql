-- Natori browser code uses authenticated Next.js API routes. Keep the public
-- schema tables out of PostgREST/GraphQL for anon and signed-in clients; only
-- the server-side service-role client needs table privileges.
revoke all privileges on table
  public.natori_delivery_files,
  public.natori_events,
  public.natori_inquiry_reference_files,
  public.natori_links_content,
  public.natori_order_mail_logs,
  public.natori_page_events,
  public.natori_payment_transactions,
  public.natori_portfolio_content,
  public.natori_pricing_configs,
  public.natori_project_tasks,
  public.natori_projects,
  public.natori_quotes,
  public.natori_user_profiles
from public, anon, authenticated;

grant all privileges on table
  public.natori_delivery_files,
  public.natori_events,
  public.natori_inquiry_reference_files,
  public.natori_links_content,
  public.natori_order_mail_logs,
  public.natori_page_events,
  public.natori_payment_transactions,
  public.natori_portfolio_content,
  public.natori_pricing_configs,
  public.natori_project_tasks,
  public.natori_projects,
  public.natori_quotes,
  public.natori_user_profiles
to service_role;

-- Preserve owner-policy defense in depth while evaluating auth.uid() once per
-- statement instead of once per row.
drop policy if exists natori_projects_own_select on public.natori_projects;
drop policy if exists natori_projects_own_insert on public.natori_projects;
drop policy if exists natori_projects_own_update on public.natori_projects;
drop policy if exists natori_projects_own_delete on public.natori_projects;
create policy natori_projects_own_select on public.natori_projects
  for select to authenticated
  using ((select auth.uid()) = user_id and deleted_at is null);
create policy natori_projects_own_insert on public.natori_projects
  for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy natori_projects_own_update on public.natori_projects
  for update to authenticated
  using ((select auth.uid()) = user_id and deleted_at is null)
  with check ((select auth.uid()) = user_id);
create policy natori_projects_own_delete on public.natori_projects
  for delete to authenticated
  using ((select auth.uid()) = user_id and deleted_at is null);

drop policy if exists natori_tasks_own_select on public.natori_project_tasks;
drop policy if exists natori_tasks_own_insert on public.natori_project_tasks;
drop policy if exists natori_tasks_own_update on public.natori_project_tasks;
drop policy if exists natori_tasks_own_delete on public.natori_project_tasks;
create policy natori_tasks_own_select on public.natori_project_tasks
  for select to authenticated
  using (exists (
    select 1 from public.natori_projects p
    where p.id = natori_project_tasks.project_id
      and p.user_id = (select auth.uid())
      and p.deleted_at is null
  ));
create policy natori_tasks_own_insert on public.natori_project_tasks
  for insert to authenticated
  with check (exists (
    select 1 from public.natori_projects p
    where p.id = natori_project_tasks.project_id
      and p.user_id = (select auth.uid())
      and p.deleted_at is null
  ));
create policy natori_tasks_own_update on public.natori_project_tasks
  for update to authenticated
  using (exists (
    select 1 from public.natori_projects p
    where p.id = natori_project_tasks.project_id
      and p.user_id = (select auth.uid())
      and p.deleted_at is null
  ))
  with check (exists (
    select 1 from public.natori_projects p
    where p.id = natori_project_tasks.project_id
      and p.user_id = (select auth.uid())
      and p.deleted_at is null
  ));
create policy natori_tasks_own_delete on public.natori_project_tasks
  for delete to authenticated
  using (exists (
    select 1 from public.natori_projects p
    where p.id = natori_project_tasks.project_id
      and p.user_id = (select auth.uid())
      and p.deleted_at is null
  ));

drop policy if exists natori_events_own_select on public.natori_events;
drop policy if exists natori_events_own_insert on public.natori_events;
drop policy if exists natori_events_own_update on public.natori_events;
drop policy if exists natori_events_own_delete on public.natori_events;
create policy natori_events_own_select on public.natori_events
  for select to authenticated using ((select auth.uid()) = user_id);
create policy natori_events_own_insert on public.natori_events
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy natori_events_own_update on public.natori_events
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy natori_events_own_delete on public.natori_events
  for delete to authenticated using ((select auth.uid()) = user_id);

drop policy if exists natori_pricing_configs_own_select on public.natori_pricing_configs;
drop policy if exists natori_pricing_configs_own_insert on public.natori_pricing_configs;
drop policy if exists natori_pricing_configs_own_update on public.natori_pricing_configs;
drop policy if exists natori_pricing_configs_own_delete on public.natori_pricing_configs;
create policy natori_pricing_configs_own_select on public.natori_pricing_configs
  for select to authenticated using ((select auth.uid()) = user_id);
create policy natori_pricing_configs_own_insert on public.natori_pricing_configs
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy natori_pricing_configs_own_update on public.natori_pricing_configs
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy natori_pricing_configs_own_delete on public.natori_pricing_configs
  for delete to authenticated using ((select auth.uid()) = user_id);

drop policy if exists natori_user_profiles_own_select on public.natori_user_profiles;
drop policy if exists natori_user_profiles_own_insert on public.natori_user_profiles;
drop policy if exists natori_user_profiles_own_update on public.natori_user_profiles;
drop policy if exists natori_user_profiles_own_delete on public.natori_user_profiles;
create policy natori_user_profiles_own_select on public.natori_user_profiles
  for select to authenticated using ((select auth.uid()) = user_id);
create policy natori_user_profiles_own_insert on public.natori_user_profiles
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy natori_user_profiles_own_update on public.natori_user_profiles
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy natori_user_profiles_own_delete on public.natori_user_profiles
  for delete to authenticated using ((select auth.uid()) = user_id);

-- These tables are service-only. Explicit deny policies document that intent
-- and avoid relying on the absence of policies as the only safeguard.
drop policy if exists natori_service_only on public.natori_delivery_files;
create policy natori_service_only on public.natori_delivery_files
  for all to anon, authenticated using (false) with check (false);
drop policy if exists natori_service_only on public.natori_inquiry_reference_files;
create policy natori_service_only on public.natori_inquiry_reference_files
  for all to anon, authenticated using (false) with check (false);
drop policy if exists natori_service_only on public.natori_order_mail_logs;
create policy natori_service_only on public.natori_order_mail_logs
  for all to anon, authenticated using (false) with check (false);
drop policy if exists natori_service_only on public.natori_page_events;
create policy natori_service_only on public.natori_page_events
  for all to anon, authenticated using (false) with check (false);
drop policy if exists natori_service_only on public.natori_payment_transactions;
create policy natori_service_only on public.natori_payment_transactions
  for all to anon, authenticated using (false) with check (false);
drop policy if exists natori_service_only on public.natori_quotes;
create policy natori_service_only on public.natori_quotes
  for all to anon, authenticated using (false) with check (false);

-- Trigger functions only touch NEW.updated_at, so an empty search_path is safe
-- and prevents object-shadowing through a caller-controlled schema.
alter function public.touch_natori_events_updated_at() set search_path = '';
alter function public.touch_natori_pricing_configs_updated_at() set search_path = '';
alter function public.touch_natori_projects_updated_at() set search_path = '';
alter function public.touch_natori_user_profiles_updated_at() set search_path = '';

-- Cover nullable foreign keys used during quote/payment cleanup and joins.
create index if not exists natori_order_mail_logs_quote_id_idx
  on public.natori_order_mail_logs (quote_id);
create index if not exists natori_payment_transactions_quote_id_idx
  on public.natori_payment_transactions (quote_id);
create index if not exists natori_projects_active_quote_id_idx
  on public.natori_projects (active_quote_id);
create index if not exists natori_projects_payment_quote_id_idx
  on public.natori_projects (payment_quote_id);
