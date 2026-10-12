import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {readFileSync,writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {config,root,resultPath} from './common.mjs';
const base=config.api;
const secret='pr162-synthetic-jwt-signing-secret-only-keep-local';
function jwt(role) {
 const enc=x=>Buffer.from(JSON.stringify(x)).toString('base64url');
 const body=enc({alg:'HS256',typ:'JWT'})+'.'+enc({role,iss:'supabase',exp:Math.floor(Date.now()/1000)+3600});
 return body+'.'+createHmac('sha256',secret).update(body).digest('base64url');
}
const service=jwt('service_role'),anon=jwt('anon');
const results=[];
const pass=(name)=>{results.push({name,status:'pass'});console.log('PASS '+name);};
function sql(text) {return execFileSync('docker',['exec','-i',config.container,'psql','-X','-At','-q','-v','ON_ERROR_STOP=1','-U','postgres','-d','postgres'],{input:text,encoding:'utf8'});}
async function api(path,token=anon,method='GET',body,extraHeaders={}) {
 const response=await fetch(base+path,{method,headers:{authorization:'Bearer '+token,apikey:anon,'content-type':'application/json',...extraHeaders},body:body===undefined?undefined:JSON.stringify(body)});
 const text=await response.text();let json;try{json=JSON.parse(text);}catch{json=text;}
 return {status:response.status,json};
}
for (let attempt=0;attempt<20;attempt++) {
  try { if ((await fetch(base+"/auth/v1/health")).ok) break; } catch {}
  if(attempt===19) throw new Error("isolated Auth readiness failed");
  await new Promise(r=>setTimeout(r,500));
}
const users={};
for(const [name,confirmed] of [['alice',true],['bob',true],['stranger',true],['unverified',false]]) {
 let created=await api('/auth/v1/admin/users',service,'POST',{email:name+'@example.invalid',password:'Pr162-local-fixture-only-921',email_confirm:confirmed,role:'authenticated'});
 if(created.status===422) {const list=await api('/auth/v1/admin/users',service);created={status:200,json:list.json.users.find(x=>x.email===name+'@example.invalid')};}
 assert.equal(created.status,200);assert.match(created.json.id,/^[a-f0-9-]{36}$/);
 await api('/auth/v1/admin/users/'+created.json.id,service,'PUT',{role:'authenticated'});
 const login=await api('/auth/v1/token?grant_type=password',anon,'POST',{email:name+'@example.invalid',password:'Pr162-local-fixture-only-921'});
 if(!confirmed) {assert.equal(login.status,400);assert.equal(login.json.error_code,'email_not_confirmed');pass('unverified email cannot obtain an Auth session');}
 else {assert.equal(login.status,200);users[name]={id:created.json.id,token:login.json.access_token};}
}
pass('real GoTrue password sessions for two owners and unrelated user');
const schema=readFileSync(root+'/supabase/schema.sql','utf8');
const block=(name,kind)=>{
 const re=new RegExp('CREATE '+kind+' public\\.'+name+'[\\s\\S]*?;');const match=schema.match(re);assert.ok(match,name);return match[0];
};
let fixture=readFileSync(root+'/scripts/legacy-entry-read-security/fixture.sql','utf8').split('CREATE TABLE public.cert_links')[0];
fixture=fixture.split('\n').filter(x=>!x.startsWith('CREATE ROLE ')&&!x.startsWith('CREATE SCHEMA auth;')).join('\n')
 .replaceAll('11111111-1111-4111-8111-111111111111',users.alice.id).replaceAll('22222222-2222-4222-8222-222222222222',users.bob.id);
fixture=fixture.replace('SELECT id, external_user_id FROM public.entries;', 'SELECT id, external_user_id::text AS external_user_id FROM public.entries WHERE user_id=auth.uid() OR (user_id IS NULL AND email=auth.email());');
// v_my_external_user_ids DDL is absent from the repo: this is the explicit
// text/owner/invoker contract required by the archived bank policies, not a
// claim about the current production view definition.
fixture=fixture.replace(/CREATE FUNCTION auth\.(?:uid|email)\(\)[\s\S]*?\$\$;/g,'');
fixture+=`\nALTER TABLE public.entries ADD COLUMN artist_name text DEFAULT 'Synthetic artist', ADD COLUMN edition_total integer DEFAULT 1, ADD COLUMN created_at timestamptz DEFAULT now(), ADD COLUMN confirmed_at timestamptz;\n`;
fixture+=block('cert_links','TABLE')+'\nALTER TABLE public.cert_links ADD PRIMARY KEY(id);\n';
fixture+=block('v_cert_links_active','VIEW')+'\nALTER VIEW public.v_cert_links_active SET (security_invoker=true);\n';
fixture+=`GRANT ALL ON public.cert_links TO service_role; GRANT SELECT ON public.v_cert_links_active TO service_role;
ALTER TABLE public.cert_links ENABLE ROW LEVEL SECURITY;
CREATE SCHEMA IF NOT EXISTS graphql_public;
CREATE FUNCTION graphql_public.graphql("operationName" text DEFAULT NULL, query text DEFAULT NULL, variables jsonb DEFAULT NULL, extensions jsonb DEFAULT NULL) RETURNS jsonb LANGUAGE sql AS $$ SELECT graphql.resolve(query,variables,"operationName",extensions); $$;
GRANT USAGE ON SCHEMA graphql,graphql_public TO anon,authenticated,service_role;
COMMENT ON SCHEMA public IS '@graphql({"inflect_names":true})';\n`;
fixture+=block('artists_bank_accounts','TABLE')+`\nALTER TABLE public.artists_bank_accounts ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY;
ALTER TABLE public.artists_bank_accounts ADD UNIQUE(external_user_id);
ALTER TABLE public.artists_bank_accounts ENABLE ROW LEVEL SECURITY;
GRANT SELECT,INSERT,UPDATE ON public.artists_bank_accounts TO authenticated;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated,service_role;
GRANT ALL ON public.artists_bank_accounts TO service_role;
CREATE POLICY deny_all_auth ON public.artists_bank_accounts FOR ALL TO authenticated USING (false) WITH CHECK (false);
INSERT INTO public.artists_bank_accounts (external_user_id,bank_code,branch_code,account_type,account_number,account_name_kana) VALUES ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','0001','001','futsu','1234567','TEST');
NOTIFY pgrst,'reload schema';\n`;
sql(fixture);
writeFileSync(resultPath('certificate-view-definition.sql'),block('v_cert_links_active','VIEW')+'\n');
await new Promise(r=>setTimeout(r,500));
const collection='{ entriesCollection { edges { node { id email externalUserId } } } }';
const gql=(token=anon)=>api('/graphql/v1',token,'POST',{query:collection});
assert.equal((await api('/rest/v1/entries?select=id,email')).json.length,5);
const gBefore=await gql();assert.equal(gBefore.json.data.entriesCollection.edges.length,5);
pass('before migration anonymous REST and real pg_graphql expose synthetic entries');
const bankPath='/rest/v1/artists_bank_accounts?external_user_id=eq.aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const bankBody={external_user_id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',bank_code:'0001',branch_code:'001',account_type:'futsu',account_number:'1234567',account_name_kana:'TEST'};
const serverOnly={read:await api(bankPath,users.alice.token),save:await api('/rest/v1/artists_bank_accounts',users.alice.token,'POST',bankBody)};
assert.deepEqual(serverOnly.read.json,[]);assert.equal(serverOnly.save.status,403);
pass('intermediate server-only bank fixture rejects direct read/save');
sql(readFileSync(root+'/supabase/legacy-migrations/20260211_artists_bank_accounts_rls.sql','utf8'));
async function bankRoundtrip(stage) {
 const read=await api(bankPath,users.alice.token);assert.equal(read.status,200);assert.equal(read.json.length,1);
 const save=await api('/rest/v1/artists_bank_accounts?on_conflict=external_user_id',users.alice.token,'POST',{...bankBody,account_name_kana:'TEST-'+stage},{Prefer:'resolution=merge-duplicates'});assert.ok([200,201].includes(save.status));
 assert.equal((await api(bankPath,users.alice.token)).json[0].account_name_kana,'TEST-'+stage);
 const unlinked=await api('/rest/v1/artists_bank_accounts?on_conflict=external_user_id',users.alice.token,'POST',{...bankBody,external_user_id:'cccccccc-cccc-4ccc-8ccc-cccccccccccc'},{Prefer:'resolution=merge-duplicates'});assert.ok([200,201].includes(unlinked.status));
 assert.deepEqual((await api(bankPath,users.bob.token)).json,[]);
 const denied=await api('/rest/v1/artists_bank_accounts?on_conflict=external_user_id',users.bob.token,'POST',bankBody,{Prefer:'resolution=merge-duplicates'});assert.equal(denied.status,403);
 assert.equal((await api(bankPath,service)).json.length,1);
 pass(stage+' archived owner-policy bank read/update/unlinked insert; other owner denied; server read preserved');
}
await bankRoundtrip('before');
sql(readFileSync(root+'/supabase/migrations/20261011221028_lockdown_legacy_entries_reads.sql','utf8'));
sql("NOTIFY pgrst,'reload schema';");
await new Promise(r=>setTimeout(r,500));
const anonymous=await api('/rest/v1/entries?select=email');assert.equal(anonymous.status,401);assert.equal(anonymous.json.code,'42501');
const gAfter=await gql();assert.ok(gAfter.json.errors);assert.ok(gAfter.json.data==null);
pass('after migration anonymous REST denied and GraphQL collection inaccessible');
for(const [name,expected] of [['alice',[1,3]],['bob',[2,5]],['stranger',[]]]) {
 const rest=await api('/rest/v1/entries?select=id,email&order=id',users[name].token);
 assert.equal(rest.status,200);assert.deepEqual(rest.json.map(x=>x.id),expected);
 const graph=await gql(users[name].token);assert.equal(graph.status,200);
 assert.deepEqual(graph.json.data.entriesCollection.edges.map(x=>Number(x.node.id)),expected);
 pass(name+' actual Auth JWT: REST/GraphQL owner scope');
}
const changed=await api('/auth/v1/user',users.bob.token,'PUT',{data:{email:'alice@example.invalid',role:'service_role'}});assert.equal(changed.status,200);
const refreshed=await api('/auth/v1/token?grant_type=password',anon,'POST',{email:'bob@example.invalid',password:'Pr162-local-fixture-only-921'});
assert.deepEqual((await api('/rest/v1/entries?select=id&order=id',refreshed.json.access_token)).json.map(x=>x.id),[2,5]);
pass('real user_metadata changes do not grant owner/service privileges');
const uidLookup=await api('/rest/v1/entries?select=external_user_id&user_id=eq.'+users.alice.id,users.alice.token);
assert.equal(uidLookup.json[0].external_user_id,'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
const emailLookup=await api('/rest/v1/entries?select=external_user_id&user_id=is.null&email=eq.alice@example.invalid',users.alice.token);
assert.equal(emailLookup.json[0].external_user_id,'cccccccc-cccc-4ccc-8ccc-cccccccccccc');
pass('bank external ID lookup by linked UID and unlinked email preserved');
await bankRoundtrip('after');
results.push({name:'bank scope/provenance',status:'qualified-pass',details:'Retained legacy settings/bank; not used by Natori intake/payment. Owner policy from archived SQL, compatible text owner invoker view fixture; current production definition/application history not fetched.'});
writeFileSync(resultPath('api-results.json'),JSON.stringify({postgres:'17.6',auth:'2.196.0',postgrest:'14.17',pg_graphql:'1.6.2',results},null,2)+'\n');
writeFileSync(resultPath('runtime.json'),JSON.stringify({...config,service,anon,users}),{mode:0o600});
