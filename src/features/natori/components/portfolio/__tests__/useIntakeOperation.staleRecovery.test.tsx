// @vitest-environment jsdom
// Synthetic deferred fetch only. Real hook, canonicalizer, hash and session storage.
import { webcrypto } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { useIntakeOperation } from "@/features/natori/components/portfolio/useIntakeOperation";
import { createFrozenIntakeOperation, loadFrozenIntakeOperation, saveFrozenIntakeOperation } from "@/features/natori/data/intakeOperationClient";
import { createInitialPortfolioRequestFormState, buildNatoriRequestDataV1, portfolioOptionChoices } from "@/features/natori/lib/portfolioRequestForm";
import { defaultPortfolioContent } from "@/features/natori/constants/portfolioContent";

const key = "natori-intake-operation-v1";
const fetchMock = vi.fn();
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}
function fields(message: string) {
  const state = createInitialPortfolioRequestFormState();
  state.message = message;
  return {
    name: "Synthetic Client", email: "synthetic@example.invalid", formVersion: "etorie-request-v1",
    requestData: JSON.stringify(buildNatoriRequestDataV1(state, portfolioOptionChoices(defaultPortfolioContent))),
    referenceLinks: "[]",
  };
}
function response(operationState: string, receipt?: string) {
  return new Response(JSON.stringify({ operationState, ...(receipt ? { accepted: true, receipt } : {}) }), { status: 200 });
}
beforeEach(() => {
  sessionStorage.clear();
  vi.clearAllMocks();
  vi.stubGlobal("crypto", webcrypto);
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => { cleanup(); sessionStorage.clear(); vi.unstubAllGlobals(); });

describe("intake recovery observations remain scoped to their frozen operation", () => {
  it.each(["failed", "processing", "completed"])("keeps B identity, hash, storage, busy and notice when delayed A %s arrives", async (lateState) => {
    const original = await createFrozenIntakeOperation(fields("Original A"), []);
    saveFrozenIntakeOperation(key, original);
    const automaticA = deferred<Response>();
    const pendingB = deferred<Response>();
    fetchMock.mockImplementationOnce(() => automaticA.promise)
      .mockImplementationOnce(() => Promise.resolve(response("failed")))
      .mockImplementationOnce(() => pendingB.promise);
    const onCompleted = vi.fn();
    const { result } = renderHook(() => useIntakeOperation(onCompleted));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    await act(async () => { await result.current.settle(); });
    expect(result.current.frozen).toBe(false);
    expect(loadFrozenIntakeOperation(key)).toBeNull();
    const form = new FormData();
    // An intentionally repeated draft proves that ID alone matters even when
    // two legitimate new operation envelopes have the same canonical hash.
    for (const [name, value] of Object.entries(fields("Original A"))) form.set(name, value);
    let submit!: Promise<void>;
    act(() => { submit = result.current.submit(form, []); });
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
    const current = loadFrozenIntakeOperation(key);
    expect(current?.operationId).not.toBe(original.operationId);
    expect(current?.requestHash).toBe(original.requestHash);
    expect(result.current.busy).toBe(true);
    const messageBeforeLateA = result.current.message;
    await act(async () => { automaticA.resolve(response(lateState, lateState === "completed" ? original.operationId : undefined)); });
    // A is authoritatively failed, but this says nothing about B's pending POST.
    expect(loadFrozenIntakeOperation(key)).toEqual(current);
    expect(result.current.operation?.operationId).toBe(current?.operationId);
    expect(result.current.busy).toBe(true);
    expect(result.current.message).toBe(messageBeforeLateA);
    expect(onCompleted).not.toHaveBeenCalled();
    await act(async () => {
      // Lost/unreadable B response must also keep B frozen after its own finally.
      pendingB.resolve(lateState === "failed" ? new Response("{}", { status: 503 }) : response("processing"));
      await submit;
    });
    expect(result.current.frozen).toBe(true);
    expect(result.current.busy).toBe(false);
    expect(loadFrozenIntakeOperation(key)).toEqual(current);
    expect(onCompleted).not.toHaveBeenCalled();
  });

  it("still clears an authoritative failed result for the current operation", async () => {
    const original = await createFrozenIntakeOperation(fields("Original A"), []);
    saveFrozenIntakeOperation(key, original);
    fetchMock.mockResolvedValue(response("failed"));
    const { result } = renderHook(() => useIntakeOperation(vi.fn()));
    await waitFor(() => expect(result.current.frozen).toBe(false));
    expect(result.current.operation).toBeNull();
    expect(loadFrozenIntakeOperation(key)).toBeNull();
  });

  it("still reports the current completed receipt and retains its reload record", async () => {
    const original = await createFrozenIntakeOperation(fields("Original A"), []);
    saveFrozenIntakeOperation(key, original);
    fetchMock.mockResolvedValue(response("completed", original.operationId));
    const onCompleted = vi.fn();
    const { result } = renderHook(() => useIntakeOperation(onCompleted));
    await waitFor(() => expect(onCompleted).toHaveBeenCalledExactlyOnceWith({ receipt: original.operationId, clientEmail: "synthetic@example.invalid" }));
    expect(result.current.operation?.operationId).toBe(original.operationId);
    expect(loadFrozenIntakeOperation(key)).toEqual(original);
  });
});
