#!/usr/bin/env bash
# Synthetic PostgreSQL check for 20261101120000_natori_case_completion.sql.
# Usage: PSQL_BASE="psql -h <socket dir> -U postgres" scripts/natori-case-completion/verify-sql.sh
# Creates a throwaway database, applies every active migration, seeds fictional
# rows only, and checks the owner completion route and the unchanged PAY-01 fence.
set -euo pipefail
ROOT=$(cd "$(dirname "$0")/../.." && pwd)
DB="natori_case_completion_$$"
PSQL_BASE=${PSQL_BASE:-psql}
P="$PSQL_BASE -X -q -At -v ON_ERROR_STOP=1"
$P -d postgres -c "create database $DB" >/dev/null
trap '$P -d postgres -c "drop database if exists $DB" >/dev/null' EXIT
q(){ $P -d "$DB" -c "$1"; }
fails=0
ok(){ if [ "$2" = "$3" ]; then echo "ok   $1"; else echo "FAIL $1: expected [$3] got [$2]"; fails=$((fails+1)); fi; }
q "do \$\$begin if not exists(select 1 from pg_roles where rolname='anon') then create role anon nologin;end if;if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin;end if;if not exists(select 1 from pg_roles where rolname='service_role') then create role service_role nologin bypassrls;end if;end\$\$" >/dev/null
$P -d "$DB" -f "$ROOT/scripts/legacy-entry-read-security/fresh-bootstrap.sql" >/dev/null
# SKIP_MIGRATIONS: space-separated file names to leave out (e.g. to mirror a DB that never got one).
for f in $(python3 -c "import json,sys;print(' '.join(json.load(open(sys.argv[1]))['activeMigrations']))" "$ROOT/supabase/baseline/manifest.json"); do
  case " ${SKIP_MIGRATIONS:-} " in *" $(basename "$f") "*) echo "skip $f"; continue;; esac
  $P -d "$DB" -f "$ROOT/$f" >/dev/null
done
echo "ok   all active migrations applied"

OWNER=22222222-2222-4222-8222-222222222222; OTHER=33333333-3333-4333-8333-333333333333
EXT=a0000000-0000-4000-8000-000000000001; DEEMED=a0000000-0000-4000-8000-000000000002
LIVE=a0000000-0000-4000-8000-000000000003; FORM=a0000000-0000-4000-8000-000000000004; INTAKE=a0000000-0000-4000-8000-000000000005
q "insert into auth.users(id) values('$OWNER'),('$OTHER')"
for id in $EXT $DEEMED $LIVE $FORM $INTAKE; do
  q "insert into public.natori_projects(id,user_id,title,client_name,status,type,amount,next_action,delivery_plan,created_at,updated_at) values('$id','$OWNER','架空の案件','架空依頼者','delivery_prep','illustration',12000,'-','normal',now()-interval '60 days',now())"
done
q "update public.natori_projects set request_data='{\"schemaVersion\":1}' where id='$INTAKE'"
q "update public.natori_projects set payment_confirmed_at=now()-interval '50 days' where id in ('$DEEMED','$LIVE')"
q "insert into public.natori_delivery_releases(project_id,manifest,snapshot,published_at,expires_at) values('$DEEMED','[{\"id\":\"x\"}]','{}',now()-interval '40 days',now()-interval '10 days'),('$LIVE','[{\"id\":\"x\"}]','{}',now()-interval '5 days',now()+interval '25 days')"
q "update public.natori_projects set status='delivered' where id in ('$DEEMED','$LIVE')"
q "insert into public.natori_case_work_records(id,owner_id,project_id,kind,data,request_hash,operator) values(gen_random_uuid(),'$OWNER','$FORM','origin','{\"origin\":\"internal\",\"note\":\"x\"}','$(printf 'a%.0s' {1..64})','{\"kind\":\"auth-user\",\"userId\":null}')"

rev(){ q "select public.natori_case_work_revision_v1('$1')"; }
call(){ # owner project kind requestId [extra json]
  local extra=${5:-}
  q "begin;set local role service_role;select public.natori_case_complete_v1('$1','$2',jsonb_build_object('requestId','$4','revision','$(rev "$2")','kind','$3','note','テスト','operator',jsonb_build_object('kind','auth-user','userId',null)$extra))->>'result';commit;"
}
R1=c0000000-0000-4000-8000-000000000001; R2=c0000000-0000-4000-8000-000000000002

# PAY-01 still rejects direct completion by service_role.
out=$(q "begin;set local role service_role;update public.natori_projects set status='completed',completed_at=now() where id='$EXT';commit;" 2>&1 || true)
case "$out" in *"permission denied"*|*"requires"*) ok "direct service_role completion stays rejected" yes yes;; *) ok "direct service_role completion stays rejected" "$out" rejected;; esac
out=$(q "update public.natori_projects set status='completed',completed_at=now() where id='$EXT';" 2>&1 || true)
case "$out" in *"First completion requires customer acceptance"*) ok "direct superuser completion stays rejected by PAY-01" yes yes;; *) ok "direct superuser completion stays rejected by PAY-01" "$out" rejected;; esac

