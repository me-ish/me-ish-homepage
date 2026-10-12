import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
vi.mock('server-only',()=>({}));
const cfg=JSON.parse(readFileSync(`${process.env.PR162_ACCEPTANCE_DIR}/runtime.json`,'utf8'));
if(!cfg.syntheticOnly || new URL(cfg.api).hostname!=='127.0.0.1') throw new Error('Synthetic local runtime required');
const url=cfg.api;
const admin=createClient(url,cfg.service,{auth:{persistSession:false}});
const token='local-synthetic-certificate-token';
const hash=(format:'hex'|'base64'='hex')=>createHash('sha256').update(token).digest(format);
async function insert(extra:Record<string,unknown>={}) {
 const result=await admin.from('cert_links').insert({entry_id:1,token_hash:hash(),expires_at:new Date(Date.now()+60000).toISOString(),...extra});
 expect(result.error).toBeNull();
}
beforeEach(async()=>{
 vi.resetModules();vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL',url);vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY',cfg.service);
 vi.stubEnv('NEXT_PUBLIC_SITE_URL',cfg.app);vi.stubEnv('ADMIN_API_TOKEN','pr162-local-admin-only');
 vi.stubEnv('CERT_ONE_TIME','0');vi.stubEnv('CERT_LINK_TTL_DAYS','7');
 const cleared=await admin.from('cert_links').delete().gt('entry_id',0);expect(cleared.error).toBeNull();
});
afterEach(()=>{vi.unstubAllEnvs();vi.unstubAllGlobals();});
describe('real PostgreSQL active view and PostgREST certificate boundary',()=>{
 it.each(['hex','base64'] as const)('accepts valid %s token with exact URL ID',async(format)=>{
  await insert({token_hash:hash(format)});
  const {verifyCertToken}=await import('@/lib/coa/server');expect(await verifyCertToken(token,1)).toEqual({ok:true,entryId:1});
 });
 it.each([
  {expires_at:new Date(Date.now()-60000).toISOString()},
  {revoked:true},
  {used_at:new Date().toISOString()},
  {entry_id:2},
 ])('rejects inactive or different-entry link %#',async(extra)=>{
  await insert(extra);
  const {verifyCertToken}=await import('@/lib/coa/server');expect(await verifyCertToken(token,1)).toEqual({ok:false,reason:'notfound'});
 });
 it('accepts a null expiry as specified by the actual archived view',async()=>{
  await insert({expires_at:null});const {verifyCertToken}=await import('@/lib/coa/server');
  expect(await verifyCertToken(token,1)).toEqual({ok:true,entryId:1});
 });
 it('rejects exact database expiry boundary',async()=>{
  await insert({expires_at:new Date().toISOString()});const {verifyCertToken}=await import('@/lib/coa/server');
  expect(await verifyCertToken(token,1)).toEqual({ok:false,reason:'notfound'});
 });
 it('allows exactly one concurrent ONE_TIME claimant',async()=>{
  vi.stubEnv('CERT_ONE_TIME','1');await insert();const {verifyCertToken}=await import('@/lib/coa/server');
  const outcomes=await Promise.all(Array.from({length:8},()=>verifyCertToken(token,1)));
  expect(outcomes.filter(x=>x.ok)).toHaveLength(1);
  expect((await admin.from('cert_links').select('used_at').single()).data?.used_at).toBeTruthy();
  expect(await verifyCertToken(token,1)).toEqual({ok:false,reason:'notfound'});
 });
 it('does not consume a token requested with a different URL entry ID',async()=>{
  vi.stubEnv('CERT_ONE_TIME','1');await insert();const {verifyCertToken}=await import('@/lib/coa/server');
  expect((await verifyCertToken(token,2)).ok).toBe(false);
  expect((await verifyCertToken(token,1)).ok).toBe(true);
 });
 it('requires explicit admin authentication and supports a legitimate issuance/read chain',async()=>{
  const {issueReissueLink,verifyCertToken,getEntryForCoA}=await import('@/lib/coa/server');
  await expect(issueReissueLink(1,new Request(url))).rejects.toThrow('missing_admin_token');
  const issued=await issueReissueLink(1,new Request(url,{headers:{'x-meish-admin-token':'pr162-local-admin-only'}}));
  const t=new URL(issued).searchParams.get('t');expect((await verifyCertToken(t,1)).ok).toBe(true);
  const entry=await getEntryForCoA(1);expect(Object.keys(entry!).sort()).toEqual(['id','title','artist_name','edition_total','created_at','confirmed_at'].sort());
 });
 it.each([{revoked:true},{expires_at:new Date(Date.now()-60000).toISOString()}])
 ('rejects a real state change after active lookup but before ONE_TIME claim %#',async(change)=>{
  vi.stubEnv('CERT_ONE_TIME','1');await insert();
  const nativeFetch=globalThis.fetch;let changed=false;
  vi.stubGlobal('fetch',async(input:RequestInfo|URL,init?:RequestInit)=>{
   const requestUrl=typeof input==='string'?input:input instanceof URL?input.href:input.url;
   if(!changed && requestUrl.includes('/rest/v1/cert_links') && init?.method==='PATCH') {
    changed=true;
    const response=await nativeFetch(url+'/rest/v1/cert_links?entry_id=eq.1',{method:'PATCH',headers:{authorization:'Bearer '+cfg.service,'content-type':'application/json'},body:JSON.stringify('expires_at' in change?{expires_at:new Date(Date.now()-10).toISOString()}:change)});
    expect(response.ok).toBe(true);
   }
   return nativeFetch(input,init);
  });
  const {verifyCertToken}=await import('@/lib/coa/server');
  expect(await verifyCertToken(token,1)).toEqual({ok:false,reason:'notfound'});
  expect(changed).toBe(true);
  const record=await admin.from('cert_links').select('used_at').single();expect(record.data?.used_at).toBeNull();
 });

});
