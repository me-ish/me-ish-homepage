// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { hydrateRoot } from "react-dom/client";
const m = vi.hoisted(() => ({ load: vi.fn(), submit: vi.fn() }));
vi.mock("../../data/supabaseCaseAdministration", () => ({
  loadCaseAdministration: m.load,
  submitCaseAdministration: m.submit,
}));
import { useCaseAdminOperation } from "./useCaseAdminOperation";
const projectId = "11111111-1111-4111-8111-111111111111",
  operationId = "33333333-3333-4333-8333-333333333333";
const request = {
  projectId,
  operationId,
  revision: "a".repeat(64),
  action: { command: "manual-payment" as const },
};
const changed = vi.fn(),
  dirty = vi.fn();
beforeEach(() => {
  sessionStorage.clear();
  vi.clearAllMocks();
  m.load.mockResolvedValue({ view: null, receipt: null });
  m.submit.mockResolvedValue({ result: "applied", projectId });
});
afterEach(cleanup);
it("restores a pending operation after hydration without reading tab storage during server rendering", async () => {
  sessionStorage.setItem(
    "hydrate",
    JSON.stringify({ request, summary: ["固定した内容"], started: true }),
  );
  const get = vi.spyOn(Storage.prototype, "getItem");
  function Restore() {
    const op = useCaseAdminOperation("hydrate", changed, dirty);
    return <p>{op.saved?.request.operationId ?? "復旧を確認中"}</p>;
  }
  const html = renderToString(<Restore />);
  expect(get).not.toHaveBeenCalled();
  get.mockRestore();
  const container = document.createElement("div");
  container.innerHTML = html;
  document.body.append(container);
  const errors: unknown[] = [];
  const root = hydrateRoot(container, <Restore />, {
    onRecoverableError: (e) => errors.push(e),
  });
  await waitFor(() => expect(container.textContent).toBe(operationId));
  expect(errors).toEqual([]);
  act(() => root.unmount());
  container.remove();
});
it("persists one identity before dispatch; a double click cannot call twice", async () => {
  let resolve!: (v: unknown) => void;
  m.submit.mockReturnValue(new Promise((r) => (resolve = r)));
  const { result } = renderHook(() =>
    useCaseAdminOperation("test", changed, dirty),
  );
  act(() => result.current.prepare(request, ["13000 JPY"]));
  let first!: Promise<void>;
  act(() => {
    first = result.current.execute();
    void result.current.execute();
  });
  expect(m.submit).toHaveBeenCalledTimes(1);
  expect(JSON.parse(sessionStorage.getItem("test")!).started).toBe(true);
  await act(async () => {
    resolve({ result: "applied", projectId });
    await first;
  });
  expect(result.current.done).toBe(true);
});
it("response loss retains the same frozen operation across reload and an empty lookup", async () => {
  m.submit.mockRejectedValue(Error("lost response"));
  const one = renderHook(() => useCaseAdminOperation("test", changed, dirty));
  act(() => one.result.current.prepare(request, ["13000 JPY"]));
  await act(() => one.result.current.execute());
  expect(one.result.current.done).toBe(false);
  one.unmount();
  const two = renderHook(() => useCaseAdminOperation("test", changed, dirty));
  expect(two.result.current.saved?.request.operationId).toBe(operationId);
  await act(() => two.result.current.lookup());
  expect(two.result.current.done).toBe(false);
  act(() => two.result.current.close());
  expect(two.result.current.saved).not.toBeNull();
});
it("a conflict remains uncertain until the original receipt is found", async () => {
  m.submit.mockResolvedValue({ result: "conflict" });
  const { result } = renderHook(() =>
    useCaseAdminOperation("test", changed, dirty),
  );
  act(() => result.current.prepare(request, []));
  await act(() => result.current.execute());
  expect(result.current.done).toBe(false);
  act(() => result.current.close());
  expect(result.current.saved).not.toBeNull();
  m.load.mockResolvedValue({ receipt: { result: "applied", projectId } });
  await act(() => result.current.lookup());
  expect(result.current.done).toBe(true);
  act(() => result.current.close());
  expect(sessionStorage.getItem("test")).toBeNull();
});
it("an unfamiliar successful HTTP response stays unresolved and cannot be discarded as failure", async () => {
  m.submit.mockResolvedValue({ result: "unrecognized_after_upgrade" });
  const { result } = renderHook(() =>
    useCaseAdminOperation("test", changed, dirty),
  );
  act(() => result.current.prepare(request, []));
  await act(() => result.current.execute());
  expect(result.current.done).toBe(false);
  act(() => result.current.close());
  expect(result.current.saved?.request.operationId).toBe(operationId);
  expect(result.current.message).toContain("「結果を見る」");
  m.load.mockResolvedValue({
    receipt: { result: "unrecognized_after_upgrade", projectId },
  });
  await act(() => result.current.lookup());
  expect(result.current.done).toBe(false);
  act(() => result.current.close());
  expect(result.current.saved?.request.operationId).toBe(operationId);
  expect(JSON.parse(sessionStorage.getItem("test")!).started).toBe(true);
  m.load.mockResolvedValue({ receipt: { result: "applied", projectId } });
  await act(() => result.current.lookup());
  expect(result.current.done).toBe(true);
  act(() => result.current.close());
  expect(sessionStorage.getItem("test")).toBeNull();
});
it("malformed stored identity blocks all new commands rather than discarding it", async () => {
  sessionStorage.setItem("test", '{"started":true}');
  const { result } = renderHook(() =>
    useCaseAdminOperation("test", changed, dirty),
  );
  expect(result.current.blocked).toBe(true);
  act(() => result.current.prepare(request, []));
  await act(() => result.current.execute());
  expect(m.submit).not.toHaveBeenCalled();
  expect(sessionStorage.getItem("test")).not.toBeNull();
});
it("a tab with a known pre-execution refusal can prepare again only after explicitly closing", async () => {
  m.submit.mockResolvedValue({ result: "stale" });
  const { result } = renderHook(() =>
    useCaseAdminOperation("test", changed, dirty),
  );
  act(() => result.current.prepare(request, []));
  await act(() => result.current.execute());
  expect(result.current.done).toBe(true);
  expect(dirty).toHaveBeenLastCalledWith(true);
  act(() => result.current.close());
  await waitFor(() => expect(dirty).toHaveBeenLastCalledWith(false));
});
