import {StringDecoder} from 'node:string_decoder';

// Only fixed classifications leave this test process. No free-form messages or paths.
const stages=new Set(['preflight','actual-submit-commit-ack-loss-freezes-and-reload-recovers-one-receipt','same-completed-capability-replays-after-server-admission-closes','interrupted-before-begin-reload-fences-delayed-request-and-restores-answers','reload-pending-image-reselection-validates-original-bytes-before-same-id-retry','old-client-no-id-and-real-csrf-origin-boundaries-reject-before-sideeffects','mobile-pending-controls-and-completed-confirmation-do-not-overflow','confirmed-completed-explicit-new-request-preserves-A-and-creates-distinct-B','legacy-interrupted-selector-structured-reload-failed-retains-full-original-and-allows-correction','structured-detailed-interrupted-selector-legacy-reload-failed-retains-full-original-and-allows-correction']);
const scenarios=new Set(['initial','completed_A_explicit_B','legacy_to_structured','structured_to_legacy']);
const detectors=['Module not found','Failed to compile','SyntaxError','EADDRINUSE'];
// Markers identify nearby text only; co-occurrence alone does not establish a cause.
const markers=[['json_truncated','Unexpected end of JSON input'],['unexpected_token','Unexpected token'],['json_expected_property','Expected property name'],['json_trailing_content','Unexpected non-whitespace character'],['json_parse','JSON.parse'],['request_json','parseJSONFromBytes'],['next_manifest','load-manifest'],['next_components','load-components'],['next_dev_server','next-dev-server'],['next_hot_reloader','hot-reloader'],['next_webpack_cache','webpack.cache'],['next_server_actions','server-reference-manifest'],['next_build_manifest','build-manifest'],['next_routes_manifest','routes-manifest'],['next_app_paths_manifest','app-paths-manifest'],['next_font_manifest','next-font-manifest'],['next_pages_manifest','pages-manifest'],['next_middleware_manifest','middleware-manifest']];
markers.push(['package_manifest','package.json'],['next_generated_package','.next/package.json'],['webpack_pack_restore','Restoring pack failed'],['webpack_pack_write','Caching failed for pack']);
const markerCodes=new Set(markers.map(([code])=>code));
const safeStage=value=>stages.has(value)?value:'other';
const finite=(value,max)=>Number.isSafeInteger(value)&&value>=0&&value<=max?value:null;
export function classifyFailure(error){
 const codes=["ACTIVE_RELEASED_ONLY_AFTER_FAILED","ACTUAL_ACCEPTED_RESPONSE","ACTUAL_RATE_LIMIT_REACHED","ADDITIONAL_NEXT_READY","ASSERTION_FAILED","AUTH_FIXTURE","A_ATOMIC_EFFECTS","A_NOTICES_UNCHANGED","BROWSER_FAILED","B_RECEIPT_RELOAD","CHANGED_FILE_NO_POST","CLOSE","CLOSED_REPLAY","CORRECTED_ATOMIC_EFFECTS","CORRECTED_NEW_OPERATION","CORRECTED_NOTICE_SNAPSHOT","CSRF","DESTINATION_REJECTED","EFFECTS_READ","EPHEMERAL_REQUIRED","EXPECTED_REAL_SUBMISSIONS","EXPLICIT_CONFIRMED_RELEASES_ACTIVE","EXPLICIT_NEW_INTENT_SAME_ANSWERS_NEW_ID","FROZEN_OPERATION_REQUIRED","INTERRUPTION_NO_SERVER_EFFECTS","NEW_REQUEST_CHECKS_COMPLETED_CAPABILITY","NEXT_DID_NOT_EXIT","NEXT_EXITED_AFTER_READY","NEXT_PORT_NOT_CLOSED","NEXT_READY","NO_MOBILE_OVERFLOW","NO_SIDE_EFFECT","OLD_CLIENT","ONE_ATOMIC_INTAKE","ONLY_CORRECTED_REQUEST_EFFECTS","ONLY_TWO_NEW_REQUEST_EFFECTS","OP","OPERATION_READ","ORIGIN","ORIGINAL_FAILURE_PRESERVED","ORIGINAL_USER_LABELS","OWNER_NOTICES_READ","OWNER_PROJECTS_READ","PENDING_FIXTURE","REAL_COMMIT","RELOAD_NO_POST","REPLAY_NO_NOTICE","SAME_OPERATION_COMPLETES","SETTLED_CACHE","SWITCH_AUTHORITATIVE_FAILED_NO_EFFECTS","TOMBSTONE_NO_EFFECT","TWO_PROJECTS_EXACTLY_ONCE","VISIBLE_ORIGINAL_ANSWERS"];
 const message=typeof error?.message==='string'?error.message:'';
 const code=codes.includes(message)?message:'ASSERTION_FAILED';
 const kind=message.includes('strict mode violation')?'strict_locator':error?.name==='TimeoutError'||/\bTimeout\s+\d+ms\s+exceeded\b/i.test(message)?'timeout':error?.name==='AssertionError'||/^expect(?:\(|\.)/.test(message)||codes.includes(message)?'assertion':'other';
 const firstLabelLine=message.split(/\r?\n/).find(line=>line.includes('getByLabel('))??'';
 const expression=/getByLabel\(\s*(\/(?:\\.|[^\/\r\n])*\/[a-z]*|'(?:\\.|[^'\r\n])*'|"(?:\\.|[^"\r\n])*")/.exec(firstLabelLine)?.[1]??'';
 const label=expression.startsWith('/')?expression.slice(1,expression.lastIndexOf('/')).replace(/^\^|\$$/g,''):expression.slice(1,-1);
 const labels={'\u304a\u540d\u524d':'NAME','\u3054\u76f8\u8ac7\u30fb\u3054\u4f9d\u983c\u306e\u5185\u5bb9':'MESSAGE','\u3054\u4f9d\u983c\u306e\u8a73\u7d30':'MESSAGE','\u4fdd\u5b58\u3057\u305f\u5165\u529b\u5185\u5bb9':'SAVED_ANSWERS','\u5143\u306e\u4fdd\u5b58\u60c5\u5831':'RAW_ANSWERS','\u518d\u8a66\u884c\u7528\u306e\u753b\u50cf\u3092\u9078\u629e':'RETRY_FILE'};
 return {code,kind,locator:Object.hasOwn(labels,label)?labels[label]:'OTHER'};
}

/** Accepts untrusted values but serializes only the schema below. */
export function diagnosticLine(event,input={}){
 const value=input&&typeof input==='object'?input:{};
 let fields={};
 if(event==='test_failure')fields={stage:safeStage(value.stage),...classifyFailure(value.error)};
 else if(event==='boundary')fields={checkpoint:['OLD_CLIENT','CSRF','ORIGIN'].includes(value.checkpoint)?value.checkpoint:'other',status:finite(value.status,599)>=100?value.status:null};
 else if(event==='side_effects')fields={before:finite(value.before,10000),after:finite(value.after,10000),beforeReadOk:value.beforeReadOk===true,afterReadOk:value.afterReadOk===true};
 else if(event==='compile')fields={process:finite(value.process,4),scenario:scenarios.has(value.scenario)?value.scenario:'other',stage:safeStage(value.stage),stream:['stdout','stderr'].includes(value.stream)?value.stream:'other',codes:Array.isArray(value.codes)?value.codes.filter(code=>detectors.includes(code)):[],markers:Array.isArray(value.markers)?value.markers.filter(code=>markerCodes.has(code)):[]};
 else if(event==='summary')fields={tests:finite(value.tests,9),failed:finite(value.failed,9),compileErrors:Array.isArray(value.compileErrors)?value.compileErrors.filter(code=>detectors.includes(code)):[],omitted:finite(value.omitted,100000)};
 else event='unknown';
 return '[phase3a-diagnostic] '+JSON.stringify({event,...fields});
}

/** Bounded in-memory stream parsing; its output is classifications only, not raw text. */
export function createCompileDiagnostics({process,scenario,getStage,onUpdate}){
 const events=[],streams=new Map();let omitted=0;
 const snapshot=()=>({events:structuredClone(events),omitted});
 function line(text,stream){
  const state=streams.get(stream),codes=detectors.filter(code=>text.includes(code));
  if(codes.length){
   if(events.length<32){state.event={process:finite(process,4),scenario:scenarios.has(scenario)?scenario:'other',stage:safeStage(getStage()),stream,codes,markers:[]};events.push(state.event);}
   else{state.event=null;omitted++;}
   state.remaining=12;
  }
  if(state.remaining>0){
   if(state.event)for(const [code,needle]of markers)if(text.includes(needle)&&!state.event.markers.includes(code))state.event.markers.push(code);
   state.remaining--;onUpdate(snapshot());
  }
 }
 function write(stream,chunk){
  if(!['stdout','stderr'].includes(stream))throw new Error('DIAGNOSTIC_STREAM');
  if(!streams.has(stream))streams.set(stream,{decoder:new StringDecoder('utf8'),pending:'',event:null,remaining:0});
  const state=streams.get(stream);state.pending+=state.decoder.write(chunk);let end;
  while((end=state.pending.indexOf('\n'))!==-1){line(state.pending.slice(0,end),stream);state.pending=state.pending.slice(end+1);}
  while(state.pending.length>16384){line(state.pending.slice(0,16384),stream);state.pending=state.pending.slice(16256);}
 }
 function flush(){
  for(const [stream,state]of streams){state.pending+=state.decoder.end();if(state.pending)line(state.pending,stream);state.pending='';}
  return snapshot();
 }
 return{write,flush,snapshot};
}
