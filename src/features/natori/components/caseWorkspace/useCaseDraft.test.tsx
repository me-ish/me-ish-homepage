// @vitest-environment jsdom
import {act,cleanup,renderHook,waitFor} from "@testing-library/react";
import {afterEach,expect,it,vi} from "vitest";
import {useCaseDraft} from "./useCaseDraft";
afterEach(()=>{cleanup();sessionStorage.clear();});
it("late success from an unmounted case cannot erase a new editor's restored draft",async()=>{
 const dirty=vi.fn(),key="synthetic-draft";
 const first=renderHook(()=>useCaseDraft(key,{body:"",operationId:""},dirty));
 act(()=>first.result.current[1]({body:"first",operationId:"same-operation"}));await waitFor(()=>expect(sessionStorage.getItem(key)).toContain("first"));
 const oldReset=first.result.current[2];first.unmount();
 const next=renderHook(()=>useCaseDraft(key,{body:"",operationId:""},dirty));
 expect(next.result.current[0]).toEqual({body:"first",operationId:"same-operation"});
 act(()=>next.result.current[1]({body:"new edit",operationId:"same-operation"}));
 act(()=>oldReset({body:"",operationId:""}));
 expect(next.result.current[0].body).toBe("new edit");expect(sessionStorage.getItem(key)).toContain("new edit");
});
