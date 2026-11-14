import { describe, expect, it } from "vitest";
import { anonymizeRpcResult, groupStorageObjects, scheduledAnonymizeDate } from "../caseAnonymization";

describe("caseAnonymization", () => {
  it("dates the automatic run 90 days after completion, in Tokyo time", () => {
    expect(scheduledAnonymizeDate("completed", "2026-11-01T16:00:00Z", "2026-11-05T00:00:00Z")).toBe("2027-01-31");
    expect(scheduledAnonymizeDate("closed", null, "2026-10-01T00:00:00Z")).toBe("2026-12-30");
    expect(scheduledAnonymizeDate("rough", "2026-11-01T00:00:00Z", "2026-11-01T00:00:00Z")).toBeNull();
  });

  it("groups files by bucket, without duplicates, in chunks", () => {
    const groups = groupStorageObjects([
      { bucket: "a", path: "1" }, { bucket: "b", path: "2" }, { bucket: "a", path: "1" }, { bucket: "a", path: "3" },
    ], 1);
    expect(groups).toEqual([{ bucket: "a", paths: ["1"] }, { bucket: "a", paths: ["3"] }, { bucket: "b", paths: ["2"] }]);
  });

  it("reads every result the database function can return", () => {
    expect(anonymizeRpcResult.parse({ result: "applied", label: "依頼者 #6CCB2162", storage: [], storagePurged: false }).result).toBe("applied");
    expect(anonymizeRpcResult.parse({ result: "too-early" }).result).toBe("too-early");
    expect(anonymizeRpcResult.safeParse({ result: "applied" }).success).toBe(false);
  });
});
