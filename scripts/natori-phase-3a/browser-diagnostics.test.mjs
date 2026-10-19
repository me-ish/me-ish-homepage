import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {classifyFailure,createCompileDiagnostics,diagnosticLine} from './browser-diagnostics.mjs';
const stage='old-client-no-id-and-real-csrf-origin-boundaries-reject-before-sideeffects';
const privateText='PRIVATE_CANARY client@example.invalid https://private.invalid/path?token=PRIVATE_TOKEN /private/customer.json';
const parse=line=>JSON.parse(line.slice('[phase3a-diagnostic] '.length));

test('existing failure codes remain specific while arbitrary error messages are classified',()=>{
 assert.deepEqual(classifyFailure(new Error('CSRF')),{code:'CSRF',kind:'assertion',locator:'OTHER'});
 assert.deepEqual(classifyFailure(new Error('OLD_CLIENT')),{code:'OLD_CLIENT',kind:'assertion',locator:'OTHER'});
 assert.deepEqual(classifyFailure(Object.assign(new Error(privateText),{name:'TimeoutError'})),{code:'ASSERTION_FAILED',kind:'timeout',locator:'OTHER'});
 assert.equal(classifyFailure(new Error("strict mode violation getByLabel('お名前') "+privateText)).locator,'NAME');
});

test('every emitted schema drops arbitrary fields, messages, URLs and control characters',()=>{
 const hostile={stage:privateText+'\nforged-log',scenario:privateText,stream:privateText,process:privateText,codes:[privateText],markers:[privateText],checkpoint:privateText,status:privateText,before:privateText,after:privateText,beforeReadOk:privateText,afterReadOk:privateText,error:new Error(privateText),tests:privateText,failed:privateText,compileErrors:[privateText],omitted:privateText,request:privateText,token:privateText,customer:privateText,url:privateText};
 for(const event of ['test_failure','compile','boundary','side_effects','summary',privateText]){
  const line=diagnosticLine(event,hostile),data=parse(line);
  for(const needle of ['PRIVATE_CANARY','PRIVATE_TOKEN','example.invalid','private.invalid','/private/','forged-log','request','token','customer','url'])assert.equal(line.includes(needle),false);
  assert.equal(line.split('\n').length,1);assert.equal(typeof data.event,'string');
 }
});

test('status and row-count diagnostics preserve only bounded numeric facts',()=>{
 assert.deepEqual(parse(diagnosticLine('boundary',{checkpoint:'OLD_CLIENT',status:429})),{event:'boundary',checkpoint:'OLD_CLIENT',status:429});
 for(const status of [99,600,-1,Infinity,NaN,'403',null,4111111111111111])assert.equal(parse(diagnosticLine('boundary',{checkpoint:'CSRF',status})).status,null);
 assert.deepEqual(parse(diagnosticLine('side_effects',{before:4,after:5,beforeReadOk:true,afterReadOk:false})),{event:'side_effects',before:4,after:5,beforeReadOk:true,afterReadOk:false});
 assert.equal(parse(diagnosticLine('side_effects',{before:10001,after:-1})).before,null);
});

test('split compiler output distinguishes a manifest JSON failure without retaining raw output',()=>{
 const updates=[],d=createCompileDiagnostics({process:2,scenario:'legacy_to_structured',getStage:()=>stage,onUpdate:v=>updates.push(v)});
 d.write('stderr',Buffer.from('SyntaxErr'));d.write('stderr',Buffer.from('or: Unexpected end of JSON input\n at JSON.parse (<anonymous>)\n'));
 d.write('stderr',Buffer.from(' at loadManifest (/app/node_modules/next/dist/server/load-manifest.external.js:43:25) '+privateText+'\n'));
 const result=d.flush();
 assert.deepEqual(result,{events:[{process:2,scenario:'legacy_to_structured',stage,stream:'stderr',codes:['SyntaxError'],markers:['json_truncated','json_parse','next_manifest']}],omitted:0});
 assert.equal(JSON.stringify([result,updates]).includes('PRIVATE_CANARY'),false);
 assert.deepEqual(parse(diagnosticLine('compile',result.events[0])),{event:'compile',...result.events[0]});
});

