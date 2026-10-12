// Reproducible local-only acceptance. No production configuration is accepted.
import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import { existsSync, mkdtempSync, readFileSync, readdirSync, writeFileSync, chmodSync, openSync } from 'node:fs';
import { createServer } from 'node:net';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
const root=fileURLToPath(new URL('../../../',import.meta.url));
const scripts=join(root,'scripts/legacy-entry-read-security/acceptance');
for(const name of ['DATABASE_URL','PGHOST','PGPORT','PGUSER','PGPASSWORD','SUPABASE_URL','NEXT_PUBLIC_SUPABASE_URL','SUPABASE_SERVICE_ROLE_KEY','SUPABASE_ACCESS_TOKEN','STRIPE_SECRET_KEY','RESEND_API_KEY']) {
  assert.ok(!Object.hasOwn(process.env,name),`Remove inherited configuration: ${name}`);
}
assert.ok(existsSync(join(root,'node_modules/next/dist/bin/next')), 'Install locked dependencies first');
const directory=mkdtempSync(join(tmpdir(),'pr162-acceptance-'));chmodSync(directory,0o700);
const prefix='pr162-acceptance-'+randomBytes(5).toString('hex');
const names={db:prefix+'-db',auth:prefix+'-auth',rest:prefix+'-rest'};
const containers=[],children=[];
const imageRefs={
  db:'postgres:17.6-bookworm@sha256:f3bd19c606e442c3d7bdfa8002e03fe260a1023351e0ea4598032022b68dd6e3',
  auth:'supabase/gotrue:v2.196.0@sha256:c0c25187a6b835e65a6f6e6c6b39d090e832d40e6de5186f2c038e0411944232',
  rest:'postgrest/postgrest:v14.17@sha256:c9dc201e555f5d8e37e7f39cdd4df0229774996e213bfd7de8d10ac609030f2c',
};
const env={PATH:process.env.PATH,PR162_ACCEPTANCE_DIR:directory};
const call=(cmd,args,input)=>execFileSync(cmd,args,{cwd:root,input,encoding:'utf8',stdio:['pipe','pipe','pipe']});
const sql=text=>call('docker',['exec','-i',names.db,'psql','-X','-q','-v','ON_ERROR_STOP=1','-U','postgres'],text);
const pause=ms=>new Promise(r=>setTimeout(r,ms));
async function wait(check,label) {
  for(let attempt=0;attempt<60;attempt++) {try{if(await check())return;}catch{} await pause(250);}
  throw new Error(label+' readiness failed');
}
async function port() {
  const s=createServer();await new Promise((resolve,reject)=>{s.once('error',reject);s.listen(0,'127.0.0.1',resolve);});
  const value=s.address().port;await new Promise(resolve=>s.close(resolve));return value;
}
function start(file,log) {
  const fd=openSync(join(directory,log),'w',0o600);
  const child=spawn(process.execPath,[join(scripts,file)],{cwd:root,env,stdio:['ignore',fd,fd]});children.push(child);return child;
}
async function worker(file,log) {
  const child=start(file,log);
  await new Promise((resolve,reject)=>child.once('exit',code=>code===0?resolve():reject(new Error(file+' failed; inspect private '+log))));
}
function docker(name,args) {
  call('docker',['run','--detach','--name',name,'--network',prefix,'--label','meish.entry-acceptance='+prefix,...args]);containers.push(name);
}
const sha256=value=>createHash('sha256').update(value).digest('hex');
const sourceFiles=['src/lib/coa/server.ts','src/lib/coa/reissueAuth.ts','src/middleware.ts','supabase/migrations/20261011221028_lockdown_legacy_entries_reads.sql','scripts/legacy-entry-read-security/fixture.sql',
 ...readdirSync(scripts).map(name=>'scripts/legacy-entry-read-security/acceptance/'+name)];
