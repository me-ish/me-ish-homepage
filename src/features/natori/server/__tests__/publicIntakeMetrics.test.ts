import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { recordPublicIntakeMetric } from "../publicIntakeMetrics";

describe("publicIntakeMetrics", () => {
  afterEach(() => vi.restoreAllMocks());

  it("emits one PII-free structured counter", () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);

    recordPublicIntakeMetric("structured_create_rejected");

    expect(info).toHaveBeenCalledTimes(1);
    const line = String(info.mock.calls[0]?.[0]);
    expect(JSON.parse(line)).toEqual({
      metric: "natori_public_intake",
      code: "structured_create_rejected",
      count: 1,
    });
    expect(line).not.toMatch(/@|client|project|token|path/i);
  });
});
