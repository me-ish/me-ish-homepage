import { describe, expect, it } from "vitest";
import {
  NATORI_REQUEST_TYPES_V1,
  NATORI_REQUEST_TYPE_VALUES_V1,
} from "@/features/natori/types/request";

describe("public request type choices", () => {
  it("hides SNS icon from new public choices while preserving legacy icon compatibility", () => {
    expect(NATORI_REQUEST_TYPES_V1).not.toContain("icon");
    expect(NATORI_REQUEST_TYPE_VALUES_V1).toContain("icon");
    expect(NATORI_REQUEST_TYPES_V1).toEqual([
      "undecided",
      "sd",
      "standing",
      "illustration",
      "other",
    ]);
  });
});
