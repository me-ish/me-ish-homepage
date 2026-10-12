import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {config as cfg,resultPath} from './common.mjs';
import {createHash} from 'node:crypto';
const {app,api}=cfg;
const results=[];
const pass=name=>{results.push({name,status:'pass'});console.log('PASS '+name);};
async function links() {return (await (await fetch(api+'/rest/v1/cert_links?select=id',{headers:{authorization:'Bearer '+cfg.service}})).json()).length;}
for(let attempt=0;attempt<30;attempt++){try{if((await fetch(app+'/favicon2.png')).ok)break;}catch{};if(attempt===29)throw new Error('local app readiness failed');await new Promise(r=>setTimeout(r,500));}
const before=await links();
for(const [label,query] of [['missing',''],['invalid','?t=unrecognized-local-token'],['invalid-key','?t=unrecognized-local-token&natori-key=bad']]) {
 const r=await fetch(app+'/en/cert/1'+query,{redirect:'manual'}),html=await r.text();
 assert.equal(r.status,200);assert.equal(r.headers.get('referrer-policy'),'no-referrer');assert.match(r.headers.get('cache-control'),/no-store/);
 assert.ok(!html.includes('Synthetic Certificate Visible'));
}
assert.equal(await links(),before);pass('missing/invalid token pages do not issue links or display an entry');
for(const key of ['','bad','pr162-local-dashboard-only']) {
 const r=await fetch(app+'/ja/cert/1?t=unrecognized-local-token'+(key?'&natori-key='+key:''),{redirect:'manual'});
 assert.equal(r.status,307);assert.equal(r.headers.get('referrer-policy'),'no-referrer');assert.match(r.headers.get('cache-control'),/no-store/);
}
pass('locale redirects and absent/wrong/correct dashboard-key branches protect privacy');
for(const headers of [{},{'x-meish-admin-token':'incorrect'}]) {
 const r=await fetch(app+'/api/cert/reissue?entryId=1',{headers,redirect:'manual'});assert.ok([401,403].includes(r.status));
}
assert.equal(await links(),before);pass('HTTP anonymous/wrong-admin reissue rejected without writes');
const issued=await fetch(app+'/api/cert/reissue?entryId=1',{headers:{'x-meish-admin-token':'pr162-local-admin-only'},redirect:'manual'});
assert.equal(issued.status,302);const destination=new URL(issued.headers.get('location'));const token=destination.searchParams.get('t');assert.ok(token);
const valid='/en/cert/1?t='+encodeURIComponent(token);
for(const [label,headers] of [['html',{}],['rsc',{RSC:'1'}]]) {
 const r=await fetch(app+valid,{headers}),text=await r.text();assert.equal(r.status,200);assert.ok(text.includes('Synthetic Certificate Visible'));
 if(label==='rsc') assert.match(r.headers.get('content-type'),/text\/x-component/);
 for(const marker of ['PRIVATE_CERT_EMAIL_CANARY','PRIVATE_CERT_PAYMENT_CANARY','PRIVATE_CERT_IMAGE_CANARY','external_user_id','user_id']) assert.ok(!text.includes(marker),label+' leaked '+marker);
 assert.equal(r.headers.get('referrer-policy'),'no-referrer');assert.match(r.headers.get('cache-control'),/no-store/);
 
}
pass('legitimate admin issue -> active view -> HTTP HTML/RSC; internal markers absent');
const wrong=await fetch(app+'/en/cert/2?t='+encodeURIComponent(token));assert.ok(!(await wrong.text()).includes('Bob public'));
pass('HTTP token/URL entry ID mismatch never displays other entry');
for(const [label,extra] of [['expired',{expires_at:new Date(Date.now()-60000).toISOString()}],['revoked',{revoked:true}],['used',{used_at:new Date().toISOString()}]]) {
 const t='local-http-'+label;const h=createHash('sha256').update(t).digest('hex');
 const inserted=await fetch(api+'/rest/v1/cert_links',{method:'POST',headers:{authorization:'Bearer '+cfg.service,'content-type':'application/json'},body:JSON.stringify({entry_id:1,token_hash:h,expires_at:new Date(Date.now()+60000).toISOString(),...extra})});assert.equal(inserted.status,201);
 const r=await fetch(app+'/en/cert/1?t='+t);assert.ok(!(await r.text()).includes('Synthetic Certificate Visible'));
}
pass('HTTP expired/revoked/used tokens rejected through actual active view');
writeFileSync(resultPath('http-results.json'),JSON.stringify({results},null,2)+'\n');
