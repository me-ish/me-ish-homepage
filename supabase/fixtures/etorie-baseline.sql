\set ON_ERROR_STOP on

-- Verification-only deterministic fixture.
--
-- Required psql variables:
--   --set=etorie_fixture_confirm=YES
--   --set=etorie_target_project_ref=<non-production-ref>
--
-- Before applying this file, create the dedicated test Auth user documented in
-- docs/etorie-p0-01-dry-run-runbook.md. This fixture never inserts auth.users.
--
-- P0-02 Phase 1 nullable amount/due_date and undecided type are not present in
-- this baseline schema. Fixture 01 therefore uses the current compatibility
-- representation (amount=0, concrete type, deterministic future due_date).
-- A Phase 1 fixture must be added only after the approved additive migration.

begin;

select set_config(
  'app.etorie_fixture_confirm',
  :'etorie_fixture_confirm',
  false
);
select set_config(
  'app.etorie_target_project_ref',
  :'etorie_target_project_ref',
  false
);

do $guard$
begin
  if current_setting('app.etorie_fixture_confirm', true) <> 'YES' then
    raise exception 'fixture_confirmation_required';
  end if;
  if current_setting('app.etorie_target_project_ref', true) in (
    '',
    'lvnfspyainrxtztjytbo'
  ) then
    raise exception 'production_fixture_target_blocked';
  end if;
  if not exists (
    select 1
    from auth.users
    where id = '00000000-0000-4000-8000-000000000001'::uuid
  ) then
    raise exception 'fixture_auth_user_missing';
  end if;
end
$guard$;

insert into public.natori_projects (
  id, user_id, title, client_name, client_email, amount, type, status,
  delivery_plan, priority, start_date, due_date, next_action, note,
  payment_confirmed_at, quoted_amount, quote_accepted_at,
  quote_accepted_amount, payment_link_status, paid_amount,
  stripe_payment_session_id, paid_at, completed_at, deleted_at,
  created_at, updated_at
)
values
  (
    '10000000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-000000000001',
    'Fixture 01 undecided inquiry', 'Fixture Client 01',
    'fixture-01@example.invalid', 0, 'illustration', 'inquiry',
    'normal', 'normal', null, '2099-01-31', '相談内容を確認', 'fixture only',
    null, null, null, null, null, null, null, null, null, null,
    '2099-01-01T00:00:01Z', '2099-01-01T00:00:01Z'
  ),
  (
    '10000000-0000-4000-8000-000000000002',
    '00000000-0000-4000-8000-000000000001',
    'Fixture 02 before quote', 'Fixture Client 02',
    'fixture-02@example.invalid', 12000, 'icon', 'estimating',
    'normal', 'normal', '2099-01-02', '2099-02-01', '見積もりを作成', 'fixture only',
    null, null, null, null, null, null, null, null, null, null,
    '2099-01-01T00:00:02Z', '2099-01-01T00:00:02Z'
  ),
  (
    '10000000-0000-4000-8000-000000000003',
    '00000000-0000-4000-8000-000000000001',
    'Fixture 03 quote issued', 'Fixture Client 03',
    'fixture-03@example.invalid', 24000, 'sd', 'quoted',
    'normal', 'high', '2099-01-03', '2099-02-03', '承諾待ち', 'fixture only',
    null, 24000, null, null, null, null, null, null, null, null,
    '2099-01-01T00:00:03Z', '2099-01-01T00:00:03Z'
  ),
  (
    '10000000-0000-4000-8000-000000000004',
    '00000000-0000-4000-8000-000000000001',
    'Fixture 04 quote accepted', 'Fixture Client 04',
    'fixture-04@example.invalid', 36000, 'standing', 'quoted',
    'rush_14_days', 'high', '2099-01-04', '2099-02-04', '支払い依頼を送る', 'fixture only',
    null, 36000, '2099-01-10T00:00:00Z', 36000, 'ready', null, null, null, null, null,
    '2099-01-01T00:00:04Z', '2099-01-10T00:00:00Z'
  ),
  (
    '10000000-0000-4000-8000-000000000005',
    '00000000-0000-4000-8000-000000000001',
    'Fixture 05 Stripe test paid', 'Fixture Client 05',
    'fixture-05@example.invalid', 48000, 'illustration', 'rough',
    'normal', 'normal', '2099-01-05', '2099-02-05', 'ラフ提出', 'fixture only',
    '2099-01-11T00:00:00Z', 48000, '2099-01-09T00:00:00Z', 48000,
    'paid', 48000, 'cs_test_etorie_fixture_0005',
    '2099-01-11T00:00:00Z', null, null,
    '2099-01-01T00:00:05Z', '2099-01-11T00:00:00Z'
  ),
  (
    '10000000-0000-4000-8000-000000000006',
    '00000000-0000-4000-8000-000000000001',
    'Fixture 06 manual paid', 'Fixture Client 06',
    'fixture-06@example.invalid', 18000, 'icon', 'rough',
    'normal', 'normal', '2099-01-06', '2099-02-06', 'ラフ提出', 'fixture only',
    '2099-01-12T00:00:00Z', 18000, null, null, 'paid', 18000, null,
    '2099-01-12T00:00:00Z', null, null,
    '2099-01-01T00:00:06Z', '2099-01-12T00:00:00Z'
  ),
  (
    '10000000-0000-4000-8000-000000000007',
    '00000000-0000-4000-8000-000000000001',
    'Fixture 07 completed', 'Fixture Client 07',
    'fixture-07@example.invalid', 54000, 'standing', 'completed',
    'normal', 'low', '2098-12-01', '2099-01-07', '', 'fixture only',
    '2098-12-10T00:00:00Z', 54000, '2098-12-08T00:00:00Z', 54000,
    'paid', 54000, 'cs_test_etorie_fixture_0007',
    '2098-12-10T00:00:00Z', '2099-01-07T00:00:00Z', null,
    '2098-12-01T00:00:07Z', '2099-01-07T00:00:00Z'
  ),
  (
    '10000000-0000-4000-8000-000000000008',
    '00000000-0000-4000-8000-000000000001',
    'Fixture 08 archived', 'Fixture Client 08',
    'fixture-08@example.invalid', 9000, 'sd', 'inquiry',
    'normal', 'normal', null, '2099-02-08', '', 'fixture only',
    null, null, null, null, null, null, null, null, null,
    '2099-01-15T00:00:00Z',
    '2099-01-01T00:00:08Z', '2099-01-15T00:00:00Z'
  ),
  (
    '10000000-0000-4000-8000-000000000009',
    '00000000-0000-4000-8000-000000000001',
    'Fixture 09 legacy completed', 'Fixture Client 09',
    'fixture-09@example.invalid', 30000, 'illustration', 'completed',
    'normal', 'normal', '2098-10-01', '2098-11-01', '', 'fixture only legacy result',
    '2098-10-10T00:00:00Z', null, null, null, 'paid', 30000, null,
    '2098-10-10T00:00:00Z', '2098-11-01T00:00:00Z', null,
    '2098-10-01T00:00:09Z', '2098-11-01T00:00:00Z'
  )
