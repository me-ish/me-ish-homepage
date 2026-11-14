#!/usr/bin/env bash
# 匿名化の SQL 案（まだ本番にも supabase/migrations にも入れていない）を、架空のデータで確かめる。
# Usage: PSQL_BASE="psql -h <socket dir> -U postgres" scripts/natori-case-anonymize/verify-sql.sh [draft.sql]
# 案の既定の場所は docs/natori/drafts/natori_case_anonymize_draft.sql。
# 使い捨ての DB を作り、有効なマイグレーションをすべて流してから案を流す。実在のデータは使わない。
set -euo pipefail
ROOT=$(cd "$(dirname "$0")/../.." && pwd)
DRAFT=${1:-$ROOT/docs/natori/drafts/natori_case_anonymize_draft.sql}
DB="natori_case_anon_$$"
PSQL_BASE=${PSQL_BASE:-psql}
P="$PSQL_BASE -X -q -At -v ON_ERROR_STOP=1"
$P -d postgres -c "create database $DB" >/dev/null
trap '$P -d postgres -c "drop database if exists $DB" >/dev/null' EXIT
q(){ $P -d "$DB" -c "$1"; }
fails=0
ok(){ if [ "$2" = "$3" ]; then echo "ok   $1"; else echo "FAIL $1: expected [$3] got [$2]"; fails=$((fails+1)); fi; }
rejects(){ if $PSQL_BASE -X -q -At -v ON_ERROR_STOP=1 -d "$DB" -c "$2" >/dev/null 2>&1; then echo "FAIL $1: accepted"; fails=$((fails+1)); else echo "ok   $1"; fi; }
q "do \$\$begin if not exists(select 1 from pg_roles where rolname='anon') then create role anon nologin;end if;if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin;end if;if not exists(select 1 from pg_roles where rolname='service_role') then create role service_role nologin bypassrls;end if;end\$\$" >/dev/null
$P -d "$DB" -f "$ROOT/scripts/legacy-entry-read-security/fresh-bootstrap.sql" >/dev/null 2>&1
for f in $(python3 -c "import json,sys;print(' '.join(json.load(open(sys.argv[1]))['activeMigrations']))" "$ROOT/supabase/baseline/manifest.json"); do
  $P -d "$DB" -f "$ROOT/$f" >/dev/null 2>&1
done
$P -d "$DB" -f "$DRAFT" >/dev/null
echo "ok   migrations and draft applied"
ok "guard ledger has no drift" "$(q "select count(*) from natori_case_guard.dependencies d full join natori_case_guard.images() i using(kind,identity) where d.image is distinct from i.image")" "0"

OWNER=22222222-2222-4222-8222-222222222222
OLD=a0000000-0000-4000-8000-000000000001   # 100 日前に完了
NEW=a0000000-0000-4000-8000-000000000002   # 10 日前に完了
OPEN=a0000000-0000-4000-8000-000000000003  # 制作中
REQ='{"schemaVersion":1,"formVersion":"natori-portfolio-v1","inquiryMode":"quote","requestType":"icon","requestTypeOther":null,"commissionScope":"bust_up","commissionScopeOther":null,"options":[],"usageTypes":["sns_icon"],"usageTypeOther":null,"commercialUse":"none","publicationPolicy":"delayed","publicationAllowedFrom":"2026-12-01","budget":{"kind":"undecided","min":null,"max":null,"currency":"JPY"},"deadline":{"kind":"standard","date":null,"note":"誕生日までに"},"characterFeatures":"銀髪で猫耳","expressionMood":"にこにこ","composition":"正面","colorDirection":"水色","referenceNotes":"資料は X にあります","message":"架空花子です。よろしくお願いします。","legacySource":null}'
# 種まきは守りの仕組みを通さずに入れる（架空の過去データを作るため）。確かめる操作は守りを有効にして行う。
$P -d "$DB" >/dev/null <<SQL
set session_replication_role=replica;
insert into auth.users(id) values('$OWNER');
insert into public.natori_projects(id,user_id,title,client_name,client_email,status,type,amount,next_action,delivery_plan,note,request_data,completed_at,created_at,updated_at) values
 ('$OLD','$OWNER','アイコン / 架空花子','架空花子','hanako@example.test','completed','icon',4000,'-','normal','花子さんは夜に返信が多い','$REQ',now()-interval '100 days',now()-interval '140 days',now()-interval '100 days'),
 ('$NEW','$OWNER','SD / 架空太郎','架空太郎','taro@example.test','completed','sd',3000,'-','normal',null,null,now()-interval '10 days',now()-interval '40 days',now()-interval '10 days'),
 ('$OPEN','$OWNER','立ち絵 / 架空次郎','架空次郎','jiro@example.test','rough','standing',10000,'-','normal',null,null,null,now()-interval '200 days',now()-interval '150 days');
