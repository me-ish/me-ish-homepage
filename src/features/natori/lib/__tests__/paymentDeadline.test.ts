import { describe, expect, it } from "vitest";
import { alignPaymentDeadlineToStopRun } from "../paymentDeadline";

describe("alignPaymentDeadlineToStopRun", () => {
  it("朝9:20（日本時間）より前の期限は、その日の朝9:20にする", () => {
    expect(alignPaymentDeadlineToStopRun("2026-10-19T23:30:00Z")).toBe("2026-10-20T00:20:00.000Z");
  });

  it("朝9:20を過ぎた期限は、翌朝の9:20に切り上げる", () => {
    expect(alignPaymentDeadlineToStopRun("2026-10-20T06:30:00Z")).toBe("2026-10-21T00:20:00.000Z");
  });

  it("ちょうど9:20なら動かさない", () => {
    expect(alignPaymentDeadlineToStopRun("2026-10-20T00:20:00Z")).toBe("2026-10-20T00:20:00.000Z");
  });

  it("月末をまたいでも切り上げられる", () => {
    expect(alignPaymentDeadlineToStopRun("2026-10-31T12:00:00Z")).toBe("2026-11-01T00:20:00.000Z");
  });

  it("切り上げ後は元の期限以上になり、24時間は超えない", () => {
    const input = new Date("2026-10-20T00:20:01Z").getTime();
    const out = new Date(alignPaymentDeadlineToStopRun("2026-10-20T00:20:01Z")).getTime();
    expect(out).toBeGreaterThanOrEqual(input);
    expect(out - input).toBeLessThan(24 * 3600 * 1000);
  });
});