on conflict (id) do update
set title = excluded.title,
    status = excluded.status,
    next_action = excluded.next_action,
    deleted_at = excluded.deleted_at,
    updated_at = excluded.updated_at;

insert into public.natori_project_tasks (
  id, project_id, task_key, label, stage, estimated_hours, done, sort_order
)
select
  md5(project.id::text || ':' || step.task_key)::uuid,
  project.id,
  step.task_key,
  step.label,
  step.stage,
  step.estimated_hours,
  case when project.status = 'completed' then true else false end,
  step.sort_order
from (
  select id, status
  from public.natori_projects
  where id between
    '10000000-0000-4000-8000-000000000001'::uuid
    and '10000000-0000-4000-8000-000000000009'::uuid
) project
cross join (
  values
    ('material', '資料確認', 'material', 1.00::numeric, 10),
    ('rough', 'ラフ', 'rough', 2.00::numeric, 20),
    ('lineart', '線画', 'lineart', 2.00::numeric, 30),
    ('coloring', '着彩', 'coloring', 3.00::numeric, 40),
    ('finish', '仕上げ', 'finish', 1.50::numeric, 50),
    ('delivery', '納品', 'delivery', 0.50::numeric, 60)
) step(task_key, label, stage, estimated_hours, sort_order)
on conflict (project_id, task_key) do update
set label = excluded.label,
    stage = excluded.stage,
    estimated_hours = excluded.estimated_hours,
    done = excluded.done,
    sort_order = excluded.sort_order;

insert into public.natori_quotes (
  id, project_id, user_id, version, title, client_name, to_email, amount,
  subject, body_snapshot, token_hash, expires_at, accepted_at, created_at
)
values
  (
    '20000000-0000-4000-8000-000000000003',
    '10000000-0000-4000-8000-000000000003',
    '00000000-0000-4000-8000-000000000001',
    1, 'Fixture Quote 03', 'Fixture Client 03',
    'fixture-03@example.invalid', 24000, 'Fixture quote',
    'Verification-only quote body', repeat('a', 64),
    '2099-02-02T00:00:00Z', null, '2099-01-03T00:00:00Z'
  ),
  (
    '20000000-0000-4000-8000-000000000004',
    '10000000-0000-4000-8000-000000000004',
    '00000000-0000-4000-8000-000000000001',
    1, 'Fixture Quote 04', 'Fixture Client 04',
    'fixture-04@example.invalid', 36000, 'Fixture accepted quote',
    'Verification-only accepted quote body', repeat('b', 64),
    '2099-02-03T00:00:00Z', '2099-01-10T00:00:00Z',
    '2099-01-04T00:00:00Z'
  )
