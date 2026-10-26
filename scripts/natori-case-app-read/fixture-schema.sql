-- Reduced schema made from the reader's selected columns, never a production dump.
-- It verifies the read contract only; it does not replay or certify migrations/writers.
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create table natori_projects (
 id uuid primary key,user_id uuid,title text,client_name text,due_date date,status text,type text,amount bigint,
 active_quote_id uuid,quote_accepted_at timestamptz,quote_accepted_amount bigint,payment_confirmed_at timestamptz,
 paid_amount bigint,paid_at timestamptz,delivery_accepted_at timestamptz,completed_at timestamptz,delivered_mail_at timestamptz,
 payment_link_id text,payment_link_url text,payment_link_status text,stripe_payment_session_id text,
 deleted_at timestamptz,created_at timestamptz,updated_at timestamptz
);
create table natori_case_work_records(id uuid,project_id uuid,owner_id uuid,kind text,data jsonb,created_at timestamptz);
create table natori_intake_operations(operation_id uuid,project_id uuid,owner_id uuid,status text,created_at timestamptz,updated_at timestamptz);
create table natori_quotes(id uuid,project_id uuid,user_id uuid,version int,amount bigint,expires_at timestamptz,accepted_at timestamptz,superseded_at timestamptz,created_at timestamptz,issued_at timestamptz);
create table natori_estimate_drafts(project_id uuid,user_id uuid,revision bigint,updated_at timestamptz);
create table natori_payment_link_attempts(id uuid,project_id uuid,owner_id uuid,quote_id uuid,generation int,amount bigint,state text,deadline timestamptz,deadline_revision bigint,created_at timestamptz,updated_at timestamptz,link_id text,link_url text);
create table natori_payment_transactions(id uuid,project_id uuid,quote_id uuid,amount bigint,status text,received_at timestamptz,stripe_currency text,stripe_session_id text,note text,stripe_account_scope text,stripe_livemode boolean,stripe_payment_intent_id text,stripe_charge_id text);
create table natori_stripe_event_inbox(account_scope text,livemode boolean,event_id text,project_id uuid,owner_id uuid,status text,created_at timestamptz,updated_at timestamptz,request jsonb,error_code text);
create table natori_refund_ledger(id uuid,project_id uuid,owner_id uuid,transaction_id uuid,amount bigint,currency text,provider_status text,resolution text,confirmed_at timestamptz,created_at timestamptz,updated_at timestamptz,claimed_project_id uuid);
create table natori_notification_jobs(case_work_guard text,id uuid,project_id uuid,quote_id uuid,notification_key text,attempt_no int,purpose text,status text,sent_at timestamptz,created_at timestamptz,updated_at timestamptz,snapshot jsonb);
create table natori_delivery_releases(id uuid,project_id uuid,revision bigint,published_at timestamptz,expires_at timestamptz,accepted_at timestamptz,legacy boolean,manifest jsonb);
create table natori_consultation_messages(id uuid,project_id uuid,sender text,created_at timestamptz,operation_id uuid);
create table natori_rough_ok_events(project_id uuid,rough_id uuid,client_ok_at timestamptz);
create table natori_order_mail_logs(id uuid,project_id uuid,quote_id uuid,kind text,amount bigint,status text,sent_at timestamptz,created_at timestamptz,updated_at timestamptz,link_url text);
create table natori_quote_issue_operations(operation_id uuid,project_id uuid,quote_id uuid,notification_id uuid,created_at timestamptz);
create table natori_case_reconciliation_resolutions(id uuid,project_id uuid,target_id uuid,kind text,created_at timestamptz);
create table natori_payment_link_operations(reconciliation_id uuid,operation_id uuid,project_id uuid,attempt_id uuid,action text,status text,proposed_deadline timestamptz,expected_revision bigint,notification_id uuid,created_at timestamptz);
create table natori_payment_link_stops(id uuid,project_id uuid,owner_id uuid,attempt_id uuid,deadline_revision bigint,status text,created_at timestamptz,updated_at timestamptz);
create table natori_delivery_operations(operation_id uuid,project_id uuid,release_id uuid,notification_id uuid,created_at timestamptz);
create table natori_delivery_extensions(id uuid,project_id uuid,release_id uuid,operation_id uuid,previous_expires_at timestamptz,new_expires_at timestamptz,created_at timestamptz);
create table natori_consultation_operations(operation_id uuid,project_id uuid,sender text,status text,message_id uuid,notification_id uuid,created_at timestamptz);
create table natori_project_tasks(id uuid,project_id uuid,task_key text,stage text,done boolean,sort_order int);
create table natori_delivery_files(id uuid,project_id uuid,folder text,state text,size_bytes bigint,storage_version text,verified_at timestamptz,deleted_at timestamptz,created_at timestamptz,content_type text,storage_path text,file_name text);
create table natori_talk_roughs(id uuid,project_id uuid,message_id uuid,before_quote boolean,created_at timestamptz,client_ok_at timestamptz);
create table natori_rough_ok_acknowledgements(rough_id uuid,project_id uuid,owner_id uuid,client_ok_at timestamptz,acknowledged_at timestamptz);
grant usage on schema public to anon,authenticated,service_role;
grant select on all tables in schema public to service_role;
do $$declare target record;begin
 for target in select tablename from pg_tables where schemaname='public' loop
  execute format('alter table public.%I enable row level security',target.tablename);
 end loop;
end$$;
