-- Read-only, paged saved records. No backfill, effect, role expansion or fact-limit changes.
begin;
create function public.natori_case_history_page_v1(p_owner uuid,p_project uuid,p_offset integer default 0,p_revision text default null)
returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare result jsonb;
begin
 if p_offset<0 or (p_offset>0 and p_revision is null) then raise exception 'history_cursor_invalid';end if;
 with owned as materialized (select * from public.natori_projects where id=p_project and user_id=p_owner),
 raw as materialized (
 select 'activity'::text as source,coalesce(d->>'id',d->>'operation_id',d->>'rough_id')||coalesce('/'||(d->>'sender'),'') as record_id,coalesce(d->>'occurred_at',d->>'received_at',d->>'published_at',d->>'created_at',d->>'acknowledged_at')::timestamptz as at,d from public.natori_project_activity t join owned p on t.project_id=p.id cross join lateral (select to_jsonb(t) as d) j where true and t.user_id=p.user_id
 union all
 select 'quote'::text as source,coalesce(d->>'id',d->>'operation_id',d->>'rough_id')||coalesce('/'||(d->>'sender'),'') as record_id,coalesce(d->>'occurred_at',d->>'received_at',d->>'published_at',d->>'created_at',d->>'acknowledged_at')::timestamptz as at,d from public.natori_quotes t join owned p on t.project_id=p.id cross join lateral (select to_jsonb(t) as d) j where true and t.user_id=p.user_id
 union all
 select 'payment'::text as source,coalesce(d->>'id',d->>'operation_id',d->>'rough_id')||coalesce('/'||(d->>'sender'),'') as record_id,coalesce(d->>'occurred_at',d->>'received_at',d->>'published_at',d->>'created_at',d->>'acknowledged_at')::timestamptz as at,d from public.natori_payment_transactions t join owned p on t.project_id=p.id cross join lateral (select to_jsonb(t) as d) j where true
 union all
 select 'refund'::text as source,coalesce(d->>'id',d->>'operation_id',d->>'rough_id')||coalesce('/'||(d->>'sender'),'') as record_id,coalesce(d->>'occurred_at',d->>'received_at',d->>'published_at',d->>'created_at',d->>'acknowledged_at')::timestamptz as at,d from public.natori_refund_ledger t join owned p on t.project_id=p.id cross join lateral (select to_jsonb(t) as d) j where true and t.owner_id=p.user_id
 union all
 select 'notice'::text as source,coalesce(d->>'id',d->>'operation_id',d->>'rough_id')||coalesce('/'||(d->>'sender'),'') as record_id,coalesce(d->>'occurred_at',d->>'received_at',d->>'published_at',d->>'created_at',d->>'acknowledged_at')::timestamptz as at,d from public.natori_notification_jobs t join owned p on t.project_id=p.id cross join lateral (select to_jsonb(t) as d) j where true
 union all
 select 'legacy-mail'::text as source,coalesce(d->>'id',d->>'operation_id',d->>'rough_id')||coalesce('/'||(d->>'sender'),'') as record_id,coalesce(d->>'occurred_at',d->>'received_at',d->>'published_at',d->>'created_at',d->>'acknowledged_at')::timestamptz as at,d from public.natori_order_mail_logs t join owned p on t.project_id=p.id cross join lateral (select to_jsonb(t) as d) j where true
 union all
 select 'link'::text as source,coalesce(d->>'id',d->>'operation_id',d->>'rough_id')||coalesce('/'||(d->>'sender'),'') as record_id,coalesce(d->>'occurred_at',d->>'received_at',d->>'published_at',d->>'created_at',d->>'acknowledged_at')::timestamptz as at,d from public.natori_payment_link_attempts t join owned p on t.project_id=p.id cross join lateral (select to_jsonb(t) as d) j where true and t.owner_id=p.user_id
 union all
 select 'link-operation'::text as source,coalesce(d->>'id',d->>'operation_id',d->>'rough_id')||coalesce('/'||(d->>'sender'),'') as record_id,coalesce(d->>'occurred_at',d->>'received_at',d->>'published_at',d->>'created_at',d->>'acknowledged_at')::timestamptz as at,d from public.natori_payment_link_operations t join owned p on t.project_id=p.id cross join lateral (select to_jsonb(t) as d) j where true
 union all
 select 'link-stop'::text as source,coalesce(d->>'id',d->>'operation_id',d->>'rough_id')||coalesce('/'||(d->>'sender'),'') as record_id,coalesce(d->>'occurred_at',d->>'received_at',d->>'published_at',d->>'created_at',d->>'acknowledged_at')::timestamptz as at,d from public.natori_payment_link_stops t join owned p on t.project_id=p.id cross join lateral (select to_jsonb(t) as d) j where true and t.owner_id=p.user_id
 union all
 select 'quote-operation'::text as source,coalesce(d->>'id',d->>'operation_id',d->>'rough_id')||coalesce('/'||(d->>'sender'),'') as record_id,coalesce(d->>'occurred_at',d->>'received_at',d->>'published_at',d->>'created_at',d->>'acknowledged_at')::timestamptz as at,d from public.natori_quote_issue_operations t join owned p on t.project_id=p.id cross join lateral (select to_jsonb(t) as d) j where true
 union all
 select 'work-record'::text as source,coalesce(d->>'id',d->>'operation_id',d->>'rough_id')||coalesce('/'||(d->>'sender'),'') as record_id,coalesce(d->>'occurred_at',d->>'received_at',d->>'published_at',d->>'created_at',d->>'acknowledged_at')::timestamptz as at,d from public.natori_case_work_records t join owned p on t.project_id=p.id cross join lateral (select to_jsonb(t) as d) j where true and t.owner_id=p.user_id
 union all
 select 'admin-operation'::text as source,coalesce(d->>'id',d->>'operation_id',d->>'rough_id')||coalesce('/'||(d->>'sender'),'') as record_id,coalesce(d->>'occurred_at',d->>'received_at',d->>'published_at',d->>'created_at',d->>'acknowledged_at')::timestamptz as at,d from public.natori_case_admin_operations t join owned p on t.project_id=p.id cross join lateral (select to_jsonb(t) as d) j where true and t.owner_id=p.user_id
 union all
 select 'message'::text as source,coalesce(d->>'id',d->>'operation_id',d->>'rough_id')||coalesce('/'||(d->>'sender'),'') as record_id,coalesce(d->>'occurred_at',d->>'received_at',d->>'published_at',d->>'created_at',d->>'acknowledged_at')::timestamptz as at,d from public.natori_consultation_messages t join owned p on t.project_id=p.id cross join lateral (select to_jsonb(t) as d) j where true
 union all
 select 'consultation-operation'::text as source,coalesce(d->>'id',d->>'operation_id',d->>'rough_id')||coalesce('/'||(d->>'sender'),'') as record_id,coalesce(d->>'occurred_at',d->>'received_at',d->>'published_at',d->>'created_at',d->>'acknowledged_at')::timestamptz as at,d from public.natori_consultation_operations t join owned p on t.project_id=p.id cross join lateral (select to_jsonb(t) as d) j where true
 union all
 select 'rough'::text as source,coalesce(d->>'id',d->>'operation_id',d->>'rough_id')||coalesce('/'||(d->>'sender'),'') as record_id,coalesce(d->>'occurred_at',d->>'received_at',d->>'published_at',d->>'created_at',d->>'acknowledged_at')::timestamptz as at,d from public.natori_talk_roughs t join owned p on t.project_id=p.id cross join lateral (select to_jsonb(t) as d) j where true
 union all
 select 'rough-ok'::text as source,coalesce(d->>'id',d->>'operation_id',d->>'rough_id')||coalesce('/'||(d->>'sender'),'') as record_id,coalesce(d->>'occurred_at',d->>'received_at',d->>'published_at',d->>'created_at',d->>'acknowledged_at')::timestamptz as at,d from public.natori_rough_ok_events t join owned p on t.project_id=p.id cross join lateral (select to_jsonb(t) as d) j where true
 union all
 select 'rough-ack'::text as source,coalesce(d->>'id',d->>'operation_id',d->>'rough_id')||coalesce('/'||(d->>'sender'),'') as record_id,coalesce(d->>'occurred_at',d->>'received_at',d->>'published_at',d->>'created_at',d->>'acknowledged_at')::timestamptz as at,d from public.natori_rough_ok_acknowledgements t join owned p on t.project_id=p.id cross join lateral (select to_jsonb(t) as d) j where true and t.owner_id=p.user_id
 union all
 select 'release'::text as source,coalesce(d->>'id',d->>'operation_id',d->>'rough_id')||coalesce('/'||(d->>'sender'),'') as record_id,coalesce(d->>'occurred_at',d->>'received_at',d->>'published_at',d->>'created_at',d->>'acknowledged_at')::timestamptz as at,d from public.natori_delivery_releases t join owned p on t.project_id=p.id cross join lateral (select to_jsonb(t) as d) j where true
 union all
 select 'delivery-operation'::text as source,coalesce(d->>'id',d->>'operation_id',d->>'rough_id')||coalesce('/'||(d->>'sender'),'') as record_id,coalesce(d->>'occurred_at',d->>'received_at',d->>'published_at',d->>'created_at',d->>'acknowledged_at')::timestamptz as at,d from public.natori_delivery_operations t join owned p on t.project_id=p.id cross join lateral (select to_jsonb(t) as d) j where true
 union all
 select 'extension'::text as source,coalesce(d->>'id',d->>'operation_id',d->>'rough_id')||coalesce('/'||(d->>'sender'),'') as record_id,coalesce(d->>'occurred_at',d->>'received_at',d->>'published_at',d->>'created_at',d->>'acknowledged_at')::timestamptz as at,d from public.natori_delivery_extensions t join owned p on t.project_id=p.id cross join lateral (select to_jsonb(t) as d) j where true
 union all
 select 'reconciliation-job'::text as source,coalesce(d->>'id',d->>'operation_id',d->>'rough_id')||coalesce('/'||(d->>'sender'),'') as record_id,coalesce(d->>'occurred_at',d->>'received_at',d->>'published_at',d->>'created_at',d->>'acknowledged_at')::timestamptz as at,d from public.natori_case_reconciliation_jobs t join owned p on t.project_id=p.id cross join lateral (select to_jsonb(t) as d) j where true and t.owner_id=p.user_id
 union all
 select 'resolution'::text as source,coalesce(d->>'id',d->>'operation_id',d->>'rough_id')||coalesce('/'||(d->>'sender'),'') as record_id,coalesce(d->>'occurred_at',d->>'received_at',d->>'published_at',d->>'created_at',d->>'acknowledged_at')::timestamptz as at,d from public.natori_case_reconciliation_resolutions t join owned p on t.project_id=p.id cross join lateral (select to_jsonb(t) as d) j where true and t.owner_id=p.user_id
 union all
 select 'stripe-inbox'::text as source,md5(jsonb_build_array(d->>'account_scope',d->>'livemode',d->>'event_id')::text) as record_id,coalesce(d->>'occurred_at',d->>'received_at',d->>'published_at',d->>'created_at',d->>'acknowledged_at')::timestamptz as at,d from public.natori_stripe_event_inbox t join owned p on t.project_id=p.id cross join lateral (select to_jsonb(t) as d) j where true and t.owner_id=p.user_id
 union all
 select 'evidence',e.id::text,e.created_at,to_jsonb(e)-'facts'-'evidence_hash' from public.natori_case_reconciliation_evidence e join public.natori_case_reconciliation_jobs j on j.id=e.job_id join owned p on p.id=j.project_id and p.user_id=j.owner_id
 ), events as materialized (
 select r.source||'/'||r.record_id as id,r.at,jsonb_build_object(
  'id',r.source||'/'||r.record_id,'source',r.source,'recordId',r.record_id,'occurredAt',r.at,
  'state',coalesce(d->>'status',d->>'provider_status',d->>'state',d->'response'->>'result'),
  'kind',coalesce(d->>'event_type',d->>'action',d->>'command',d->>'kind',d->>'purpose',d->>'sender'),
  'quoteId',coalesce(d->>'quote_id',case when r.source='quote' then r.record_id end),'quoteVersion',q.version,
  'quoteMatched',case when d->>'quote_id' is null and r.source<>'quote' then null else q.id is not null end,
  'amount',d->'amount','currency',coalesce(d->>'currency',d->>'stripe_currency'),
  'relatedId',coalesce(d->>'transaction_id',d->>'release_id',d->>'attempt_id',d->>'job_id',d->>'notification_id',d->>'source_id',d->>'message_id'),
  'operatorKind',d->'operator'->>'kind','origin',d->'data'->>'origin','legacy',d->'legacy',
  'acceptedAt',d->>'accepted_at','sentAt',d->>'sent_at','receivedAt',d->>'received_at',
  'confirmedAt',d->>'confirmed_at','expiresAt',coalesce(d->>'expires_at',d->>'new_expires_at'),
  'retentionState',d->'workspace_guard'->'receiptRetention'->>'state',
  'reason',coalesce(d->>'review_reason',d->>'error_code')) as value
 from raw r cross join owned p left join public.natori_quotes q on q.id::text=coalesce(r.d->>'quote_id',case when r.source='quote' then r.record_id end) and q.project_id=p.id and q.user_id=p.user_id
 ), catalogue as (select count(*) as total,md5(jsonb_build_array(
  (select jsonb_build_array(p.id,p.updated_at,p.note,p.payment_confirmed_at,p.paid_at,p.paid_amount,p.delivery_accepted_at,public.natori_case_reconciliation_revision_v1(p.id)) from owned p),
  coalesce(jsonb_agg(value order by id),'[]'::jsonb))::text) as revision from events)
 select jsonb_build_object('ownerId',p.user_id,'projectId',p.id,'revision',c.revision,'total',c.total,'offset',p_offset,
  'changed',p_revision is not null and p_revision<>c.revision,
  'next',case when p_offset+50<c.total then p_offset+50 else null end,
  'observedAt',statement_timestamp(),
  'rows',case when p_revision is not null and p_revision<>c.revision then '[]'::jsonb else
   coalesce((select jsonb_agg(value order by at desc nulls last,id) from (select * from events order by at desc nulls last,id offset p_offset limit 50) page),'[]'::jsonb) end,
  'counts',(select coalesce(jsonb_object_agg(source,n),'{}'::jsonb) from (select source,count(*) n from raw group by source) counts),
  'legacyEntries',case when p_offset=0 then coalesce((select jsonb_agg(jsonb_build_object('dateISO',m[2],'label',case when m[1] in ('見積もりメール送信','支払い依頼メール送信','ラフ提出メール送信','納品メール送信','Stripe入金') then m[1] else '旧メモの記録' end)) from regexp_matches(coalesce(p.note,''),'【([^【】]+) ([0-9]{4}-[0-9]{2}-[0-9]{2})】','g') m),'[]'::jsonb) else '[]'::jsonb end,
  'snapshot',case when p_offset=0 then (select s from public.natori_case_snapshot_v1(p.id,p.user_id) s) else null end,
  'refundSummary',case when p_offset=0 then (select summary from public.natori_refund_summaries_v1(p.user_id,array[p.id])) else null end)
 into result from owned p cross join catalogue c;
 return result;
end $$;
revoke all on function public.natori_case_history_page_v1(uuid,uuid,integer,text) from public,anon,authenticated;
grant execute on function public.natori_case_history_page_v1(uuid,uuid,integer,text) to service_role;
commit;
