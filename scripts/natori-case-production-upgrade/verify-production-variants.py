# Local-only hook: executed inside the network-none synthetic upgrade harness.
def function_catalog():
    return sql("select md5(coalesce(jsonb_agg(jsonb_build_object('definition',pg_get_functiondef(p.oid),'acl',p.proacl,'owner',p.proowner) order by p.oid),'[]'::jsonb)::text) from pg_proc p where p.pronamespace='public'::regnamespace and p.prokind='f'")

catalog_before = function_catalog()
original_failure = raw('begin;\n' + entry['sql'] + '\ncommit;')
check('original fence reproduces observed manual-payment dependency failure and rolls back', original_failure.returncode != 0 and 'natori_system_writer_changed: natori_confirm_manual_payment' in original_failure.stderr and function_catalog() == catalog_before and sql("select to_regnamespace('natori_case_guard') is null") == 't' and snapshot(shapes) == before)
compatible = compatibility_payload(entry['sql'])
sql('revoke execute on function natori_delete_project(uuid,uuid) from service_role')
acl_before = function_catalog()
denied_acl = raw('begin;\n' + compatible + '\ncommit;')
check('compatibility refuses unexpected delete RPC ACL and rolls back', denied_acl.returncode != 0 and 'natori_production_delete_precondition' in denied_acl.stderr and function_catalog() == acl_before and snapshot(shapes) == before)
sql('grant execute on function natori_delete_project(uuid,uuid) to service_role')
signature = 'natori_confirm_project_type_v1(uuid,uuid,text)'
observed = json.loads(sql("select jsonb_build_object('definition',pg_get_functiondef(oid),'body',prosrc) from pg_proc where oid=" + lit(signature) + '::regprocedure'))
sql(observed['definition'].replace(observed['body'], observed['body'] + '\n-- synthetic unknown definition\n'))
unknown_before = function_catalog()
unknown_failure = raw('begin;\n' + compatible + '\ncommit;')
REPORT['unknownWriterRollback'] = {'exitCode': unknown_failure.returncode, 'error': unknown_failure.stderr, 'catalogSame': function_catalog() == unknown_before, 'deleteHash': sql("select md5(prosrc) from pg_proc where oid='natori_delete_project(uuid,uuid)'::regprocedure"), 'guardAbsent': sql("select to_regnamespace('natori_case_guard') is null"), 'dataSame': snapshot(shapes) == before}
check('unknown writer hash is refused; soft-delete replacement and all partial fence DDL roll back', unknown_failure.returncode != 0 and 'natori_system_writer_changed: natori_confirm_project_type_v1' in unknown_failure.stderr and function_catalog() == unknown_before and sql("select md5(prosrc) from pg_proc where oid='natori_delete_project(uuid,uuid)'::regprocedure") == DELETE_OBSERVED and sql("select to_regnamespace('natori_case_guard') is null") == 't' and snapshot(shapes) == before)
sql(observed['definition'])
sql('begin;\n' + compatible + '\ncommit;')
check('compatible fence keeps the exact seven observed original bodies', all(sql('select md5(prosrc) from natori_case_guard.original_functions where oid=' + lit(s) + '::regprocedure') == actual for s, _, actual, _, _ in VARIANTS))
check('only delete RPC receives the reviewed soft-archive body before fencing', sql("select md5(prosrc) from natori_case_guard.original_functions where oid='natori_delete_project(uuid,uuid)'::regprocedure") == DELETE_REVIEWED)
check('private schema stays inaccessible and delete RPC owner/ACL unchanged', sql("select not has_schema_privilege('service_role','natori_case_guard','USAGE') and pg_get_userbyid(proowner)='postgres' and prosecdef and has_function_privilege('service_role',oid,'EXECUTE') and not has_function_privilege('anon',oid,'EXECUTE') and not has_function_privilege('authenticated',oid,'EXECUTE') from pg_proc where oid='natori_delete_project(uuid,uuid)'::regprocedure") == 't')
check('compatible fence performs no changes to pre-existing synthetic business records', snapshot(shapes) == before)
entry = {**entry, 'payload_sha256': hashlib.sha256(compatible.encode()).hexdigest(), 'payload_bytes': len(compatible.encode())}
REPORT['productionCompatibility'] = {'source': 'exact observed definitions; synthetic rows only', 'payload_sha256': entry['payload_sha256'], 'payload_bytes': entry['payload_bytes'], 'business_change': 'legacy delete RPC becomes soft archive, no row changes at migration time'}
