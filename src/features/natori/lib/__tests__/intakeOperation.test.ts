import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { canonicalIntakeJson, canonicalizeIntake, intakeManifestSchema, intakeOperationIdSchema, intakeTextFields } from "../intakeOperation";
import { buildNatoriRequestDataV1, createInitialPortfolioRequestFormState } from "../portfolioRequestForm";

const fields = () => ({ name: " Synthetic ", email: "client@example.invalid", formVersion: "etorie-request-v1",
  requestData: JSON.stringify(buildNatoriRequestDataV1({ ...createInitialPortfolioRequestFormState(), message: "Drawing request" }, [])),
  referenceLinks: JSON.stringify([{ url: "https://Example.com:443/reference#ignored", label: " Source " }]) });
const hash = (value: unknown) => createHash("sha256").update(canonicalIntakeJson(value)).digest("hex");

describe("public intake canonical operation contract", () => {
  it("normalizes answers and URLs before a deterministic order-independent hash", () => {
    const a = canonicalizeIntake(fields(), []);
    const reversed = Object.fromEntries(Object.entries(a).reverse());
    expect(hash(a)).toBe(hash(reversed));
    expect(a.submission.clientName).toBe("Synthetic");
    expect(a.referenceLinks[0]).toMatchObject({ url: "https://example.com/reference", label: "Source" });
  });
  it("changes the hash for answer, recipient, reference URL and original byte changes", () => {
    const base = canonicalizeIntake(fields(), []);
    expect(hash(canonicalizeIntake({ ...fields(), email: "another@example.invalid" }, []))).not.toBe(hash(base));
    expect(hash(canonicalizeIntake({ ...fields(), referenceLinks: '[{"url":"https://example.com/other"}]' }, []))).not.toBe(hash(base));
    const image = { digest: "a".repeat(64), size: 12, type: "image/png" as const };
    expect(hash(canonicalizeIntake(fields(), [image]))).not.toBe(hash(canonicalizeIntake(fields(), [{ ...image, digest: "b".repeat(64) }])));
  });
  it("retains every verified legacy label and complete original details without inventing consent", () => {
    const input = { name: "Legacy", email: "old@example.invalid", requestType: "以前の種類", plan: "以前のプラン", options: ["以前の追加条件"], budget: "予算未定",
      deadline: "以前の納期", refUrls: "https://example.com/legacy", details: "x".repeat(4000), message: "以前の補足" };
    const request = canonicalizeIntake(input, []).submission.requestData;
    expect(request.legacySource).toEqual({ formVersion: "natori-portfolio-v1", requestTypeLabel: input.requestType, planLabel: input.plan, optionLabels: input.options,
      budgetLabel: input.budget, deadlineLabel: input.deadline, referenceUrlsText: input.refUrls, details: input.details, message: input.message });
    expect(request).toMatchObject({ requestType: "undecided", commercialUse: "unknown", publicationPolicy: "unknown" });
  });
  it("does not derive canonical owner or honeypot state from arbitrary extra fields", () => {
    expect(canonicalizeIntake({ ...fields(), ownerId: "attacker", website: "spam" }, [])).toEqual(canonicalizeIntake(fields(), []));
  });
  it("rejects unsupported file shape, oversized aggregate, duplicate scalar fields and duplicate normalized URLs", () => {
    expect(intakeManifestSchema.safeParse([{ digest: "a".repeat(64), size: 1, type: "image/svg+xml" }]).success).toBe(false);
    expect(intakeManifestSchema.safeParse(Array.from({ length: 2 }, () => ({ digest: "a".repeat(64), size: 3 * 1024 * 1024, type: "image/png" }))).success).toBe(false);
    const form = new FormData(); form.append("email", "first"); form.append("email", "second");
    expect(() => intakeTextFields(form)).toThrow("duplicate_field");
    expect(() => canonicalizeIntake({ ...fields(), referenceLinks: '[{"url":"https://example.com/a#one"},{"url":"https://example.com/a#two"}]' }, [])).toThrow("invalid_reference_links");
  });
  it("requires a valid version4 operation ID", () => {
    expect(intakeOperationIdSchema.safeParse("00000000-0000-0000-0000-000000000000").success).toBe(false);
    expect(intakeOperationIdSchema.safeParse("d1a855ca-9478-4a8d-baa1-123456789abc").success).toBe(true);
  });
});
