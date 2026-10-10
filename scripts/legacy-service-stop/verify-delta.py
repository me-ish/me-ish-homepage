#!/usr/bin/env python3
"""Allow exactly ten added policies and five reduced RPC ACLs in the fixture."""
import json
import sys
from pathlib import Path


def check(condition, message):
    if not condition:
        raise SystemExit(f"FAIL stopped catalog: {message}")


before, after = (json.loads(Path(path).read_text()) for path in sys.argv[1:])
check(before.keys() == after.keys(), "catalog sections changed")
for section in before.keys() - {"policies", "functions"}:
    check(before[section] == after[section], f"protected section changed: {section}")

policy_key = lambda p: (p["schemaname"], p["tablename"], p["policyname"])
old_policies = {policy_key(p): p for p in before["policies"]}
new_policies = {policy_key(p): p for p in after["policies"]}
for key, policy in old_policies.items():
    check(new_policies.get(key) == policy, f"existing policy changed: {key}")
expected = {}
for table in ["entries", "profiles", "portfolio_settings", "likes", "entry_comments"]:
    expected[("public", table, "legacy_stop_insert")] = ("INSERT", None, "false")
    if table in {"entries", "profiles", "portfolio_settings"}:
        expected[("public", table, "legacy_stop_update")] = ("UPDATE", "false", "false")
storage_check = "(bucket_id <> ALL (ARRAY['artworks'::text, 'avatars'::text, 'banners'::text, 'aura-assets'::text, 'card-assets'::text, 'gallery-entry-intake'::text, 'processing-meta'::text]))"
expected[("storage", "objects", "legacy_stop_storage_insert")] = ("INSERT", None, storage_check)
expected[("storage", "objects", "legacy_stop_storage_update")] = ("UPDATE", storage_check, storage_check)
check(new_policies.keys() - old_policies.keys() == expected.keys(), "added policy set differs")
for key, (command, using, with_check) in expected.items():
    policy = new_policies[key]
    check(policy["permissive"] == "RESTRICTIVE", f"policy is not restrictive: {key}")
    check(policy["roles"] == ["anon", "authenticated"], f"policy roles changed: {key}")
    check((policy["cmd"], policy["qual"], policy["with_check"]) == (command, using, with_check),
          f"policy commands/predicates differ: {key}")

normalize = lambda signature: signature.replace(" ", "")
old_functions = {normalize(f["signature"]): f for f in before["functions"]}
new_functions = {normalize(f["signature"]): f for f in after["functions"]}
check(old_functions.keys() == new_functions.keys(), "function set differs")
expected_functions = {
    "public.aura_claim_first20_free(text,uuid)",
    "public.aura_claim_meish_free(text,uuid)",
    "public.set_entry_portfolio_hidden(bigint,boolean)",
    "public.increment_entry_likes(bigint)",
    "public.toggle_like(anyelement)",
}
check(expected_functions <= old_functions.keys(), "reviewed RPC missing")
for signature, old_function in old_functions.items():
    new_function = new_functions[signature]
    if signature not in expected_functions:
        check(old_function == new_function, f"unrelated function changed: {signature}")
        continue
    check({k: v for k, v in old_function.items() if k != "acl"}
          == {k: v for k, v in new_function.items() if k != "acl"},
          f"RPC definition/owner changed: {signature}")
    check(set(new_function["acl"]) == {"postgres=X/postgres", "service_role=X/postgres"},
          f"RPC ACL differs: {signature}")

print("PASS stopped catalog: exactly 10 additive policies and 5 reduced RPC ACLs")
