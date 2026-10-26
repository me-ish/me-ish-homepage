"""Local-only existing-mail release package; never connects to a database.

Historical migrations stay immutable. The observed production predecessor differs
only by two comments and CRLF, but L7 must still check its exact original bytes.
"""
import hashlib
import json
import pathlib
import re

ROOT = pathlib.Path(__file__).resolve().parents[2]
SIGNATURE = "natori_record_stripe_payment(uuid,text,integer,uuid)"
BASELINE_MD5 = "a3252bd59e1c86cd4186b8deb62325a5"
OBSERVED_MD5 = "26e4295ec6bf7a0dbb9488789ca593d0"
OBSERVED_BYTES = 5159


def payment_definition(path):
    text = path.read_text()
    matches = re.findall(r"create (?:or replace )?function public\.natori_record_stripe_payment\([\s\S]*?as \$\$([\s\S]*?)\$\$;", text)
    if len(matches) != 1:
        raise ValueError("exactly one payment definition required")
    body = matches[0]
    definition = re.search(r"create (?:or replace )?function public\.natori_record_stripe_payment\([\s\S]*?\$\$;", text).group()
    return definition, body


def observed_payment():
    definition, legacy = payment_definition(ROOT / "supabase/legacy-migrations/202607200001_natori_beta_safety.sql")
    _, baseline = payment_definition(ROOT / "supabase/migrations/20260723111730_etorie_baseline.sql")
    comments = "  -- 入金済み案件では金額照合より先にsessionを判定する。別sessionなら金額に\n  -- かかわらず重複入金として扱い、返金確認の対象にする。\n"
    if legacy.count(comments) != 1 or legacy.replace(comments, "", 1) != baseline:
        raise ValueError("payment semantics differ; refuse packaging")
    body = legacy.replace("\n", "\r\n")
    if hashlib.md5(baseline.encode()).hexdigest() != BASELINE_MD5 or hashlib.md5(body.encode()).hexdigest() != OBSERVED_MD5 or len(body.encode()) != OBSERVED_BYTES:
        raise ValueError("observed payment bytes differ")
    return definition.replace(legacy, body), body


def flow_package():
    manifest = json.loads((ROOT / "supabase/baseline/manifest.json").read_text())
    selected = manifest["activeMigrations"][37:53]
    if len(selected) != 16:
        raise ValueError("unexpected flow dependency count")
    observed_payment()  # Exact comment-only comparison, not normalized admission.
    payloads = []
    for order, file in enumerate(selected, 38):
        source = (ROOT / file).read_bytes()
        original_hash = hashlib.sha256(source).hexdigest()
        if original_hash != manifest["checksums"]["sha256:" + file]:
            raise ValueError("historical migration changed: " + file)
        sql = source.decode()
        if order == 53:
            old = json.dumps({"signature": SIGNATURE, "hash": BASELINE_MD5}, separators=(",", ":"))
            new = json.dumps({"signature": SIGNATURE, "hash": OBSERVED_MD5}, separators=(",", ":"))
            if sql.count(old) != 1:
                raise ValueError("exact L7 writer check not found")
            # Same fixed signature/owner/ACL checks as reviewed L7. Preserve the
            # observed body; never normalize or overwrite the payment function.
            sql = sql.replace(old, new, 1)
        encoded = sql.encode()
        payloads.append({"order": order, "source": file, "source_sha256": original_hash,
                         "payload_sha256": hashlib.sha256(encoded).hexdigest(),
                         "payload_bytes": len(encoded), "sql": sql})
    return payloads


def current_flow_package():
    # Keep reviewed predecessors immutable; the optional mail foundation (54)
    # is not a dependency of this current-operations release profile.
    entries = flow_package()
    path = ROOT / "scripts/natori-case-production-upgrade/current-flow.sql"
    content = path.read_bytes()
    entries.append({"order": "current-flow-forward", "source": str(path.relative_to(ROOT)),
        "release_file": "20261025110000_natori_case_current_flow.sql",
        "source_sha256": hashlib.sha256(content).hexdigest(),
        "payload_sha256": hashlib.sha256(content).hexdigest(),
        "payload_bytes": len(content), "sql": content.decode()})
    return entries


if __name__ == "__main__":
    import sys
    out = pathlib.Path(sys.argv[1]).resolve()
    if not str(out).startswith(("/tmp/", "/workspace/")):
        raise ValueError("local output only")
    out.mkdir(exist_ok=False)
    entries = current_flow_package() if sys.argv[2:] == ["--current-flow"] else flow_package()
    for entry in entries:
        name = entry.get("release_file", pathlib.Path(entry["source"]).name)
        (out / name).write_bytes(entry.pop("sql").encode())
    (out / "manifest.json").write_text(json.dumps({"profile": "existing-mail-production-observed-20261025",
        "externalApplication": False, "excluded": "20261025000000_natori_production_mail_evidence.sql",
        "precondition": {"signature": SIGNATURE, "body_md5": OBSERVED_MD5, "body_bytes": OBSERVED_BYTES},
        "migrations": entries}, indent=2) + "\n")