insert into public.natori_quotes(id,project_id,user_id,version,title,client_name,to_email,amount,subject,body_snapshot,token_hash,expires_at,request_snapshot,pricing_snapshot,quote_terms,accepted_at,issued_at)
 values('b0000000-0000-4000-8000-000000000001','$OLD','$OWNER',1,'アイコン / 架空花子','架空花子','hanako@example.test',4000,'【ナトリ】お見積もり','架空花子 様 お見積もりは 4,000 円です。','h1',now()-interval '100 days','$REQ','{"schemaVersion":1,"total":4000}','{"scope":"胸上","deliverables":"PNG 1 枚","dueDate":"2026-08-01"}',now()-interval '130 days',now()-interval '131 days');
insert into public.natori_order_mail_logs(id,project_id,kind,to_email,amount,request_id,status,subject,body_snapshot,link_url) overriding system value values
 (9001,'$OLD','estimate','hanako@example.test',4000,gen_random_uuid(),'sent','【ナトリ】お見積もり','見積の本文','https://example.test/q/abc'),
 (9002,'$OLD','payment','hanako@example.test',4000,gen_random_uuid(),'sent','【ナトリ】お支払いのご案内','支払いの本文','https://example.test/p/abc'),
 (9003,'$OLD','delivery','hanako@example.test',4000,gen_random_uuid(),'sent','【ナトリ】納品のご案内','納品の本文 架空花子 様','https://example.test/d/abc');
insert into public.natori_notification_jobs(id,notification_key,project_id,purpose,snapshot,payload,status,sent_at,provider_id) values
 ('c0000000-0000-4000-8000-000000000001','k1','$OLD','intake_client','{"clientEmail":"hanako@example.test","clientName":"架空花子","title":"アイコン / 架空花子","requestData":{"message":"x"},"referenceLinkUrls":["https://example.test/ref"],"receipt":"R1"}','{"to":["hanako@example.test"],"subject":"受付","text":"架空花子 様","from":"n@example.test"}','sent',now()-interval '139 days','re_test'),
 ('c0000000-0000-4000-8000-000000000002','k2','$OLD','payment_link_client','{"clientEmail":"hanako@example.test","amount":4000}','{"to":["hanako@example.test"],"subject":"お支払い","text":"4,000 円","from":"n@example.test"}','sent',now()-interval '129 days','re_test'),
 ('c0000000-0000-4000-8000-000000000003','k3','$OLD','delivery_issue_client','{"clientEmail":"hanako@example.test","releaseId":"d0000000-0000-4000-8000-000000000001"}','{"format":"natori-delivery-aes256gcm-v1","ciphertext":"AAAA","iv":"BB","tag":"CC","expiresAt":"2026-08-01T00:00:00Z"}','sent',now()-interval '110 days','re_test'),
 ('c0000000-0000-4000-8000-000000000004','k4','$OPEN','intake_client','{"clientEmail":"jiro@example.test","clientName":"架空次郎"}','{"to":["jiro@example.test"],"text":"x"}','sent',now()-interval '199 days','re_test');
