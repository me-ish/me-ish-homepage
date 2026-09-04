import { describe, expect, it } from "vitest";
import { resolveLegacyEstimateRegistrationType } from "@/features/natori/lib/legacyEstimateRegistration";

describe("resolveLegacyEstimateRegistrationType", () => {
  it("preserves an existing inquiry product type", () => {
    expect(resolveLegacyEstimateRegistrationType({ type: "standing" } as never)).toBe("standing");
  });

  it("does not infer a product type when the inquiry is undecided", () => {
    expect(resolveLegacyEstimateRegistrationType({ type: "undecided" } as never)).toBe("illustration");
  });

  it("uses the legacy manual default when no inquiry is selected", () => {
    expect(resolveLegacyEstimateRegistrationType(null)).toBe("illustration");
  });
});
