// @vitest-environment jsdom
import {webcrypto} from 'node:crypto';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {act,cleanup,renderHook,waitFor} from '@testing-library/react';
import {useIntakeOperation} from '@/features/natori/components/portfolio/useIntakeOperation';
import {createFrozenIntakeOperation,loadFrozenIntakeOperation,saveFrozenIntakeOperation} from '@/features/natori/data/intakeOperationClient';
import {buildNatoriRequestDataV1,createInitialPortfolioRequestFormState,portfolioOptionChoices} from '@/features/natori/lib/portfolioRequestForm';
import {defaultPortfolioContent} from '@/features/natori/constants/portfolioContent';

const key='natori-intake-operation-v1',drafts='natori-intake-original-answers-v1';
const http=vi.fn();
beforeEach(()=>{sessionStorage.clear();vi.stubGlobal('crypto',webcrypto);vi.stubGlobal('fetch',http);http.mockReset();});
afterEach(()=>{cleanup();sessionStorage.clear();vi.restoreAllMocks();vi.unstubAllGlobals();});
async function frozen(){
 const state=createInitialPortfolioRequestFormState();state.message='Synthetic storage repair recovery';
 const operation=await createFrozenIntakeOperation({name:'Synthetic',email:'synthetic@example.invalid',formVersion:'etorie-request-v1',requestData:JSON.stringify(buildNatoriRequestDataV1(state,portfolioOptionChoices(defaultPortfolioContent))),referenceLinks:'[]'},[]);
 saveFrozenIntakeOperation(key,operation);return operation;
}
function denyOriginalBackup(){
 let deny=true;const realSet=Storage.prototype.setItem;
 vi.spyOn(Storage.prototype,'setItem').mockImplementation(function(this:Storage,storageKey,value){
  if(storageKey===drafts&&deny)throw new DOMException('Synthetic quota failure','QuotaExceededError');
  return realSet.call(this,storageKey,value);
 });return()=>{deny=false;};
}
it('recovers editability after repaired original backup and authoritative failed settlement',async()=>{
 const original=await frozen(),repair=denyOriginalBackup();
 http.mockImplementation(()=>Promise.resolve(new Response(JSON.stringify({operationState:'failed'}),{status:200})));
 const hook=renderHook(()=>useIntakeOperation(vi.fn()));
 await waitFor(()=>expect(hook.result.current.operation?.operationId).toBe(original.operationId));
 expect(hook.result.current.frozen).toBe(true);expect(http).not.toHaveBeenCalled();
 expect(loadFrozenIntakeOperation(key)).toEqual(original);
 repair();await act(async()=>{await hook.result.current.check();});
 expect(http).toHaveBeenCalledTimes(1);
 expect(loadFrozenIntakeOperation(key)).toBeNull();expect(hook.result.current.operation).toBeNull();
 expect(JSON.parse(sessionStorage.getItem(drafts)!)).toEqual([original]);
 expect(hook.result.current.originalAnswers).toEqual([original]);
 // Both backup and authoritative failed determination succeeded: editing should resume.
 expect(hook.result.current.frozen).toBe(false);
});
it('keeps the same operation frozen when repaired storage is followed by an unknown result',async()=>{
 const original=await frozen(),repair=denyOriginalBackup();
 http.mockImplementation(()=>Promise.resolve(new Response('{}',{status:503})));
 const hook=renderHook(()=>useIntakeOperation(vi.fn()));
 await waitFor(()=>expect(hook.result.current.operation?.operationId).toBe(original.operationId));
 repair();await act(async()=>{await hook.result.current.check();});
 expect(http).toHaveBeenCalledTimes(1);expect(loadFrozenIntakeOperation(key)).toEqual(original);
 expect(hook.result.current.operation).toEqual(original);expect(hook.result.current.frozen).toBe(true);
});
