#!/usr/bin/env python3
"""Synthetic Q03 proof using only the already installed, pinned Postgres image.

No ports, network, hosted DB, credentials, customer data, mail or payment calls.
Run: python scripts/natori-q03/verify-db.py /tmp/q03-db-results.json
"""
import concurrent.futures
import json
from pathlib import Path
import subprocess
import sys
import time
import uuid

ROOT = Path(__file__).resolve().parents[2]
IMAGE = "postgres:17.11-bookworm@sha256:66aafa11cf15800a3c94763f7e11d1e7b2e37e5e84bc4ce027cb6e1e4bfaf4df"
NAME = "natori-q03-" + uuid.uuid4().hex[:10]
OWNER = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"
OTHER = "cccccccc-cccc-4ccc-8ccc-cccccccccccc"
evidence = []

def run(*args, input=None, check=True):
    result = subprocess.run(args, input=input, text=True, capture_output=True)
    if check and result.returncode: raise RuntimeError(result.stderr.strip() or result.stdout.strip())
    return result

def sql(text, check=True):
    return run("docker", "exec", "-i", NAME, "psql", "-X", "-qAt", "-v", "ON_ERROR_STOP=1", "-U", "postgres", input=text, check=check)

def value(text):
    raw = sql(text).stdout.strip().splitlines()[0]
    return True if raw == "t" else False if raw == "f" else json.loads(raw)

def edit(pid, rev, patch, action=None, owner=OWNER):
    action_sql = "null" if action is None else "'" + action.replace("'", "''") + "'"
    patch_sql = json.dumps(patch).replace("'", "''")
    return f"select public.natori_edit_project_v1('{owner}','{pid}',{rev},'{patch_sql}',{action_sql});"

def profile(rev, patch):
    patch_sql = json.dumps(patch).replace("'", "''")
    return f"select public.natori_edit_profile_v1('{OWNER}',{rev},'{patch_sql}');"


def row(pid):
    return value(f"select to_jsonb(p) from public.natori_projects p where id='{pid}';")

def check(name, test):
    test()
    evidence.append({"name": name, "status": "passed"})
    print("PASS " + name, flush=True)

def race(first, second):
    # First has already mutated and retains its row lock when the second session starts.
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
        pending = pool.submit(sql, "begin;set local role service_role;" + first + "select pg_advisory_xact_lock(603003);select pg_sleep(0.4);commit;")
        for _ in range(100):
            if value("select exists(select 1 from pg_locks where locktype='advisory' and objid=603003 and granted);"):
                break
            time.sleep(0.01)
        else:
            raise AssertionError("first session did not reach the deterministic lock boundary")
        blocked = pool.submit(sql, "set role service_role;" + second)
        a = json.loads(next(line for line in pending.result().stdout.splitlines() if line.startswith("{")))
        b = json.loads(blocked.result().stdout.strip())
        assert a["result"] == "applied" and b["result"] == "edit_conflict", (a, b)
        return a, b

