import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
vi.mock("server-only", () => ({}));
import {
  compareSourceTimes, sameSourceTime, sourceOccurred, sourceRows, sourceRevision,
  sourceTimestamp, type CaseSourceContext,
} from "../caseSnapshotSource";

const schema = z.object({ id: z.string(), project_id: z.string(), value: z.boolean() });
// This helper exercises only the minimal project identity used by sourceRows.
const context = (section?: unknown) => ({
  project: { id: "project" }, snapshotId: "snapshot", observedAt: "2026-10-20T00:00:00Z",
  sections: section === undefined ? {} : { domain: section },
}) as CaseSourceContext;
const row = { id: "fact", project_id: "project", value: true };

describe("bounded complete source observations", () => {
  it("distinguishes deliberately unrequested, failed, unsupported and confirmed empty reads", () => {
    expect(sourceRows(context(), "domain", schema)).toEqual({ state: "not_requested" });
    for (const reason of ["read_failed", "unsupported", "incomplete"]) {
      expect(sourceRows(context({ state: "unavailable", reason }), "domain", schema)).toEqual({ state: "unavailable", reason });
    }
    expect(sourceRows(context({ total: 0, rows: [] }), "domain", schema)).toEqual({ state: "ready", rows: [] });
  });

  it.each([
    { total: 1, rows: [] }, { total: 0, rows: [row] }, { total: 201, rows: [row] },
    { total: "1", rows: [row] }, { rows: [row] }, { total: 1, rows: [{ ...row, value: "true" }] },
    { total: 1, rows: [{ ...row, project_id: "other-project" }] },
    { total: 2, rows: [row, row] },
  ])("rejects a partial, malformed or foreign domain: %#", section => {
    expect(sourceRows(context(section), "domain", schema)).toEqual({ state: "unavailable", reason: "incomplete" });
  });

  it("strips unrelated sensitive fields while preserving source identities", () => {
    expect(sourceRows(context({ total: 1, rows: [{ ...row, token: "secret" }] }), "domain", schema))
      .toEqual({ state: "ready", rows: [row] });
  });

  it("generates order-independent revisions for a set of selected facts", () => {
    expect(sourceRevision([{ id: "b", done: true }, { id: "a", done: false }]))
      .toBe(sourceRevision([{ done: false, id: "a" }, { done: true, id: "b" }]));
    expect(sourceRevision([{ id: "a", done: true }])).not.toBe(sourceRevision([{ id: "a", done: false }]));
  });

  it("keeps microseconds in the same canonical condition across timezone spellings", () => {
    expect(sourceTimestamp("2026-10-20T09:00:00.123100+09:00")).toBe("2026-10-20T00:00:00.1231Z");
    expect(sourceTimestamp("2026-10-20T00:00:00Z")).toBe("2026-10-20T00:00:00.000Z");
    expect(sameSourceTime("2026-10-20T09:00:00.123100+09:00", "2026-10-20T00:00:00.1231Z")).toBe(true);
    expect(sameSourceTime("2026-10-20T00:00:00.123100Z", "2026-10-20T00:00:00.123900Z")).toBe(false);
    expect(compareSourceTimes("2026-10-20T00:00:00.123900Z", "2026-10-20T00:00:00.123100Z")).toBe(1);
    expect(compareSourceTimes("2026-10-19T23:59:59.999999Z", "2026-10-20T00:00:00Z")).toBe(-1);
    expect(sameSourceTime("malformed-snapshot-time", "2026-10-20T00:00:00Z")).toBe(false);
  });

  it("rejects a fact even a fraction of a millisecond after the snapshot", () => {
    const ctx = { ...context(), observedAt: "2026-10-20T00:00:00.123100Z" };
    expect(sourceOccurred(ctx, "2026-10-20T00:00:00.123900Z")).toBe(false);
  });
});

it("reused validator definitions never cache an earlier observation, owner check or another schema's result",()=>{
 const source={total:1,rows:[{...row}]};
 expect(sourceRows(context(source),"domain",schema).state).toBe("ready");
 source.rows[0].project_id="other-project";
 expect(sourceRows(context(source),"domain",schema)).toEqual({state:"unavailable",reason:"incomplete"});
 source.rows[0].project_id="project";source.rows[0].value=false;
 expect(sourceRows(context(source),"domain",schema)).toEqual({state:"ready",rows:[{...row,value:false}]});
 const narrower=schema.extend({value:z.literal(true)});
 expect(sourceRows(context(source),"domain",narrower)).toEqual({state:"unavailable",reason:"incomplete"});
 expect(sourceRows(context({state:"unavailable",reason:"read_failed"}),"domain",schema)).toEqual({state:"unavailable",reason:"read_failed"});
 expect(sourceRows(context({total:0,rows:[]}),"domain",schema)).toEqual({state:"ready",rows:[]});
});
