// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, renderHook } from "@testing-library/react";
import { useRefreshOnResume } from "../useRefreshOnResume";

beforeEach(() => {
  vi.useFakeTimers();
  Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "visible" });
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); });
const tick = async (ms = 1100) => { await act(async () => { await vi.advanceTimersByTimeAsync(ms); }); };
const resume = async () => { await act(async () => {
  window.dispatchEvent(new Event("focus"));
  window.dispatchEvent(new Event("pageshow"));
  document.dispatchEvent(new Event("visibilitychange"));
}); };

describe("management page resume refresh", () => {
  it("coalesces resume events, reads the latest callback and cleans up on unmount", async () => {
    const first = vi.fn(async () => {}), latest = vi.fn(async () => {}), onError = vi.fn();
    const view = renderHook(({ refresh }) => useRefreshOnResume(refresh, onError), { initialProps: { refresh: first } });
    await resume();
    expect(first).not.toHaveBeenCalled();
    await tick(); await resume();
    expect(first).toHaveBeenCalledTimes(1);
    view.rerender({ refresh: latest });
    await tick(); await resume();
    expect(latest).toHaveBeenCalledTimes(1);
    view.unmount();
    await tick(); await resume();
    expect(latest).toHaveBeenCalledTimes(1);
  });

  it("does not run in a hidden tab, disabled demo or while an earlier refresh is pending", async () => {
    let resolve: () => void = () => {};
    const refresh = vi.fn(() => new Promise<void>(done => { resolve = done; }));
    const view = renderHook(({ enabled }) => useRefreshOnResume(refresh, vi.fn(), enabled), { initialProps: { enabled: false } });
    await tick(); await resume();
    expect(refresh).not.toHaveBeenCalled();
    view.rerender({ enabled: true });
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "hidden" });
    await tick(); await resume();
    expect(refresh).not.toHaveBeenCalled();
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "visible" });
    await resume();
    expect(refresh).toHaveBeenCalledTimes(1);
    await tick(); await resume();
    expect(refresh).toHaveBeenCalledTimes(1);
    await act(async () => resolve());
    await tick(); await resume();
    expect(refresh).toHaveBeenCalledTimes(2);
    await act(async () => resolve());
  });

  it("surfaces refresh errors and permits a later retry", async () => {
    const error = new Error("synthetic unavailable");
    const refresh = vi.fn().mockRejectedValueOnce(error).mockResolvedValue(undefined), onError = vi.fn();
    renderHook(() => useRefreshOnResume(refresh, onError));
    await tick(); await resume();
    expect(onError).toHaveBeenCalledWith(error);
    await tick(); await resume();
    expect(refresh).toHaveBeenCalledTimes(2);
    expect(onError).toHaveBeenCalledTimes(1);
  });
});
