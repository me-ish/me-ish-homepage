import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {privacyReadFailureLine} from './browser-diagnostics.mjs';
const parse=line=>JSON.parse(line.slice('[phasen-diagnostic] '.length));
const privateText='PRIVATE_CANARY client@example.invalid https://private.invalid/?token=PRIVATE_TOKEN /private/customer.json\nforged-log';

test('request exceptions retain only fixed type and connection classifications',()=>{
 const error=Object.assign(new Error('apiRequestContext.get: read ECONNRESET '+privateText),{cause:{code:'UND_ERR_SOCKET'}});
 assert.deepEqual(parse(privacyReadFailureLine(error,{checkpoint:'privacy_get',status:null,elapsedMs:12})),{event:'shared_home_privacy_read_failure',checkpoint:'privacy_get',kind:'Error',codes:['ECONNRESET','UND_ERR_SOCKET'],markers:[],status:null,privateDataAbsent:null,elapsedMs:12});
});
test('body exceptions retain known status and fixed markers',()=>{
 const error=Object.assign(new Error('Protocol error: No resource with given identifier found '+privateText),{name:'TypeError'});
 assert.deepEqual(parse(privacyReadFailureLine(error,{checkpoint:'privacy_body',status:200,elapsedMs:500})),{event:'shared_home_privacy_read_failure',checkpoint:'privacy_body',kind:'TypeError',codes:[],markers:['protocol_error','resource_missing'],status:200,privateDataAbsent:null,elapsedMs:500});
});
test('arbitrary fields, error properties and control characters never reach logs',()=>{
 const error={name:privateText,message:privateText,code:privateText,cause:{code:privateText},stack:privateText};
 const line=privacyReadFailureLine(error,{checkpoint:privateText,status:privateText,privateDataAbsent:privateText,elapsedMs:privateText,url:privateText,token:privateText});
 assert.deepEqual(parse(line),{event:'shared_home_privacy_read_failure',checkpoint:'other',kind:'other',codes:[],markers:[],status:null,privateDataAbsent:null,elapsedMs:null});
 for(const needle of ['PRIVATE_CANARY','PRIVATE_TOKEN','example.invalid','private.invalid','/private/','forged-log'])assert.equal(line.includes(needle),false);
 assert.equal(line.split('\n').length,1);
});
test('status and elapsed time accept only bounded integer facts',()=>{
 for(const value of [99,600,-1,NaN,Infinity,'200',null])assert.equal(parse(privacyReadFailureLine(null,{status:value})).status,null);
 for(const value of [-1,120001,NaN,Infinity,'12',null])assert.equal(parse(privacyReadFailureLine(null,{elapsedMs:value})).elapsedMs,null);
 assert.equal(parse(privacyReadFailureLine(null,{elapsedMs:0,status:599})).elapsedMs,0);
});
test('timeout and disposed response errors remain distinct fixed facts',()=>{
 const error=Object.assign(new Error('Timeout 30000ms exceeded '+privateText),{name:'TimeoutError'});
 assert.deepEqual(parse(privacyReadFailureLine(error)).markers,['timeout']);
 assert.deepEqual(parse(privacyReadFailureLine(new Error('Response has been disposed '+privateText))).markers,['response_disposed']);
 assert.deepEqual(parse(privacyReadFailureLine(new Error('Request context disposed. '+privateText))).markers,['request_context_disposed']);
});
test('HTTP failures remain distinguishable from private-data assertion failures',()=>{
 assert.deepEqual(parse(privacyReadFailureLine(new Error('UI_PRIVATE_DATA'),{checkpoint:'privacy_assert',status:500,privateDataAbsent:true,elapsedMs:50})),{event:'shared_home_privacy_read_failure',checkpoint:'privacy_assert',kind:'Error',codes:[],markers:[],status:500,privateDataAbsent:true,elapsedMs:50});
 assert.equal(parse(privacyReadFailureLine(new Error('UI_PRIVATE_DATA'),{checkpoint:'privacy_assert',status:200,privateDataAbsent:false})).privateDataAbsent,false);
});
test('privacy assertions and exception handling remain unchanged',()=>{
 const source=readFileSync(new URL('./browser.mjs',import.meta.url),'utf8');
 assert.ok(source.includes("check(response.status()===200&&!/@phase-n.invalid|snapshot|payload|provider_id|token_hash/.test(text),'UI_PRIVATE_DATA')"));
 assert.ok(source.includes("privacy_read:'SHARED_HOME_PRIVACY_READ_FAILED'"));
 assert.ok(source.includes("if(explicitCodes.has(error?.message))throw error"));
});
