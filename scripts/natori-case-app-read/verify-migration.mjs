import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';

// Runs only against the runner's owned, network-none synthetic PostgreSQL DB.
export function verifyMigration({sql,migration,owner,other,ids,checksum,check,out}) {
 const signatures=['public.natori_case_snapshot_v1(uuid,uuid)','public.natori_case_workspace_v1(uuid)'];
 const functionCount=()=>Number(sql("SELECT count(*) FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname IN ('natori_case_snapshot_v1','natori_case_workspace_v1');"));
 const businessBefore=checksum();
 const preservedState=()=>sql(`SELECT jsonb_build_object(
  'tables',(SELECT jsonb_agg(jsonb_build_object('name',c.relname,'owner',c.relowner,'acl',c.relacl,
    'rls',c.relrowsecurity,'forceRls',c.relforcerowsecurity,
    'columns',(SELECT jsonb_agg(to_jsonb(a) ORDER BY a.attnum) FROM pg_attribute a WHERE a.attrelid=c.oid AND a.attnum>0),
    'constraints',(SELECT jsonb_agg(to_jsonb(k) ORDER BY k.oid) FROM pg_constraint k WHERE k.conrelid=c.oid),
    'triggers',(SELECT jsonb_agg(to_jsonb(t) ORDER BY t.oid) FROM pg_trigger t WHERE t.tgrelid=c.oid)) ORDER BY c.relname)
    FROM pg_class c WHERE c.relnamespace='public'::regnamespace AND c.relkind='r'),
  'policies',(SELECT jsonb_agg(to_jsonb(p) ORDER BY p.oid) FROM pg_policy p),
  'roles',(SELECT jsonb_agg(jsonb_build_object('name',rolname,'super',rolsuper,'inherit',rolinherit,
    'bypass',rolbypassrls,'createRole',rolcreaterole,'createDb',rolcreatedb,'login',rolcanlogin) ORDER BY rolname) FROM pg_roles),
  'memberships',(SELECT jsonb_agg(to_jsonb(m) ORDER BY m.roleid,m.member) FROM pg_auth_members m),
  'defaultAcl',(SELECT jsonb_agg(to_jsonb(a) ORDER BY a.oid) FROM pg_default_acl a),
  'schema',(SELECT jsonb_build_object('owner',nspowner,'acl',nspacl) FROM pg_namespace WHERE nspname='public'));
 `);
 const expectFailure=(text,pattern)=>{
  assert.throws(()=>sql(text),error=>pattern.test(String(error.stderr??error.message)));
 };

 // Adversarial fixture setup, never grants on an actual service.
 sql(`CREATE ROLE fixture_extra_reader NOLOGIN;
 ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO anon,authenticated;
 ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO service_role WITH GRANT OPTION;
 ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO fixture_extra_reader;`);
 const beforeUnexpected=preservedState();
 expectFailure(migration,/NATORI_CASE_READ_SECURITY_CONTRACT_REQUIRED/);
 assert.equal(functionCount(),0);assert.equal(preservedState(),beforeUnexpected);assert.equal(checksum(),businessBefore);
 check('Migration: unexpected default EXECUTE recipient aborts and rolls back both functions without widening roles or table access');
 sql('ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM fixture_extra_reader;');

 // Collision on the second CREATE must roll back the first, preserving existing code.
 sql("CREATE FUNCTION public.natori_case_workspace_v1(p_owner_id uuid) RETURNS jsonb LANGUAGE sql AS $$SELECT '{\"sentinel\":true}'::jsonb$$;");
 const sentinel=sql("SELECT to_jsonb(p)::text FROM pg_proc p WHERE p.oid='public.natori_case_workspace_v1(uuid)'::regprocedure;");
 const beforeCollision=preservedState();
 expectFailure(migration,/already exists with same argument types/);
 assert.equal(functionCount(),1);assert.equal(sql("SELECT to_jsonb(p)::text FROM pg_proc p WHERE p.oid='public.natori_case_workspace_v1(uuid)'::regprocedure;"),sentinel);
 assert.equal(preservedState(),beforeCollision);assert.equal(checksum(),businessBefore);
 sql('DROP FUNCTION public.natori_case_workspace_v1(uuid);');
 check('Migration: existing collection function collision preserves it and rolls back the new snapshot helper');

 const beforeApply=preservedState();sql(migration);
 assert.equal(functionCount(),2);assert.equal(preservedState(),beforeApply);assert.equal(checksum(),businessBefore);
 check('Migration: formal file applies atomically; business data, tables, RLS, policies, schema/default ACLs and role attributes unchanged');

 const catalog=JSON.parse(sql(`SELECT jsonb_agg(jsonb_build_object('name',p.proname,'owner',pg_get_userbyid(p.proowner),
  'stable',p.provolatile='s','invoker',NOT p.prosecdef,'config',p.proconfig,
  'acl',(SELECT jsonb_agg(jsonb_build_object('role',CASE WHEN a.grantee=0 THEN 'PUBLIC' ELSE pg_get_userbyid(a.grantee) END,
    'privilege',a.privilege_type,'grantable',a.is_grantable) ORDER BY a.grantee) FROM aclexplode(p.proacl) a)) ORDER BY p.proname)
  FROM pg_proc p WHERE p.oid IN (${signatures.map(s=>`'${s}'::regprocedure`).join(',')});`));
 for(const row of catalog){
  assert.equal(row.stable,true);assert.equal(row.invoker,true);assert.deepEqual(row.config,['search_path=""']);
  assert.deepEqual(row.acl.map(a=>a.role).sort(),[row.owner,'service_role'].sort());
  assert.equal(row.acl.find(a=>a.role==='service_role').grantable,false);
 }
 for(const signature of signatures){
  for(const role of ['anon','authenticated','fixture_extra_reader'])assert.equal(sql(`SELECT has_function_privilege('${role}','${signature}','EXECUTE');`),'f');
  assert.equal(sql(`SELECT has_function_privilege('service_role','${signature}','EXECUTE');`),'t');
 }
 for(const role of ['anon','authenticated']){
  expectFailure(`SET ROLE ${role};SELECT public.natori_case_workspace_v1('${owner}');`,/permission denied for function natori_case_workspace_v1/);
  expectFailure(`SET ROLE ${role};SELECT * FROM public.natori_case_snapshot_v1('${ids[0]}','${owner}');`,/permission denied for function natori_case_snapshot_v1/);
 }
 check('Migration: both functions STABLE/invoker/empty search_path, owner + service_role only; PUBLIC/anon/authenticated cannot execute, no service grant option');

 // An inherited browser capability must also abort, even with a direct ACL removed.
 // Drop only the two fixture functions inside a transaction; the expected error
 // restores the applied functions as well as the role membership on disconnect.
 expectFailure(`BEGIN;DROP FUNCTION public.natori_case_workspace_v1(uuid);DROP FUNCTION public.natori_case_snapshot_v1(uuid,uuid);
  GRANT service_role TO authenticated;${migration.replace(/^BEGIN;$/m,'').replace(/^COMMIT;$/m,'')};ROLLBACK;`,/NATORI_CASE_READ_SECURITY_CONTRACT_REQUIRED/);
 assert.equal(preservedState(),beforeApply);assert.equal(functionCount(),2);
 check('Migration: inherited authenticated EXECUTE also fails closed and rolls back');

 const read=expression=>JSON.parse(sql(`BEGIN READ ONLY;SET LOCAL ROLE service_role;SELECT ${expression};ROLLBACK;`));
 const own=read(`public.natori_case_workspace_v1('${owner}')`),foreign=read(`public.natori_case_workspace_v1('${other}')`);
 assert.equal(own.rows.length,8);assert.equal(foreign.rows.length,1);
 assert(own.rows.every(r=>r.project.user_id===owner));assert(foreign.rows.every(r=>r.project.user_id===other));
 assert.equal(new Set(own.rows.map(r=>r.snapshot_id)).size,1);assert.equal(new Set(own.rows.map(r=>r.observed_at)).size,1);
 for(const [project,who] of [[ids[0],other],['ffffffff-ffff-4fff-8fff-ffffffffffff',owner],[ids[0],null]]){
  assert.equal(sql(`BEGIN READ ONLY;SET LOCAL ROLE service_role;SELECT count(*) FROM public.natori_case_snapshot_v1('${project}',${who?`'${who}'`:'NULL'});ROLLBACK;`),'0');
 }
 assert.deepEqual(read("public.natori_case_workspace_v1('ffffffff-ffff-4fff-8fff-ffffffffffff')"),{complete:true,rows:[]});
 assert.deepEqual(read('public.natori_case_workspace_v1(NULL)'),{complete:true,rows:[]});
 check('Migration: service_role still filters SQL owner; null/foreign/missing snapshots expose nothing; all owned rows share snapshot and observed time');

 for(const count of [50,51]){
  const value=JSON.parse(sql(`BEGIN;INSERT INTO public.natori_projects(id,user_id)
   SELECT md5('formal cap'||n)::uuid,'${owner}'::uuid FROM generate_series(1,${count-8}) n;
   SET LOCAL ROLE service_role;SELECT public.natori_case_workspace_v1('${owner}');ROLLBACK;`));
  assert.equal(value.complete,count===50);assert.equal(value.rows.length,count===50?50:0);
 }
 assert.equal(checksum(),businessBefore);assert.equal(preservedState(),beforeApply);
 check('Migration: exactly 50 accepted and 51 explicitly incomplete; READ ONLY calls and rolled-back boundary fixtures leave business rows unchanged');
 writeFileSync(out+'/migration-results.json',JSON.stringify({success:true,checks:7,catalog,businessChecksum:businessBefore,
  preserved:['table definitions/constraints/triggers/ACLs','RLS/policies','schema/default ACLs','roles/memberships','business rows'],
  scope:'new forward file only; reduced synthetic dependency schema, not historical replay or actual service apply'},null,2));
}