ok "other owner cannot complete" "$(call $OTHER $EXT external $R1)" not-found
ok "stale revision" "$(q "begin;set local role service_role;select public.natori_case_complete_v1('$OWNER','$EXT','{\"requestId\":\"$R1\",\"revision\":\"x\",\"kind\":\"external\",\"note\":\"n\",\"operator\":{\"kind\":\"auth-user\"}}')->>'result';commit;")" stale
ok "external rejected when a delivery page exists" "$(call $OWNER $DEEMED external $R1)" not-eligible
ok "external rejected for a case recorded as a site case" "$(call $OWNER $FORM external $R1)" not-eligible
ok "external rejected for a case that came through the site form" "$(call $OWNER $INTAKE external $R1)" not-eligible
ok "deemed rejected before expiry" "$(call $OWNER $LIVE deemed $R1)" not-expired
ok "deemed rejected without a delivery page" "$(call $OWNER $EXT deemed $R1)" not-eligible
ok "future completion date rejected" "$(call $OWNER $EXT external $R1 ",'completedAt',(now()+interval '1 day')::text")" invalid
ok "deemed may not carry a date" "$(call $OWNER $DEEMED deemed $R1 ",'completedAt',now()::text")" invalid

# Emergency stop (commands held) blocks completion like every other command.
q "insert into public.natori_case_system_holds(owner_id,generation,commands_held,senders_held,read_only) values('$OWNER',1,true,false,false)"
out=$(call $OWNER $EXT external $R1 2>&1 || true)
case "$out" in *natori_system_held*) ok "completion is blocked during an emergency stop" yes yes;; *) ok "completion is blocked during an emergency stop" "$out" held;; esac
ok "nothing completed during the stop" "$(q "select status from public.natori_projects where id='$EXT'")" delivery_prep
q "delete from public.natori_case_system_holds"

ok "external completes" "$(call $OWNER $EXT external $R1 ",'completedAt','2026-10-20T03:00:00Z'")" applied
ok "external status/date" "$(q "select status||'|'||(completed_at at time zone 'UTC')::text||'|'||coalesce(delivery_accepted_at::text,'null') from public.natori_projects where id='$EXT'")" "completed|2026-10-20 03:00:00|null"
ok "same request replays as applied" "$(q "begin;set local role service_role;select public.natori_case_complete_v1('$OWNER','$EXT',jsonb_build_object('requestId','$R1','revision','old','kind','external','note','テスト','completedAt','2026-10-20T03:00:00Z','operator',jsonb_build_object('kind','auth-user','userId',null)))->>'result';commit;")" applied
ok "second completion is a conflict" "$(call $OWNER $EXT external $R2)" conflict

ok "deemed completes after expiry" "$(call $OWNER $DEEMED deemed $R2)" applied
ok "deemed completed_at = page expiry, no customer acceptance" "$(q "select p.status||'|'||(p.completed_at=r.expires_at)::text||'|'||coalesce(p.delivery_accepted_at::text,'null')||'|'||coalesce(r.accepted_at::text,'null') from public.natori_projects p join public.natori_delivery_releases r on r.project_id=p.id where p.id='$DEEMED'")" "completed|true|null|null"
ok "evidence rows" "$(q "select string_agg(kind||':'||(release_id is not null)::text,',' order by kind) from public.natori_case_completions")" "deemed:true,external:false"

out=$(q "update public.natori_case_completions set note='x'" 2>&1 || true)
case "$out" in *immutable*) ok "evidence is immutable" yes yes;; *) ok "evidence is immutable" "$out" immutable;; esac
out=$(q "update public.natori_projects set completed_at=now() where id='$EXT'" 2>&1 || true)
case "$out" in *"Immutable issued delivery evidence"*) ok "completed_at stays immutable" yes yes;; *) ok "completed_at stays immutable" "$out" immutable;; esac
ok "anon/authenticated cannot execute" "$(q "select has_function_privilege('anon','public.natori_case_complete_v1(uuid,uuid,jsonb)','EXECUTE')::text||has_function_privilege('authenticated','public.natori_case_complete_v1(uuid,uuid,jsonb)','EXECUTE')::text")" falsefalse
ok "no frame left behind" "$(q "select count(*) from natori_case_guard.frames")" 0
ok "guard contract still holds for every root" "$(q "do \$\$declare r record;begin for r in select distinct root from natori_case_guard.permissions loop perform natori_case_guard.check_contract(r.root);end loop;end\$\$;select 'ok'")" ok

if [ "$fails" -ne 0 ]; then echo "$fails check(s) failed"; exit 1; fi
echo "all checks passed"