test('context values are sanitized in stored evidence as well as job log output',()=>{
 const d=createCompileDiagnostics({process:privateText,scenario:privateText,getStage:()=>privateText,onUpdate:()=>{}});
 d.write('stdout',Buffer.from('SyntaxError: Unexpected token '+privateText));
 const result=d.flush();assert.equal(JSON.stringify(result).includes('PRIVATE_CANARY'),false);
 assert.deepEqual(result.events[0],{process:null,scenario:'other',stage:'other',stream:'stdout',codes:['SyntaxError'],markers:['unexpected_token']});
});

test('webpack cache and generated package classifications retain no raw paths',()=>{
 const d=createCompileDiagnostics({process:1,scenario:'completed_A_explicit_B',getStage:()=>stage,onUpdate:()=>{}});
 d.write('stderr',Buffer.from('<w> [webpack.cache.PackFileCacheStrategy] Restoring pack failed: SyntaxError: Error parsing /app/.next/package.json: Unexpected end of JSON input '+privateText+'\n'));
 const result=d.flush();
 assert.deepEqual(result.events[0].markers,['json_truncated','next_webpack_cache','package_manifest','next_generated_package','webpack_pack_restore']);
 assert.equal(JSON.stringify(result).includes('/app/'),false);assert.equal(JSON.stringify(result).includes('PRIVATE_CANARY'),false);
});

test('stdout/stderr cannot combine fragments to invent a diagnostic',()=>{
 const d=createCompileDiagnostics({process:0,scenario:'initial',getStage:()=>stage,onUpdate:()=>{}});
 d.write('stdout',Buffer.from('Syntax'));d.write('stderr',Buffer.from('Error\n'));assert.equal(d.snapshot().events.length,0);
 d.write('stdout',Buffer.from('Error\n'));assert.equal(d.flush().events.length,1);
 assert.throws(()=>d.write(privateText,Buffer.from('SyntaxError')),/DIAGNOSTIC_STREAM/);
});

test('bounded diagnostics retain failure classifications under noisy or unterminated output',()=>{
 const d=createCompileDiagnostics({process:0,scenario:'initial',getStage:()=>stage,onUpdate:()=>{}});
 d.write('stderr',Buffer.from('x'.repeat(16380)+'SyntaxError\n'+'SyntaxError\n'.repeat(50)));
 const result=d.flush();assert.equal(result.events.length,32);assert.equal(result.omitted,19);
 assert.equal(JSON.stringify(result).includes('xxx'),false);
});

test('unterminated output spanning several buffer windows retains a split detector',()=>{
 const d=createCompileDiagnostics({process:0,scenario:'initial',getStage:()=>stage,onUpdate:()=>{}});
 d.write('stderr',Buffer.from('x'.repeat(16380)+'SyntaxError: Unexpected end of JSON input '+privateText+'z'.repeat(40000)));
 assert.equal(d.snapshot().events.length,1);
 const result=d.flush();assert.equal(result.events.length,1);assert.equal(result.omitted,0);
 assert.deepEqual(result.events[0].codes,['SyntaxError']);assert.deepEqual(result.events[0].markers,['json_truncated']);
 assert.equal(JSON.stringify(result).includes('PRIVATE_CANARY'),false);
});

test('diagnostics do not change existing final gate or boundary expectations',()=>{
 const browser=readFileSync(new URL('./browser.mjs',import.meta.url),'utf8');
 assert.ok(browser.includes("check(results.length===9&&results.every(t=>t.status==='passed')&&compileErrors.size===0,'BROWSER_FAILED')"));
 assert.ok(browser.includes("['OLD_CLIENT',409,{'x-requested-with':'me-ish'}],['CSRF',403,{}],['ORIGIN',403,{'x-requested-with':'me-ish','origin':'https://attacker.invalid'}]"));
 assert.ok(browser.includes("check(after===before,'NO_SIDE_EFFECT')"));
});
