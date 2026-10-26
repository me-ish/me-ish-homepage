"""Populated predecessor 37 -> reviewed 54. Synthetic network-none PostgreSQL only.
No provider, real Auth/Storage, purge, receipt retirement, TRUNCATE or external SQL.
"""
import hashlib, json, pathlib, subprocess, sys, time, uuid
from flow_package import flow_package, observed_payment, OBSERVED_MD5

ROOT = pathlib.Path(__file__).resolve().parents[2]
OUT = pathlib.Path(sys.argv[1])
OUT.mkdir(exist_ok=False)
PRODUCTION_VARIANTS = sys.argv[2:] == ["--production-variants"]
CURRENT_FLOW = PRODUCTION_VARIANTS or sys.argv[2:] == ["--current-flow"]
EXISTING_MAIL = CURRENT_FLOW or sys.argv[2:] == ["--existing-mail"]
if sys.argv[2:] and not EXISTING_MAIL:
    raise ValueError("unknown verification profile")
IMAGE = "sha256:589f742565e4f6d22149176b032974f55f8201a8a37b71ed587ec5c6902e689f"
RUN = "case-upgrade-" + uuid.uuid4().hex[:10]
REPORT = {"scope": "network-none PostgreSQL; normal business migrations; synthetic Auth/Storage catalog; not a production snapshot",
          "checks": [], "migrations": [], "container": {"name": RUN, "removed": False}}
REPORT["profile"] = "existing-mail-without-54" if EXISTING_MAIL else "optional-production-mail"
EXPECTED = {
    "natori_accept_delivery_ready_v1": "e9ae3bbe50e0772c7c07355f234b053c",
    "natori_delivery_issue_v1": "961f11c3c1b6d06ff8a6a797ca72f5a9",
    "natori_delivery_project_guard_v1": "5669d0837ba50a7f5a31de9b08208d22",
    "natori_delivery_release_guard_v1": "b63444cad141a8a801d86db1cb66e095",
    "natori_notification_retry_v1": "1eaa1b95f4f91c962ef482a04f1bd887",
    "natori_payment_links_v1": "f87d0101d1d62ebb50f03ddaee12c737",
}

def docker(args, data=None, ok=True):
    result = subprocess.run(["/usr/local/bin/docker", "--host", "unix:///var/run/docker.sock", *args],
                            input=data, text=True, capture_output=True, timeout=60)
    if ok and result.returncode:
        raise RuntimeError(result.stderr)
    return result.stdout.strip() if ok else result

def raw(statement):
    return docker(["exec", "-i", RUN, "psql", "-X", "-qAt", "-v", "ON_ERROR_STOP=1",
                   "-h", "127.0.0.1", "-U", "postgres"], statement, False)

def sql(statement):
    result = raw(statement)
    if result.returncode:
        raise RuntimeError(result.stderr)
    return result.stdout.strip()

def lit(value):
    return "'" + str(value).replace("'", "''") + "'"

def check(label, result):
    assert result, label
    REPORT["checks"].append(label)
    print(label, flush=True)

def service(statement):
    return "begin;set local role service_role;" + statement + ";commit;"

def snapshot(shapes):
    parts = []
    for table, columns in shapes.items():
        selected = ",".join(map(lit, columns))
        parts.append(
            "select " + lit(table) + " as name,md5(coalesce(jsonb_agg(v order by v::text),'[]'::jsonb)::text) as hash from "
            "(select (select jsonb_object_agg(e.key,e.value) from jsonb_each(to_jsonb(t)) e "
            "where e.key=any(array[" + selected + "])) v from public." + table + " t) rows"
        )
    return json.loads(sql("select jsonb_object_agg(name,hash) from (" + " union all ".join(parts) + ") snapshots"))

