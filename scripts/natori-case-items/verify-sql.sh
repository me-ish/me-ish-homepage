#!/usr/bin/env bash
# Synthetic PostgreSQL check for 20261105120000_natori_case_items.sql.
# Usage: PSQL_BASE="psql -h <socket dir> -U postgres" scripts/natori-case-items/verify-sql.sh
# Creates a throwaway database, applies every active migration, seeds fictional
# rows only, and checks the item constraints and that only service_role can reach the table.
set -euo pipefail
ROOT=$(cd "$(dirname "$0")/../.." && pwd)
DB="natori_case_items_$$"
PSQL_BASE=${PSQL_BASE:-psql}
P="$PSQL_BASE -X -q -At -v ON_ERROR_STOP=1"
$P -d postgres -c "create database $DB" >/dev/null
trap '$P -d postgres -c "drop database if exists $DB" >/dev/null' EXIT
q(){ $P -d "$DB" -c "$1"; }
fails=0
ok(){ if [ "$2" = "$3" ]; then echo "ok   $1"; else echo "FAIL $1: expected [$3] got [$2]"; fails=$((fails+1)); fi; }
rejects(){ if $PSQL_BASE -X -q -At -v ON_ERROR_STOP=1 -d "$DB" -c "$2" >/dev/null 2>&1; then echo "FAIL $1: accepted"; fails=$((fails+1)); else echo "ok   $1"; fi; }
q "do \$\$begin if not exists(select 1 from pg_roles where rolname='anon') then create role anon nologin;end if;if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin;end if;if not exists(select 1 from pg_roles where rolname='service_role') then create role service_role nologin bypassrls;end if;end\$\$" >/dev/null
$P -d "$DB" -f "$ROOT/scripts/legacy-entry-read-security/fresh-bootstrap.sql" >/dev/null
for f in $(python3 -c "import json,sys;print(' '.join(json.load(open(sys.argv[1]))['activeMigrations']))" "$ROOT/supabase/baseline/manifest.json"); do
  case " ${SKIP_MIGRATIONS:-} " in *" $(basename "$f") "*) echo "skip $f"; continue;; esac
  $P -d "$DB" -f "$ROOT/$f" >/dev/null
done
echo "ok   all active migrations applied"

OWNER=22222222-2222-4222-8222-222222222222; CASE=a0000000-0000-4000-8000-000000000001
q "insert into auth.users(id) values('$OWNER')"
q "insert into public.natori_projects(id,user_id,title,client_name,status,type,amount,next_action,delivery_plan,created_at,updated_at) values('$CASE','$OWNER','架空の依頼','架空依頼者','inquiry','undecided',null,'-','normal',now(),now())"
ins(){ echo "insert into public.natori_case_items(project_id,position,title,project_type,amount,due_date,publication_policy,publication_allowed_from) values('$CASE',$1)"; }

q "$(ins "1,'クリスマス等身','standing',12000,'2026-12-20','delayed','2026-12-26'")"
q "$(ins "2,'正月等身','standing',12000,'2026-12-30','allowed',null")"
q "$(ins "3,'SD',null,null,null,'unknown',null")"
ok "three items stored in order" "$(q "select string_agg(title,'/' order by position) from public.natori_case_items where project_id='$CASE'")" "クリスマス等身/正月等身/SD"
ok "progress starts at not_started" "$(q "select distinct progress from public.natori_case_items")" "not_started"
rejects "duplicate position" "$(ins "1,'重複',null,null,null,'unknown',null")"
rejects "position above 20" "$(ins "21,'多すぎ',null,null,null,'unknown',null")"
rejects "blank title" "$(ins "4,'  ',null,null,null,'unknown',null")"
rejects "unknown type" "$(ins "4,'x','poster',null,null,'unknown',null")"
rejects "negative amount" "$(ins "4,'x',null,-1,null,'unknown',null")"
rejects "unknown policy" "$(ins "4,'x',null,null,null,'later',null")"
rejects "delayed without date" "$(ins "4,'x',null,null,null,'delayed',null")"
rejects "date without delayed" "$(ins "4,'x',null,null,null,'allowed','2026-12-01'")"
rejects "unknown progress" "update public.natori_case_items set progress='paused' where position=3"
q "update public.natori_case_items set progress='in_progress' where project_id='$CASE' and position=3"
ok "progress can move" "$(q "select progress from public.natori_case_items where position=3")" "in_progress"
q "begin; set constraints natori_case_items_project_position_key deferred; update public.natori_case_items set position=case position when 1 then 2 when 2 then 1 else position end where project_id='$CASE'; commit;"
ok "positions can be swapped in one transaction" "$(q "select title from public.natori_case_items where position=1")" "正月等身"
ok "rls enabled" "$(q "select relrowsecurity from pg_class where relname='natori_case_items'")" "t"
ok "anon has no table privilege" "$(q "select has_table_privilege('anon','public.natori_case_items','select')")" "f"
ok "authenticated has no table privilege" "$(q "select has_table_privilege('authenticated','public.natori_case_items','select')")" "f"
ok "service_role can write" "$(q "select has_table_privilege('service_role','public.natori_case_items','insert')")" "t"
if [ "$fails" -ne 0 ]; then echo "$fails check(s) failed"; exit 1; fi
echo "all checks passed"
