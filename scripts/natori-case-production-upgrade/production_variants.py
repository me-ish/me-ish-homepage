"""Exact observed production compatibility; historical migrations stay immutable."""
import hashlib
import json
import pathlib
import re

HERE = pathlib.Path(__file__).resolve().parent
VARIANTS = [
    ("natori_confirm_manual_payment(uuid,uuid,text)", "9bb94e275dcf93a28e9173d77479e820", "e09cfad6dcfd12eebc9f14c48224e713", 980, True),
    ("natori_confirm_project_type_v1(uuid,uuid,text)", "88a962dd03e3d6706daafb3d7324fe78", "67d37e5be3483fe1958fe65ddea543e7", 2693, False),
    ("natori_create_project_with_tasks(uuid,jsonb,jsonb,jsonb)", "206e3b3afb2169976a7f3e6cb15f0fa5", "3c92c1b500be268eeb30d2ce2e4fec7f", 2185, True),
    ("natori_create_project_with_tasks_v2(uuid,uuid,text,text,jsonb,jsonb,jsonb)", "1cd14acd123819e5e5f4f85bfb9236c8", "fda4ff03ad2e7fda4db9e3f3072da2f2", 11197, False),
    ("natori_issue_quote(uuid,uuid,text,text,text,integer,text,text,text,timestamp with time zone)", "ccdc2496065a2b3c7e311afd8670847f", "77030c54474019077bc837f52684a3e8", 1344, True),
    ("natori_issue_quote_v1(uuid,uuid,text,text,text,integer,text,text,text,timestamp with time zone,jsonb,jsonb,text)", "5a37152c30b800ce70d8acf3711f2d14", "859e0688c1b5b791478c64aee01594c4", 7793, False),
    ("natori_issue_quote_with_terms(uuid,uuid,text,text,text,integer,text,text,text,timestamp with time zone,jsonb,date)", "9ac07922b5a1db7bf25131ea3bee1a25", "150e67f454e12990041dd8e9bde69c99", 944, True),
]
DELETE_SIGNATURE = "natori_delete_project(uuid,uuid)"
DELETE_OBSERVED = "fb61f72d686fd06969a0162c9e8b2d89"
DELETE_REVIEWED = "3d3749b7c7c15d521f4a73b3080a7714"


def compatibility_payload(original):
    if hashlib.sha256(original.encode()).hexdigest() != "732dc86ca9b64d31ab7c9d432080c049b8c82fcc921e35628cb4bb16c1235d11":
        raise ValueError("original approved fence payload changed")
    baseline = (HERE.parents[1] / "supabase/migrations/20260723111741_baseline_security_hardening.sql").read_text()
    match = re.search(r"create or replace function public\.natori_delete_project\([\s\S]*?as \$\$([\s\S]*?)\$\$;", baseline, re.I)
    assert match
    body = match[1]
    assert hashlib.md5(body.encode()).hexdigest() == DELETE_REVIEWED
    prefix = """-- Approved compatibility for the exact observed production predecessor.
-- Function definition only: no project row is modified by this migration.
do $compat$
declare p record;
begin
 select pr.*,pg_get_functiondef(pr.oid) definition,pg_get_userbyid(pr.proowner) owner_name,
        l.lanname language_name into p
 from pg_proc pr join pg_language l on l.oid=pr.prolang
 where pr.oid=to_regprocedure('public.natori_delete_project(uuid,uuid)');
 if not found then raise exception 'natori_production_delete_precondition'; end if;
 if md5(p.prosrc)<>'fb61f72d686fd06969a0162c9e8b2d89' or octet_length(p.prosrc)<>197
  or p.owner_name<>'postgres' or p.language_name<>'plpgsql' or p.prokind<>'f'
  or p.provolatile<>'v' or not p.prosecdef or p.proconfig is distinct from array['search_path=public']::text[]
  or not has_function_privilege('service_role',p.oid,'EXECUTE')
  or has_function_privilege('anon',p.oid,'EXECUTE')
  or has_function_privilege('authenticated',p.oid,'EXECUTE')
  or exists(select 1 from aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a where a.grantee=0 and a.privilege_type='EXECUTE')
 then raise exception 'natori_production_delete_precondition'; end if;
 execute replace(p.definition,p.prosrc,$archive$BODY$archive$);
 if (select md5(prosrc) from pg_proc where oid=p.oid)<>'3d3749b7c7c15d521f4a73b3080a7714'
 then raise exception 'natori_production_delete_postcondition'; end if;
end $compat$;

""".replace("BODY", body)
    sql = original
    for signature, expected, actual, _, _ in VARIANTS:
        old = json.dumps({"signature": signature, "hash": expected}, separators=(",", ":"))
        new = json.dumps({"signature": signature, "hash": actual}, separators=(",", ":"))
        assert sql.count(old) == 1, signature
        sql = sql.replace(old, new, 1)
    return prefix + sql


def observed_bodies():
    rows = json.loads((HERE / "observed-writer-variants.json").read_text())["functions"]
    bodies = {row["signature"]: row["body"] for row in rows}
    expected = {s: (h, n) for s, _, h, n, crlf in VARIANTS if not crlf}
    expected[DELETE_SIGNATURE] = (DELETE_OBSERVED, 197)
    assert set(bodies) == set(expected)
    for signature, (digest, size) in expected.items():
        assert hashlib.md5(bodies[signature].encode()).hexdigest() == digest
        assert len(bodies[signature].encode()) == size
    return bodies
