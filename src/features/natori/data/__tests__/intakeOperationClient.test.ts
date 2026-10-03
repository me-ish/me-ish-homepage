import { beforeEach, describe, expect, it, vi } from "vitest";
import { createHash, webcrypto } from "node:crypto";
import { createFrozenIntakeOperation, loadFrozenIntakeOperation, recoverFrozenIntakeOperation, saveFrozenIntakeOperation, sendFrozenIntakeOperation } from "../intakeOperationClient";
import { canonicalIntakeJson, canonicalizeIntake } from "../../lib/intakeOperation";
import { buildNatoriRequestDataV1, createInitialPortfolioRequestFormState } from "../../lib/portfolioRequestForm";

const fields = { name: "Synthetic", email: "client@example.invalid", formVersion: "etorie-request-v1",
  requestData: JSON.stringify(buildNatoriRequestDataV1({ ...createInitialPortfolioRequestFormState(), message: "Drawing" }, [])), referenceLinks: "[]" };
const fetchMock = vi.fn();
beforeEach(() => {
  const records = new Map<string, string>();
  vi.stubGlobal("crypto", webcrypto);
  vi.stubGlobal("sessionStorage", { getItem: (key: string) => records.get(key) ?? null, setItem: (key: string, value: string) => records.set(key, value), removeItem: (key: string) => records.delete(key) });
  vi.stubGlobal("fetch", fetchMock); fetchMock.mockReset();
});
describe("intake browser recovery", () => {
  it("computes the same SHA as the server canonical envelope and persists exact fields", async () => {
    const op = await createFrozenIntakeOperation(fields, []);
    expect(op.requestHash).toBe(createHash("sha256").update(canonicalIntakeJson(canonicalizeIntake(fields, []))).digest("hex"));
    saveFrozenIntakeOperation("test", op);
    expect(loadFrozenIntakeOperation("test")).toEqual(op);
  });
  it("retains the same operation across lost response and reload, recovering receipt without new submission", async () => {
    const op = await createFrozenIntakeOperation(fields, []); saveFrozenIntakeOperation("test", op);
    fetchMock.mockRejectedValueOnce(new Error("response_lost"));
    expect(await sendFrozenIntakeOperation(op, [])).toEqual({ kind: "unknown" });
    const reloaded = loadFrozenIntakeOperation("test")!;
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ operationState: "completed", accepted: true, receipt: op.operationId })));
    expect(await recoverFrozenIntakeOperation(reloaded)).toEqual({ kind: "completed", receipt: op.operationId });
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({ action: "reconcile", operationId: op.operationId, requestHash: op.requestHash });
  });
  it("settles a missing operation before treating it as editable, fencing delayed old requests", async () => {
    const op = await createFrozenIntakeOperation(fields, []);
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ operationState: "not_found" }), { status: 409 }));
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ operationState: "failed" }), { status: 409 }));
    expect(await recoverFrozenIntakeOperation(op)).toEqual({ kind: "failed" });
    expect(JSON.parse(fetchMock.mock.calls[1][1].body).action).toBe("settle");
  });
  it("requires the same original attachment bytes/order after reload and never sends a mismatch", async () => {
    const image = new File(["original"], "original.png", { type: "image/png" });
    const op = await createFrozenIntakeOperation(fields, [image]);
    await expect(sendFrozenIntakeOperation(op, [])).rejects.toThrow("attachment_reselect_required");
    await expect(sendFrozenIntakeOperation(op, [new File(["changed"], "changed.png", { type: "image/png" })])).rejects.toThrow("attachment_reselect_required");
    expect(fetchMock).not.toHaveBeenCalled();
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ operationState: "processing" }), { status: 202 }));
    expect(await sendFrozenIntakeOperation(op, [new File(["original"], "renamed.png", { type: "image/png" })])).toEqual({ kind: "processing" });
  });
  it("new identical-content requests get different operation IDs; frozen mutation rejects before fetch", async () => {
    const first = await createFrozenIntakeOperation(fields, []), second = await createFrozenIntakeOperation(fields, []);
    expect(first.operationId).not.toBe(second.operationId); expect(first.requestHash).toBe(second.requestHash);
    first.fields.email = "changed@example.invalid";
    await expect(sendFrozenIntakeOperation(first, [])).rejects.toThrow("saved_operation_invalid");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