insert into public.natori_delivery_files(id,project_id,folder,storage_path,file_name) values('e0000000-0000-4000-8000-000000000001','$OLD','final','$OLD/final/hanako.png','hanako.png');
insert into public.natori_delivery_releases(id,project_id,manifest,snapshot,expires_at,accepted_at) values('d0000000-0000-4000-8000-000000000001','$OLD','[{"id":"e0000000-0000-4000-8000-000000000001"}]','{"clientEmail":"hanako@example.test","clientName":"架空花子","title":"アイコン / 架空花子"}',now()-interval '80 days',now()-interval '100 days');
insert into public.natori_delivery_access(token_hash,release_id,expires_at) values(repeat('d',64),'d0000000-0000-4000-8000-000000000001',now()-interval '80 days');
insert into public.natori_quote_access(token_hash,quote_id,expires_at) values(repeat('e',64),'b0000000-0000-4000-8000-000000000001',now()-interval '100 days');
insert into public.natori_consultation_access(project_id,token_hash,expires_at) values('$OLD',repeat('c',64),now()+interval '5 days');
insert into public.natori_consultation_messages(id,project_id,sender,body) values('f0000000-0000-4000-8000-000000000001','$OLD','client','架空花子です。本名は内緒でお願いします。');
insert into public.natori_consultation_operations(project_id,sender,operation_id,request_hash,body,manifest,status,message_id,notification_id,notice_payload) values('$OLD','client',gen_random_uuid(),repeat('a',64),'架空花子です。','[{"name":"hanako-ref.png"}]','committed','f0000000-0000-4000-8000-000000000001','c0000000-0000-4000-8000-000000000001','{"format":"x","ciphertext":"ZZ","iv":"I","tag":"T","expiresAt":"2026-08-01T00:00:00Z"}');
insert into public.natori_consultation_files(project_id,message_id,storage_path,file_name,mime_type,size_bytes) values('$OLD','f0000000-0000-4000-8000-000000000001','$OLD/m1/a.png','hanako-ref.png','image/png',10);
insert into public.natori_consultation_uploads(project_id,sender,storage_path,file_name,mime_type,size_bytes) values('$OLD','client','$OLD/m1/a.png','hanako-ref.png','image/png',10),('$OLD','client','$OLD/m1/unused.png','unused.png','image/png',10);
insert into public.natori_talk_roughs(id,project_id,message_id,before_quote,client_ok_at) values(gen_random_uuid(),'$OLD','f0000000-0000-4000-8000-000000000001',false,now()-interval '120 days');
insert into public.natori_inquiry_reference_files(project_id,storage_path) values('$OLD','$OLD/ref/1.png');
insert into public.natori_project_reference_links(project_id,url,normalized_url) values('$OLD','https://example.test/hanako','https://example.test/hanako');
insert into public.natori_estimate_drafts(project_id,user_id,agreed_terms,items,mail_draft) values('$OLD','$OWNER','{"memo":"花子さん"}','[]','{"to":"hanako@example.test"}');
insert into public.natori_case_items(project_id,position,title,project_type,amount,publication_policy,publication_allowed_from,note) values('$OLD',1,'アイコン','icon',4000,'delayed','2026-12-01','花子さんの猫');
insert into public.natori_payment_transactions(project_id,amount,status,received_at,stripe_payment_intent_id) values('$OLD',4000,'received',now()-interval '128 days','pi_test_1');
SQL
echo "ok   fictional rows seeded"
call(){ q "select public.natori_case_anonymize_v1('$OWNER','$1','$2'::jsonb)->>'result'"; }
SCHED='{"kind":"scheduled","operator":{"kind":"schedule"}}'
MANUAL='{"kind":"manual","operator":{"kind":"auth-user","userId":"'$OWNER'"}}'

# 守りは今まで通り効いている（匿名化の関数の外では書き換えられない）
rejects "notification snapshot stays immutable outside the function" "update public.natori_notification_jobs set snapshot='{}' where id='c0000000-0000-4000-8000-000000000001'"
rejects "delivery snapshot stays immutable outside the function" "update public.natori_delivery_releases set snapshot='{}' where project_id='$OLD'"
rejects "quote address stays immutable outside the function" "update public.natori_quotes set to_email='' where project_id='$OLD'"

