import { describe, expect, it } from "vitest";
import {
  NATORI_MAX_REFERENCE_IMAGES,
  NATORI_REFERENCE_IMAGES_TOTAL_MAX_BYTES,
  NATORI_REFERENCE_IMAGE_MAX_BYTES,
} from "@/features/natori/lib/portfolioRequestForm";

describe("public intake attachment limits", () => {
  it("keeps image attachments below the hosting request-body ceiling", () => {
    expect(NATORI_MAX_REFERENCE_IMAGES).toBe(5);
    expect(NATORI_REFERENCE_IMAGE_MAX_BYTES).toBe(4 * 1024 * 1024);
    expect(NATORI_REFERENCE_IMAGES_TOTAL_MAX_BYTES).toBe(4 * 1024 * 1024);
  });
});