def main():
    run("docker", "image", "inspect", IMAGE)
    run("docker", "run", "-d", "--pull=never", "--network=none", "--name", NAME, "-e", "POSTGRES_HOST_AUTH_METHOD=trust", IMAGE)
    for _ in range(200):
        if run("docker", "exec", NAME, "pg_isready", "-h", "127.0.0.1", "-U", "postgres", check=False).returncode == 0:
            break
        time.sleep(0.1)
    else:
        raise AssertionError("isolated postgres startup timed out")
    sql("""create role anon;create role authenticated;create role service_role bypassrls;
      create schema auth;create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql as $$ select null::uuid $$;
      create schema storage;create table storage.objects(id uuid);
      create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    """)
    for migration in ["20260723111730_etorie_baseline.sql", "20260723111741_baseline_security_hardening.sql", "20260729115313_etorie_phase1_expand.sql", "20260729115323_etorie_phase1_project_constraints.sql", "20260805192000_stop_natori_note_machine_logs.sql", "20261001223805_natori_task_integrity.sql"]:
        sql((ROOT / "supabase/migrations" / migration).read_text())
    # The shared Phase T path installs these exact type functions early; Phase 3A
    # then installs the untouched remainder without duplicate CREATE FUNCTION.
    parts = json.loads(run("node", "--input-type=module", "-e", "import {reviewedIntakeParts} from './scripts/natori-q03/fixture-prerequisites.mjs';process.stdout.write(JSON.stringify(reviewedIntakeParts()));").stdout)
    sql(parts["prerequisites"])
    sql((ROOT / "supabase/migrations/20261017123933_natori_edit_conflict_protection.sql").read_text())
    sql(parts["remaining"])
    evidence.append({"name":"early shared fixture prerequisites plus later Phase 3A remainder compile without duplication", "status":"passed"})
    sql(f"insert into auth.users values('{OWNER}'),('{OTHER}');")

    # INSERT columns preserve actual product defaults and constraints.
    global create
    def create(**extra):
        pid = str(uuid.uuid4())
        data = dict(id=pid, user_id=OWNER, title="Synthetic", client_name="Synthetic", type="undecided", status="inquiry", delivery_plan="normal", note="Initial note")
        data.update(extra)
        fields = ",".join(data)
        values = ",".join("null" if v is None else "'" + str(v).replace("'", "''") + "'" for v in data.values())
        sql(f"insert into public.natori_projects({fields}) values({values});")
        return pid

    def same_field():
        pid = create(); race(edit(pid,0,{"note":"A"}),edit(pid,0,{"note":"B"})); assert row(pid)["note"] == "A"
    check("two sessions same field: one winner, stale writer changes nothing", same_field)
    def different_fields():
        pid = create(); race(edit(pid,0,{"note":"A"}),edit(pid,0,{"title":"B"})); assert row(pid)["title"] == "Synthetic" and row(pid)["note"] == "A"
    check("two sessions different fields: whole-row revision rejects stale intent", different_fields)
    def partial_success():
        pid = create(); before = row(pid)
        sql("create function public.q03_reject_test_title() returns trigger language plpgsql as $$ begin if new.title='FAIL_SYNTHETIC' then raise exception 'synthetic detail failure'; end if;return new;end $$;create trigger q03_reject before update on public.natori_projects for each row execute function public.q03_reject_test_title();")
        failed = sql(edit(pid,0,{"type":"icon","title":"FAIL_SYNTHETIC"}),check=False)
        assert failed.returncode != 0 and row(pid) == before
        assert value(f"select count(*) from public.natori_project_tasks where project_id='{pid}';") == 0
        ok = value(edit(pid,0,{"type":"icon","title":"Confirmed"}))
        assert ok["result"] == "applied" and len(ok["project"]["tasks"]) == 6 and row(pid)["type"] == "icon"
    check("type plus details: forced DB failure rolls back type, tasks, revision and details", partial_success)
    def inquiry_atomic():
        pid = create(); before = row(pid)
        assert sql(edit(pid,0,{"title":"FAIL_SYNTHETIC"},"Contact"),check=False).returncode != 0 and row(pid) == before
        assert value(edit(pid,0,{"amount":12500},"Contact"))["result"] == "applied"
        assert row(pid)["amount"] == 12500 and row(pid)["next_action"] == "Contact"
        for status in ["delivered","completed","rough"]:
            blocked = create(type="icon",status=status); original = row(blocked)
            assert value(edit(blocked,0,{"note":"draft"},"bad"))["result"] == "invalid_next_action" and row(blocked) == original
    check("inquiry details and action commit together; protected lifecycle actions reject unchanged", inquiry_atomic)
    def profile_races():
        race(profile("null",{"display_name":"A"}),profile("null",{"daily_capacity_hours":6}))
        race(profile(0,{"daily_capacity_hours":6}),profile(0,{"display_name":"Stale"}))
        p = value(f"select to_jsonb(p) from public.natori_user_profiles p where user_id='{OWNER}';")
        assert p["display_name"] == "A" and p["daily_capacity_hours"] == 6 and p["mutation_revision"] == 1
    check("profile first-create and existing CAS races preserve omitted fields", profile_races)
    def workflow_races():
        paid = create(type="icon",status="rough",payment_confirmed_at="2026-10-01",paid_at="2026-10-01",paid_amount=10000)
        sql(f"insert into public.natori_project_tasks(project_id,task_key,label,stage,sort_order) values('{paid}','rough','Rough','rough',0),('{paid}','line','Line','lineart',1);")
        assert value(f"select public.natori_update_task_v1('{OWNER}','{paid}','rough',true);")["result"] == "applied"
        before = row(paid); assert value(edit(paid,0,{"note":"stale"}))["result"] == "edit_conflict" and row(paid) == before
        saved = value(edit(paid,before["mutation_revision"],{"note":"Fresh"}))["project"]
        assert saved["status"] == "lineart" and saved["tasks"][0]["done"] and saved["paidAmount"] == 10000
        payment = create(type="icon"); sql(f"update public.natori_projects set paid_amount=12000,payment_confirmed_at=now(),paid_at=now(),status='rough' where id='{payment}';")
        before = row(payment); assert value(edit(payment,0,{"note":"stale"}))["result"] == "edit_conflict" and row(payment) == before
    check("task/payment updates fence old edits; later success returns coherent lifecycle, tasks and payment snapshot", workflow_races)
    def close_note():
        pid = create(); value(edit(pid,0,{"note":"New human note"}))
        assert value(f"select public.natori_close_project_with_note_v1('{OWNER}','{pid}','inquiry','Reason');") is True
        assert row(pid)["note"] == "New human note\n\nReason"
        before = row(pid); assert value(edit(pid,1,{"note":"old"}))["result"] == "edit_conflict" and row(pid) == before
    check("close appends to current note and fences an old editor", close_note)
    def owner_guards():
        pid = create(); before = row(pid)
        assert value(edit(pid,0,{"note":"other"},owner=OTHER)) == {"result":"not_found"}
        sql(f"update public.natori_projects set deleted_at=now() where id='{pid}';")
        assert value(edit(pid,1,{"note":"archived"})) == {"result":"not_found"}
        assert value(edit(str(uuid.uuid4()),0,{"note":"missing"})) == {"result":"not_found"}
        for role in ["anon","authenticated"]:
            assert sql("set role " + role + ";" + edit(pid,0,{"note":"bad"}),check=False).returncode != 0
            assert sql("set role " + role + ";" + profile("null",{"display_name":"bad"}),check=False).returncode != 0
        assert row(pid)["note"] == before["note"]
    check("other owner, archived, missing rows and non-service roles cannot edit or obtain snapshots", owner_guards)
    def immutable_guards():
        pid = create(); before = row(pid)
        for patch in [{"request_data":{"schemaVersion":1}},{"status":"completed"},{"next_action":"bad"},{"mutation_revision":20}]:
            assert value(edit(pid,0,patch))["result"] == "invalid_request" and row(pid) == before
        assert value(edit(pid,"null",{"note":"missing revision"}))["result"] == "invalid_request" and row(pid) == before
    check("missing revisions and immutable fields fail closed without writes", immutable_guards)

try:
    main()
finally:
    run("docker", "stop", NAME, check=False)
    run("docker", "rm", NAME, check=False)
    if len(sys.argv) > 1:
        Path(sys.argv[1]).write_text(json.dumps({"image":IMAGE,"cases":evidence,"storage":"catalogue stub only; no Storage service","hosted_access":False},indent=2)+"\n")