const source={nodeVersion:process.version,head:call('git',['rev-parse','HEAD']).trim(),diffSha256:sha256(call('git',['diff','HEAD'])),fileSha256:Object.fromEntries(sourceFiles.map(name=>[name,sha256(readFileSync(join(root,name)))]))};
writeFileSync(join(directory,'source.json'),JSON.stringify(source,null,2)+'\n');
console.log('Synthetic acceptance directory: '+directory);
let network=false;
try {
  for(const image of Object.values(imageRefs)) {
    try{call('docker',['image','inspect',image]);}catch{call('docker',['pull',image]);}
  }
  source.imageDigests=Object.fromEntries(Object.values(imageRefs).map(image=>[image,call('docker',['image','inspect','--format','{{index .RepoDigests 0}}',image]).trim()]));
  writeFileSync(join(directory,'source.json'),JSON.stringify(source,null,2)+'\n');
  const pkg=join(directory,'pg_graphql.deb');
  call('curl',['-fsSL','https://github.com/supabase/pg_graphql/releases/download/v1.6.2/pg_graphql-v1.6.2-pg17-amd64-linux-gnu.deb','-o',pkg]);
  assert.equal(sha256(readFileSync(pkg)),'fec20b9bf08b610db61fa492586522717e738c3df931c1bcd928c75492f98e1a','Pinned official pg_graphql package changed');
  const unpacked=join(directory,'pg_graphql');call('dpkg-deb',['-x',pkg,unpacked]);
  call('docker',['network','create','--internal','--label','meish.entry-acceptance='+prefix,prefix]);network=true;
  assert.equal(call('docker',['network','inspect','--format','{{.Internal}}',prefix]).trim(),'true');
  docker(names.db,['--tmpfs','/var/lib/postgresql/data:rw,nosuid,nodev,size=512m','--env','POSTGRES_HOST_AUTH_METHOD=trust',imageRefs.db,'postgres','-c','max_connections=40']);
  await wait(()=>call('docker',['exec',names.db,'pg_isready','-U','postgres']).includes('accepting connections'),'PostgreSQL');
  for(const [from,to] of [
    ['usr/lib/postgresql/lib/pg_graphql.so','/usr/lib/postgresql/17/lib/pg_graphql.so'],
    ['var/lib/postgresql/extension/pg_graphql.control','/usr/share/postgresql/17/extension/pg_graphql.control'],
    ['var/lib/postgresql/extension/pg_graphql--1.6.2.sql','/usr/share/postgresql/17/extension/pg_graphql--1.6.2.sql'],
  ]) call('docker',['cp',join(unpacked,from),names.db+':'+to]);
  sql(`CREATE ROLE supabase_auth_admin LOGIN SUPERUSER PASSWORD 'pr162-synthetic-db-only';
    ALTER ROLE supabase_auth_admin SET search_path=auth,public;
    CREATE ROLE authenticator LOGIN NOINHERIT PASSWORD 'pr162-synthetic-db-only';
    CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN; CREATE ROLE service_role NOLOGIN BYPASSRLS;
    GRANT anon,authenticated,service_role TO authenticator;
    CREATE SCHEMA auth AUTHORIZATION supabase_auth_admin; CREATE SCHEMA graphql_public; CREATE EXTENSION pg_graphql;`);
  docker(names.auth,['--env','GOTRUE_API_HOST=0.0.0.0','--env','GOTRUE_API_PORT=9999','--env','GOTRUE_DB_DRIVER=postgres','--env',`GOTRUE_DB_DATABASE_URL=postgres://supabase_auth_admin:pr162-synthetic-db-only@${names.db}:5432/postgres`,
    '--env','GOTRUE_SITE_URL=http://127.0.0.1','--env','API_EXTERNAL_URL=http://127.0.0.1/auth/v1','--env','GOTRUE_JWT_SECRET=pr162-synthetic-jwt-signing-secret-only-keep-local','--env','GOTRUE_JWT_ADMIN_ROLES=service_role','--env','GOTRUE_JWT_AUD=authenticated','--env','GOTRUE_JWT_EXP=3600','--env','GOTRUE_EXTERNAL_EMAIL_ENABLED=true','--env','GOTRUE_MAILER_AUTOCONFIRM=false','--env','GOTRUE_SMTP_HOST=127.0.0.1','--env','GOTRUE_SMTP_PORT=1',imageRefs.auth]);
  docker(names.rest,['--env',`PGRST_DB_URI=postgres://authenticator:pr162-synthetic-db-only@${names.db}:5432/postgres`,'--env','PGRST_DB_SCHEMAS=public,graphql_public','--env','PGRST_DB_ANON_ROLE=anon','--env','PGRST_JWT_SECRET=pr162-synthetic-jwt-signing-secret-only-keep-local',imageRefs.rest]);
  const ip=name=>call('docker',['inspect','--format','{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}',name]).trim();
  const cfg={syntheticOnly:true,container:names.db,api:`http://127.0.0.1:${await port()}`,app:`http://127.0.0.1:${await port()}`,authOrigin:`http://${ip(names.auth)}:9999`,restOrigin:`http://${ip(names.rest)}:3000`};
  writeFileSync(join(directory,'runtime.json'),JSON.stringify(cfg),{mode:0o600});
  start('gateway.mjs','gateway.private.log');
  await wait(async()=>{const r=await fetch(cfg.api+'/auth/v1/health',{signal:AbortSignal.timeout(1000)});return r.ok;},'Auth/gateway');
  await worker('api.mjs','api.log');console.log('PASS real Auth/REST/GraphQL and bank acceptance');
  const testLog=openSync(join(directory,'certificate.log'),'w',0o600);
  const test=spawn(process.execPath,[join(root,'node_modules/vitest/vitest.mjs'),'run','--config',join(scripts,'vitest.config.mts')],{cwd:root,env,stdio:['ignore',testLog,testLog]});children.push(test);
  await new Promise((resolve,reject)=>test.once('exit',code=>code===0?resolve():reject(new Error('Certificate assertions failed; inspect certificate.log'))));
  sql("ALTER TABLE public.entries ADD COLUMN image_url text; UPDATE public.entries SET title='Synthetic Certificate Visible',email='PRIVATE_CERT_EMAIL_CANARY@example.invalid',plan_payment_session_id='PRIVATE_CERT_PAYMENT_CANARY',image_url='https://private.example.invalid/PRIVATE_CERT_IMAGE_CANARY' WHERE id=1; NOTIFY pgrst,'reload schema';");
  start('start-app.mjs','app.private.log');
  await worker('http.mjs','http.log');console.log('PASS real Next HTML/RSC acceptance');
  writeFileSync(join(directory,'certificate-view-executed.txt'),sql("SELECT pg_get_viewdef('public.v_cert_links_active'::regclass,true); SELECT reloptions FROM pg_class WHERE oid='public.v_cert_links_active'::regclass;"));
  writeFileSync(join(directory,'acceptance.json'),JSON.stringify({source,api:JSON.parse(readFileSync(join(directory,'api-results.json'))),http:JSON.parse(readFileSync(join(directory,'http-results.json'))),certificateAssertions:'passed',syntheticOnly:true},null,2)+'\n');
  console.log('PASS acceptance; share only acceptance.json, source.json and certificate-view-executed.txt');
} finally {
  for(const child of children) if(child.exitCode===null) child.kill('SIGTERM');
  await pause(500);
  for(const name of containers.reverse()) {
    const owner=call('docker',['inspect','--format','{{index .Config.Labels "meish.entry-acceptance"}}',name]).trim();
    assert.equal(owner,prefix);call('docker',['rm','-f',name]);
  }
  if(network) {
    assert.equal(call('docker',['network','inspect','--format','{{index .Labels "meish.entry-acceptance"}}',prefix]).trim(),prefix);
    call('docker',['network','rm',prefix]);
  }
  console.log('Dedicated synthetic services removed');
}