on conflict (id) do update
set amount = excluded.amount,
    accepted_at = excluded.accepted_at;

update public.natori_projects
set active_quote_id = case id
      when '10000000-0000-4000-8000-000000000003'::uuid
        then '20000000-0000-4000-8000-000000000003'::uuid
      when '10000000-0000-4000-8000-000000000004'::uuid
        then '20000000-0000-4000-8000-000000000004'::uuid
    end,
    quote_accept_token_hash = case id
      when '10000000-0000-4000-8000-000000000003'::uuid then repeat('a', 64)
      when '10000000-0000-4000-8000-000000000004'::uuid then repeat('b', 64)
    end,
    quote_token_expires_at = '2099-02-03T00:00:00Z'
where id in (
  '10000000-0000-4000-8000-000000000003',
  '10000000-0000-4000-8000-000000000004'
);

insert into public.natori_payment_transactions (
  id, project_id, quote_id, stripe_session_id, amount, status, received_at, note
)
values
  (
    '30000000-0000-4000-8000-000000000005',
    '10000000-0000-4000-8000-000000000005',
    null, 'cs_test_etorie_fixture_0005', 48000, 'received',
    '2099-01-11T00:00:00Z', 'verification-only Stripe test equivalent'
  ),
  (
    '30000000-0000-4000-8000-000000000006',
    '10000000-0000-4000-8000-000000000006',
    null, null, 18000, 'manual',
    '2099-01-12T00:00:00Z', 'verification-only manual payment'
  )
on conflict (id) do update
set status = excluded.status,
    amount = excluded.amount;

insert into public.natori_inquiry_reference_files (
  id, project_id, storage_path, created_at
)
values (
  '40000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000001/40000000-0000-4000-8000-000000000001.png',
  '2099-01-01T00:01:00Z'
)
on conflict (id) do update set storage_path = excluded.storage_path;

insert into public.natori_delivery_files (
  id, project_id, folder, storage_path, file_name, size_bytes, created_at
)
values (
  '50000000-0000-4000-8000-000000000007',
  '10000000-0000-4000-8000-000000000007',
  'final',
  '10000000-0000-4000-8000-000000000007/final/50000000-0000-4000-8000-000000000007.png',
  'fixture-final.png',
  128,
  '2099-01-07T00:01:00Z'
)
on conflict (id) do update
set storage_path = excluded.storage_path,
    file_name = excluded.file_name,
    size_bytes = excluded.size_bytes;

insert into public.natori_pricing_configs (
  id, user_id, preset_key, name, config, is_default, sort_order,
  created_at, updated_at
)
values (
  '60000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-000000000001',
  'fixture-default',
  'Fixture Default',
  '{"base": 10000, "currency": "JPY", "fixture": true}'::jsonb,
  true,
  10,
  '2099-01-01T00:00:00Z',
  '2099-01-01T00:00:00Z'
)
on conflict (user_id, preset_key) do update
set config = excluded.config,
    is_default = excluded.is_default,
    updated_at = excluded.updated_at;

insert into public.natori_order_mail_logs (
  project_id, kind, to_email, amount, link_url, sent_at, request_id,
  status, subject, body_snapshot, quote_id, error_message, created_at, updated_at
)
values (
  '10000000-0000-4000-8000-000000000004',
  'quote',
  'fixture-04@example.invalid',
  36000,
  null,
  '2099-01-09T00:00:00Z',
  '70000000-0000-4000-8000-000000000004',
  'sent',
  'Fixture mail',
  'Verification-only mail body',
  '20000000-0000-4000-8000-000000000004',
  null,
  '2099-01-09T00:00:00Z',
  '2099-01-09T00:00:00Z'
)
on conflict (request_id) do update
set status = excluded.status,
    sent_at = excluded.sent_at;

insert into public.processed_stripe_events (event_id, received_at)
values ('evt_test_etorie_fixture_0005', '2099-01-11T00:00:00Z')
on conflict (event_id) do update set received_at = excluded.received_at;

insert into public.natori_portfolio_content (id, content, updated_at)
values (
  'main',
  '{"fixture": true, "title": "Etorie verification portfolio"}'::jsonb,
  '2099-01-01T00:00:00Z'
)
on conflict (id) do update
set content = excluded.content,
    updated_at = excluded.updated_at;

commit;