ok "wrong owner is not found" "$(q "select public.natori_case_anonymize_v1('33333333-3333-4333-8333-333333333333','$OLD','$SCHED'::jsonb)->>'result'")" "not-found"
ok "unknown input key is invalid" "$(call $OLD '{"kind":"manual","operator":{"kind":"auth-user"},"days":1}')" "invalid"
ok "scheduled run must come from the schedule" "$(call $OLD '{"kind":"scheduled","operator":{"kind":"auth-user"}}')" "invalid"
ok "case in production is not eligible" "$(call $OPEN "$MANUAL")" "not-eligible"
ok "scheduled run waits 90 days" "$(call $NEW "$SCHED")" "too-early"
q "set session_replication_role=replica; update public.natori_notification_jobs set status='sending',claim_token=gen_random_uuid(),lease_expires_at=now() where id='c0000000-0000-4000-8000-000000000002'" >/dev/null
ok "unfinished notification blocks" "$(call $OLD "$SCHED")" "busy"
q "set session_replication_role=replica; update public.natori_notification_jobs set status='sent' where id='c0000000-0000-4000-8000-000000000002'" >/dev/null
ok "nothing changed by refused calls" "$(q "select client_email from public.natori_projects where id='$OLD'")" "hanako@example.test"

ok "old completed case is anonymized" "$(call $OLD "$SCHED")" "applied"
LABEL=$(q "select label from public.natori_case_anonymizations where project_id='$OLD'")
ok "label is a receipt number" "$(q "select '$LABEL' ~ '^依頼者 #[0-9A-F]{8}\$'")" "t"
ok "project name, mail, note" "$(q "select client_name||'|'||coalesce(client_email,'null')||'|'||coalesce(note,'null') from public.natori_projects where id='$OLD'")" "$LABEL|null|null"
ok "project title carries the label" "$(q "select title from public.natori_projects where id='$OLD'")" "アイコン / $LABEL"
ok "free text removed from the request" "$(q "select request_data->>'message'||'|'||(request_data->>'characterFeatures')||'|'||(request_data->>'referenceNotes')||'|'||(request_data#>>'{deadline,note}') from public.natori_projects where id='$OLD'")" "（匿名化済み）|||"
ok "choices kept in the request" "$(q "select request_data->>'requestType'||'|'||(request_data->>'publicationPolicy')||'|'||(request_data->>'publicationAllowedFrom')||'|'||(request_data#>>'{deadline,kind}') from public.natori_projects where id='$OLD'")" "icon|delayed|2026-12-01|standard"
ok "money and dates kept" "$(q "select amount||'|'||status||'|'||(completed_at is not null) from public.natori_projects where id='$OLD'")" "4000|completed|true"
ok "quote keeps addressee, amount, body, terms" "$(q "select client_name||'|'||amount||'|'||body_snapshot||'|'||(quote_terms->>'scope')||'|'||(accepted_at is not null) from public.natori_quotes where project_id='$OLD'")" "架空花子|4000|架空花子 様 お見積もりは 4,000 円です。|胸上|true"
ok "quote loses address and request text" "$(q "select to_email||'|'||(request_snapshot->>'message') from public.natori_quotes where project_id='$OLD'")" "|（匿名化済み）"
ok "estimate and payment mails keep body" "$(q "select string_agg(kind||':'||body_snapshot,',' order by id) from public.natori_order_mail_logs where project_id='$OLD' and kind in ('estimate','payment')")" "estimate:見積の本文,payment:支払いの本文"
ok "other mails lose body" "$(q "select subject||'|'||body_snapshot from public.natori_order_mail_logs where id=9003")" "（匿名化済み）|"
ok "no mail log keeps an address or link" "$(q "select count(*) from public.natori_order_mail_logs where project_id='$OLD' and (to_email<>'' or link_url is not null)")" "0"
ok "no personal data left in notifications" "$(q "select count(*) from public.natori_notification_jobs where project_id='$OLD' and (snapshot::text||coalesce(payload::text,'')) ~ 'hanako|架空花子|example.test/ref'")" "0"
ok "payment notice keeps its text" "$(q "select payload->>'text' from public.natori_notification_jobs where id='c0000000-0000-4000-8000-000000000002'")" "4,000 円"
ok "encrypted delivery notice is emptied" "$(q "select payload->>'ciphertext'||'|'||(payload->>'purged') from public.natori_notification_jobs where id='c0000000-0000-4000-8000-000000000003'")" "|true"
ok "notification facts kept" "$(q "select string_agg(status,',' order by id)||'|'||count(sent_at) from public.natori_notification_jobs where project_id='$OLD'")" "sent,sent,sent|3"
ok "delivery record keeps acceptance, loses contact" "$(q "select (accepted_at is not null)||'|'||(snapshot ? 'clientEmail')||'|'||(snapshot->>'clientName') from public.natori_delivery_releases where project_id='$OLD'")" "true|false|$LABEL"
ok "talk messages emptied, rows kept" "$(q "select count(*)||'|'||min(body) from public.natori_consultation_messages where project_id='$OLD'")" "1|（匿名化済み）"
ok "talk operations emptied" "$(q "select body||'|'||manifest::text||'|'||(notice_payload->>'ciphertext') from public.natori_consultation_operations where project_id='$OLD'")" "|[]|"
ok "file names removed" "$(q "select (select count(*) from public.natori_consultation_files where project_id='$OLD' and file_name<>'file')+(select count(*) from public.natori_consultation_uploads where project_id='$OLD' and file_name<>'file')")" "0"
ok "rough OK fact kept" "$(q "select count(*) from public.natori_talk_roughs where project_id='$OLD' and client_ok_at is not null")" "1"
ok "links, draft, tokens removed" "$(q "select (select count(*) from public.natori_project_reference_links where project_id='$OLD')+(select count(*) from public.natori_estimate_drafts where project_id='$OLD')+(select count(*) from public.natori_consultation_access where project_id='$OLD')+(select count(*) from public.natori_quote_access)+(select count(*) from public.natori_delivery_access)")" "0"
ok "item kept for the portfolio gate, note removed" "$(q "select title||'|'||amount||'|'||publication_policy||'|'||publication_allowed_from||'|'||coalesce(note,'null') from public.natori_case_items where project_id='$OLD'")" "アイコン|4000|delayed|2026-12-01|null"
ok "payment kept" "$(q "select amount||'|'||stripe_payment_intent_id from public.natori_payment_transactions where project_id='$OLD'")" "4000|pi_test_1"
ok "files to delete are listed once each" "$(q "select string_agg(o->>'bucket'||':'||(o->>'path'),',' order by o->>'bucket',o->>'path') from public.natori_case_anonymizations a, jsonb_array_elements(a.storage_objects) o where a.project_id='$OLD'")" "natori-consultations:$OLD/m1/a.png,natori-consultations:$OLD/m1/unused.png,natori-deliveries:$OLD/final/hanako.png,natori-inquiry-refs:$OLD/ref/1.png"
ok "second call does nothing" "$(call $OLD "$MANUAL")" "already"
ok "other cases untouched" "$(q "select string_agg(client_name||':'||client_email,',' order by id) from public.natori_projects where id in ('$NEW','$OPEN')")" "架空太郎:taro@example.test,架空次郎:jiro@example.test"
ok "other case notification untouched" "$(q "select snapshot->>'clientEmail' from public.natori_notification_jobs where id='c0000000-0000-4000-8000-000000000004'")" "jiro@example.test"
ok "manual run does not wait 90 days" "$(call $NEW "$MANUAL")" "applied"
ok "no guard frame left behind" "$(q "select count(*) from natori_case_guard.frames")" "0"
ok "anon cannot call" "$(q "select has_function_privilege('anon','public.natori_case_anonymize_v1(uuid,uuid,jsonb)','execute')")" "f"
ok "authenticated cannot call" "$(q "select has_function_privilege('authenticated','public.natori_case_anonymize_v1(uuid,uuid,jsonb)','execute')")" "f"
ok "service_role can mark files as deleted" "$(q "select has_column_privilege('service_role','public.natori_case_anonymizations','storage_purged_at','update')")" "t"
ok "every guarded root still passes" "$(q "select count(*)>0 from (select natori_case_guard.check_contract(root) from (select distinct root from natori_case_guard.permissions) r) x")" "t"
ok "quote acceptance function still runs" "$(q "select public.natori_accept_quote('nope')::text like '%not-found%'")" "t"
if [ "$fails" -ne 0 ]; then echo "$fails check(s) failed"; exit 1; fi
echo "all checks passed"