try:
    docker(["image", "inspect", IMAGE])
    docker(["run", "--detach", "--pull", "never", "--network", "none", "--name", RUN,
            "--label", "meish.production-upgrade=" + RUN, "--memory", "512m", "--cpus", "1",
            "--tmpfs", "/var/lib/postgresql/data:rw,nosuid,nodev,size=256m",
            "--env", "POSTGRES_HOST_AUTH_METHOD=trust", IMAGE, "postgres", "-c", "listen_addresses=127.0.0.1"])
    REPORT["container"]["created"] = True
    for _ in range(80):
        if raw("select 1").returncode == 0:
            break
        time.sleep(0.1)
    info = json.loads(docker(["inspect", RUN]))[0]
    check("isolation: pinned cached image, network none, no published port or host mount",
          info["HostConfig"]["NetworkMode"] == "none" and not info["HostConfig"].get("PortBindings")
          and all(m["Type"] == "tmpfs" for m in info["Mounts"]))
    sql("create role anon nologin;create role authenticated nologin;create role service_role nologin bypassrls;")
    sql((ROOT / "scripts/legacy-entry-read-security/fresh-bootstrap.sql").read_text())
    manifest = json.loads((ROOT / "supabase/baseline/manifest.json").read_text())
    files = manifest["activeMigrations"]
    check("all 54 original file checksums match the reviewed manifest", len(files) == 54 and all(
        hashlib.sha256((ROOT / file).read_bytes()).hexdigest() == manifest["checksums"]["sha256:" + file]
        for file in files))
    for file in files[:37]:
        sql((ROOT / file).read_text())
    if EXISTING_MAIL:
        definition, _ = observed_payment()
        sql(definition)
        check("synthetic predecessor has exactly the observed production comment/CRLF body",
              sql("select md5(prosrc) from pg_proc where oid='natori_record_stripe_payment(uuid,text,integer,uuid)'::regprocedure") == OBSERVED_MD5)
    if PRODUCTION_VARIANTS:
        from production_variants import VARIANTS, DELETE_SIGNATURE, DELETE_OBSERVED, DELETE_REVIEWED, compatibility_payload, observed_bodies
        variants = observed_bodies()
        for signature, baseline_hash, actual_hash, size, crlf in VARIANTS:
            row = json.loads(sql("select jsonb_build_object('definition',pg_get_functiondef(oid),'body',prosrc) from pg_proc where oid=" + lit(signature) + "::regprocedure"))
            check("synthetic baseline fingerprint before observed variant: " + signature, hashlib.md5(row['body'].encode()).hexdigest() == baseline_hash)
            body = row['body'].replace('\n', '\r\n') if crlf else variants[signature]
            check("exact observed production body bytes: " + signature, hashlib.md5(body.encode()).hexdigest() == actual_hash and len(body.encode()) == size)
            sql(row['definition'].replace(row['body'], body))
        row = json.loads(sql("select jsonb_build_object('definition',pg_get_functiondef(oid),'body',prosrc) from pg_proc where oid=" + lit(DELETE_SIGNATURE) + "::regprocedure"))
        sql(row['definition'].replace(row['body'], variants[DELETE_SIGNATURE]))
        sql('alter function public.natori_delete_project(uuid,uuid) set search_path=public')
        check("synthetic predecessor reproduces physical-delete RPC exactly without invoking it", sql("select md5(prosrc) from pg_proc where oid=" + lit(DELETE_SIGNATURE) + "::regprocedure") == DELETE_OBSERVED)
    names = ",".join(map(lit, EXPECTED))
    fingerprints = json.loads(sql(
        "select jsonb_object_agg(proname,md5(prosrc)) from pg_proc "
        "where pronamespace='public'::regnamespace and proname in (" + names + ")"))
    REPORT["predecessorFingerprints"] = fingerprints
    check("all six predecessor body fingerprints match the parent production observation", fingerprints == EXPECTED)
    flags = json.loads(sql(
        "select jsonb_object_agg(proname,jsonb_build_object('definer',prosecdef,"
        "'service',has_function_privilege('service_role',oid,'EXECUTE'),"
        "'anon',has_function_privilege('anon',oid,'EXECUTE'),"
        "'authenticated',has_function_privilege('authenticated',oid,'EXECUTE'),"
        "'owner',pg_get_userbyid(proowner),'volatility',provolatile,'config',proconfig)) "
        "from pg_proc where pronamespace='public'::regnamespace and proname in (" + names + ")"))
    check("predecessor PAY definer and helper/RPC execution flags match the observed six functions",
          all(v["owner"] == "postgres" and v["volatility"] == "v" and v["config"] == ['search_path=""']
              and not v["anon"] and not v["authenticated"] for v in flags.values())
          and all(flags[n]["definer"] == (n in ("natori_accept_delivery_ready_v1", "natori_delivery_issue_v1"))
                  and flags[n]["service"] == ("guard" not in n) for n in flags))
    # The same catalog-only request will be handed to the parent's authorized
    # production read path. Validate its shape/expectations here, not remotely.
    pay_catalog = json.loads(sql((ROOT / "docs/artifacts/natori-case-production-contract-check-20261025/delivery-trigger-acl-request.sql").read_text()))
    REPORT["syntheticPayCatalog"] = pay_catalog
    expected_triggers = {
        ("natori_projects", "natori_delivery_project_guard", 23, "O", "natori_delivery_project_guard_v1()"),
        ("natori_delivery_releases", "natori_delivery_release_guard", 27, "O", "natori_delivery_release_guard_v1()"),
    }
    check("pending PAY catalog SELECT parses and confirms the synthetic predecessor trigger wiring and table ACL",
          not pay_catalog["guard_schema_present"]
          and {(t["table"], t["name"], t["type"], t["enabled"], t["function"]) for t in pay_catalog["delivery_triggers"]} == expected_triggers
          and pay_catalog["release_table_acl"] == {
              "present": True, "rls": True, "service_select": True,
              "service_insert_or_update": False, "service_delete": False,
              "browser_column_access": False, "browser_table_mutation": False})
    shapes = json.loads(sql(
        "select jsonb_object_agg(relname,cols) from (select c.relname,jsonb_agg(a.attname order by a.attnum) cols "
        "from pg_class c join pg_attribute a on a.attrelid=c.oid and a.attnum>0 and not a.attisdropped "
        "where c.relnamespace='public'::regnamespace and c.relkind='r' and c.relname like 'natori_%' "
        "group by c.oid,c.relname) x"))
    observed_columns = {
        "natori_notification_jobs": "id notification_key attempt_no project_id quote_id purpose snapshot payload status claim_token lease_expires_at claim_count send_started_at retry_after provider_id sent_at error_code created_at updated_at".split(),
        "natori_payment_link_operations": "project_id operation_id request_hash action attempt_id status proposed_deadline expected_revision notification_id created_at".split(),
        "natori_payment_link_stops": "id project_id owner_id attempt_id link_id livemode reason deadline_revision status claim_token claim_generation lease_until created_at updated_at".split(),
    }
    check("predecessor notification/operation/stop column names exactly match the parent observation (19/10/14)",
          all(shapes[table] == columns for table, columns in observed_columns.items()))

    owner = "22222222-2222-4222-8222-222222222222"
    other = "33333333-3333-4333-8333-333333333333"
    sql("insert into auth.users(id) values(" + lit(owner) + "),(" + lit(other) + ")")
    fixture = json.loads(subprocess.check_output([
        "node", "--input-type=module", "-e",
        "import {seed} from './scripts/natori-case-payment/fixture.mjs';console.log(JSON.stringify(seed("
        + json.dumps(owner) + "," + json.dumps(other) + ")));"
    ], cwd=ROOT, text=True))
    sql(fixture["sql"])
    project = fixture["ids"][0]
    quote = "b0000000-0000-4000-8000-000000000001"
    uid = lambda: str(uuid.uuid4())
    unknown, sending, sent, failed, claim, pending = [uid() for _ in range(6)]
    attempt, operation, stop = [uid() for _ in range(3)]
    # Frozen opaque payload is synthetic, with no real token, recipient or ciphertext.
    payload = '{"fixture":"synthetic-frozen-pre-upgrade"}'
    for job, status in ((unknown, "unknown"), (sending, "sending"), (sent, "sent"), (failed, "failed"), (pending, "pending")):
        sql("insert into natori_notification_jobs(id,notification_key,project_id,quote_id,purpose,snapshot,payload,status,"
            "claim_token,lease_expires_at,send_started_at,sent_at,provider_id,created_at) values("
            + ",".join([lit(job), lit("upgrade/" + job), lit(project), lit(quote), "'quote_accept_artist'",
                        "'{}'", lit(payload) + "::jsonb", lit(status),
                        lit(claim) if status == "sending" else "null",
                        "clock_timestamp()+interval '10 minutes'" if status == "sending" else "null",
                        "clock_timestamp()-interval '30 minutes'" if status in ("unknown", "sending", "sent") else "null",
                        "clock_timestamp()-interval '20 minutes'" if status == "sent" else "null",
                        "'synthetic-old-provider'" if status == "sent" else "null",
                        "clock_timestamp()-interval '1 hour'"]) + ")")
    sql(f"insert into natori_payment_link_attempts(id,project_id,owner_id,quote_id,generation,amount,livemode,state,deadline,"
        f"provider_account_id,price_started_at,link_started_at,claim_token,claim_generation,lease_until) values("
        f"'{attempt}','{project}','{owner}','{quote}',1,12000,false,'creating',clock_timestamp()+interval '7 days',"
        f"'acct_synthetic',clock_timestamp()-interval '1 hour',clock_timestamp()-interval '30 minutes','{uid()}',1,clock_timestamp()+interval '10 minutes');"
        f"insert into natori_payment_link_operations(project_id,operation_id,request_hash,action,attempt_id,status)"
        f" values('{project}','{operation}','{'a' * 64}','issue','{attempt}','pending');"
        f"insert into natori_payment_link_stops(id,project_id,owner_id,link_id,status,reason)"
        f" values('{stop}','{project}','{owner}','plink_synthetic_old','pending','synthetic-old-stop');")
    # Pure local canonical fact RPC; no Stripe call or payment traffic.
    paid_project = fixture["ids"][1]
    paid_quote = "b0000000-0000-4000-8000-000000000002"
    payment = sql(f"select to_jsonb(x) from natori_record_stripe_payment('{paid_project}','cs_test_synthetic_upgrade',12000,'{paid_quote}') x")
    REPORT["syntheticPaymentFact"] = json.loads(payment)
    check("predecessor fixture includes an existing recorded money fact",
          int(sql("select count(*) from natori_payment_transactions")) > 0)
    before = snapshot(shapes)
    REPORT["predecessorTables"] = len(shapes)
    payloads = flow_package() if EXISTING_MAIL else [{"source": file, "sql": (ROOT / file).read_text(),
        "source_sha256": hashlib.sha256((ROOT / file).read_bytes()).hexdigest(),
        "payload_sha256": hashlib.sha256((ROOT / file).read_bytes()).hexdigest()} for file in files[37:]]
    for entry in payloads:
        file = entry["source"]
        if PRODUCTION_VARIANTS and pathlib.Path(file).name == '20261023030000_natori_case_system_fence.sql':
            exec((ROOT / 'scripts/natori-case-production-upgrade/verify-production-variants.py').read_text())
        else:
            sql(entry["sql"])
        check("upgrade preserves every pre-existing field after " + pathlib.Path(file).name, snapshot(shapes) == before)
        REPORT["migrations"].append({k: v for k, v in entry.items() if k != "sql"})
    if PRODUCTION_VARIANTS:
        archive_owner, archive_project = uid(), uid()
        sql(f"insert into auth.users(id) values('{archive_owner}');insert into natori_projects(id,user_id,title,client_name,status,type) values('{archive_project}','{archive_owner}','Synthetic archive','Synthetic','inquiry','illustration')")
        check('soft-archive RPC rejects another owner without mutation', sql(service(f"select natori_delete_project('{other}','{archive_project}')")) == 'f' and sql(f"select deleted_at is null from natori_projects where id='{archive_project}'") == 't')
        unresolved_archive = raw(service(f"select natori_delete_project('{archive_owner}','{archive_project}')"))
        check('soft archive retains the existing unfinished-case/payment safety guard', unresolved_archive.returncode != 0 and 'unresolved_payment_link_archive' in unresolved_archive.stderr and sql(f"select deleted_at is null from natori_projects where id='{archive_project}'") == 't')
        sql(f"update natori_projects set status='closed' where id='{archive_project}'")
        check('soft-archive RPC retains the project row and sets deleted_at', sql(service(f"select natori_delete_project('{archive_owner}','{archive_project}')")) == 't' and sql(f"select count(*)=1 and bool_and(deleted_at is not null) from natori_projects where id='{archive_project}'") == 't')
        archived_at = sql(f"select deleted_at::text from natori_projects where id='{archive_project}'")
        check('soft-archive RPC is idempotent and retains its first archive timestamp', sql(service(f"select natori_delete_project('{archive_owner}','{archive_project}')")) == 't' and sql(f"select deleted_at::text from natori_projects where id='{archive_project}'") == archived_at)
        sql(service(f"select natori_case_system_control_v2('{archive_owner}','hold',0,'{{\"kind\":\"auth-user\",\"userId\":\"{archive_owner}\"}}',null,false)"))
        held_archive = raw(service(f"select natori_delete_project('{archive_owner}','{archive_project}')"))
        check('system hold still blocks the soft-archive RPC', held_archive.returncode != 0 and 'natori_system_held' in held_archive.stderr and sql(f"select deleted_at::text from natori_projects where id='{archive_project}'") == archived_at)
    check("upgrade creates no inferred acceptances, reconciliation rows, work records, run or production mail connection",
          sql("select (select count(*) from natori_case_reconciliation_jobs)+"
              "(select count(*) from natori_case_reconciliation_evidence)+"
              "(select count(*) from natori_case_reconciliation_resolutions)+"
              "(select count(*) from natori_case_work_records)+"
              "(select count(*) from natori_case_acceptance_runs)" + ("" if EXISTING_MAIL else "+(select count(*) from natori_case_production_mail_connections)")) == "0")
    if EXISTING_MAIL:
        check("optional production mail table/function is absent; flow readers and admission are installed",
              sql("select to_regclass('natori_case_production_mail_connections') is null and to_regprocedure('natori_case_production_mail_bind_v1(uuid,uuid,uuid,uuid,uuid,text,text,text,text,jsonb)') is null and to_regprocedure('natori_case_system_admit_v1(uuid,text)') is not null and to_regprocedure('natori_case_workspace_v1(uuid)') is not null") == "t")
        # Reuse the existing canonical claim/start/finish contract. No provider
        # request, new mail binding, inferred acceptance or synthetic send occurs.
        sender_claim = uid()
        claimed = sql(service(f"select count(*) from natori_notification_claim_v1('{pending}','{sender_claim}',false)"))
        started = sql(service(f"select count(*) from natori_notification_start_v1('{pending}','{sender_claim}',{lit(payload)}::jsonb)"))
        finished = sql(service(f"select natori_notification_finish_v1('{pending}','{sender_claim}','unknown',null,'synthetic_interruption')"))
        check("existing sender claim/start/unknown finish works without migration 54",
              claimed == "1" and started == "1" and finished == "t")
    check("legacy notifications retain NULL scope/mode and operations retain NULL workspace receipt",
          sql("select bool_and(provider_scope is null and provider_livemode is null and case_work_guard is null)"
              " from natori_notification_jobs") == "t"
          and sql("select workspace_guard is null and workspace_request is null and reconciliation_id is null "
                  "from natori_payment_link_operations where operation_id=" + lit(operation)) == "t")
    hold = json.loads(sql(service("select natori_case_system_control_v2("
        + ",".join([lit(owner), "'hold'", "0", lit(json.dumps({"kind": "auth-user", "userId": owner})) + "::jsonb",
                    "null", "false"]) + ")")))
    check("a separate explicit hold is required and persists generation 1", hold["result"] == "saved" and hold["generation"] == 1)
    jobs_before = snapshot({"natori_notification_jobs": shapes["natori_notification_jobs"]})
    existing = sql(service("select natori_notification_retry_v1(" + lit(unknown) + "," + lit(owner) + ")"))
    check("held unknown retry only returns its existing ID without changing evidence or creating an attempt",
          existing == unknown and snapshot({"natori_notification_jobs": shapes["natori_notification_jobs"]}) == jobs_before)
    denied = raw(service("select natori_notification_retry_v1(" + lit(failed) + "," + lit(owner) + ")"))
    REPORT["heldFailedRetry"] = {"exitCode": denied.returncode, "heldError": "natori_system_held" in denied.stderr}
    check("hold rejects a new retry of an old failed notification without changing evidence",
          denied.returncode != 0 and "natori_system_held" in denied.stderr
          and snapshot({"natori_notification_jobs": shapes["natori_notification_jobs"]}) == jobs_before)
    claimed = raw(service("select natori_notification_claim_v1(" + ",".join([lit(unknown), lit(uid()), "true"]) + ")"))
    REPORT["heldUnknownClaim"] = {"exitCode": claimed.returncode, "heldError": "natori_system_held" in claimed.stderr}
    check("hold blocks the actual sender claim even when the unknown retry returned an existing ID",
          claimed.returncode != 0 and "natori_system_held" in claimed.stderr
          and snapshot({"natori_notification_jobs": shapes["natori_notification_jobs"]}) == jobs_before)
    finished = sql(service("select natori_notification_finish_v1(" + ",".join([
        lit(sending), lit(claim), "'sent'", "'synthetic-late-provider-fact'", "null"]) + ")"))
    check("a pre-upgrade started request may record a late synthetic result while held",
          finished == "t" and sql("select status from natori_notification_jobs where id=" + lit(sending)) == "sent")
    check("unknown link creation, operation receipt and queued stop remain unresolved after the late fact",
          sql("select status from natori_notification_jobs where id=" + lit(unknown)) == "unknown"
          and sql("select state from natori_payment_link_attempts where id=" + lit(attempt)) == "creating"
          and sql("select status from natori_payment_link_operations where operation_id=" + lit(operation)) == "pending"
          and sql("select status from natori_payment_link_stops where id=" + lit(stop)) == "pending")
    if CURRENT_FLOW:
        if PRODUCTION_VARIANTS:
            current_before = snapshot(shapes)
            catalog_before = function_catalog()
            forward_sql = (ROOT / 'scripts/natori-case-production-upgrade/current-flow.sql').read_text()
            assert forward_sql.rstrip().endswith('commit;')
            # The reviewed forward owns its transaction. Inject the synthetic
            # failure before its final COMMIT, never outside that transaction.
            failed_forward = raw(forward_sql[:forward_sql.rindex('commit;')] + "\ndo $test$ begin raise exception 'synthetic_forced_rollback'; end $test$;commit;")
            REPORT['forwardRollback'] = {'exitCode': failed_forward.returncode, 'error': failed_forward.stderr, 'dataSame': snapshot(shapes) == current_before, 'catalogSame': function_catalog() == catalog_before, 'currentTableAbsent': sql("select to_regclass('natori_case_current_operations') is null")}
            check('forward 17 rollback leaves existing data and function definitions intact and no current table', failed_forward.returncode != 0 and 'synthetic_forced_rollback' in failed_forward.stderr and snapshot(shapes) == current_before and function_catalog() == catalog_before and sql("select to_regclass('natori_case_current_operations') is null") == 't')
        exec((ROOT / "scripts/natori-case-production-upgrade/verify-current.py").read_text())
        if PRODUCTION_VARIANTS:
            catalog_query = "select coalesce(jsonb_agg(jsonb_build_object('signature',p.oid::regprocedure::text,'md5',md5(p.prosrc),'bytes',octet_length(p.prosrc),'owner',pg_get_userbyid(p.proowner),'definer',p.prosecdef,'config',p.proconfig,'service',has_function_privilege('service_role',p.oid,'EXECUTE'),'anon',has_function_privilege('anon',p.oid,'EXECUTE'),'authenticated',has_function_privilege('authenticated',p.oid,'EXECUTE')) order by p.oid::regprocedure::text),'[]'::jsonb) from pg_proc p where p.pronamespace='public'::regnamespace and (p.proname like 'natori_case_%' or p.proname='natori_delete_project')"
            (OUT / 'catalog-query.sql').write_text(catalog_query + ';\n')
            (OUT / 'installed-catalog.json').write_text(json.dumps(json.loads(sql(catalog_query)), indent=2)+'\n')
    REPORT["result"] = "passed"
except Exception as error:
    REPORT["result"] = "failed"
    REPORT["error"] = str(error)
    raise
finally:
    if REPORT["container"].get("created"):
        info = json.loads(docker(["inspect", RUN]))[0]
        assert info["Config"]["Labels"]["meish.production-upgrade"] == RUN
        docker(["stop", "--time", "5", RUN])
        docker(["rm", RUN])
        REPORT["container"]["removed"] = True
    (OUT / "result.json").write_text(json.dumps(REPORT, ensure_ascii=False, indent=2) + "\n")
