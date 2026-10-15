// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render } from "@testing-library/react";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
import TalkRoughRefresh from "../TalkRoughRefresh";

let signature: unknown;
let talk: unknown;
let initialTalk: string | null;
let calls: string[];
const tick = async (ms = 15000) => { await act(async () => { await vi.advanceTimersByTimeAsync(ms); }); };

beforeEach(() => {
  vi.useFakeTimers();
  refresh.mockClear();
  signature = "";
  talk = undefined;
  initialTalk = null;
  calls = [];
  vi.stubGlobal("fetch", vi.fn(async (url: string) => { calls.push(url); return Response.json({ count: 1, lastId: "m", closed: false, roughs: signature, ...(talk === undefined ? {} : { talk }) }); }));
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); });

describe("TalkRoughRefresh", () => {
  it("takes the first answer as the baseline and does not refresh while nothing changes", async () => {
    render(<TalkRoughRefresh token="synthetic" initialTalk={initialTalk} />); await tick(0);
    await tick(); await tick();
    expect(calls[0]).toBe("/api/natori/consult/synthetic?probe=1");
    expect(calls.length).toBeGreaterThanOrEqual(3);
    expect(refresh).not.toHaveBeenCalled();
  });

  it("re-renders the page when a rough is marked or answered, once per change", async () => {
    render(<TalkRoughRefresh token="synthetic" initialTalk={initialTalk} />); await tick(0);
    signature = "r1-"; await tick();
    expect(refresh).toHaveBeenCalledTimes(1);
    await tick();
    expect(refresh).toHaveBeenCalledTimes(1);
    signature = "r1+"; await tick();
    expect(refresh).toHaveBeenCalledTimes(2);
  });

  it("re-renders once when the quote / payment / delivery fingerprint changes, and ignores a missing one", async () => {
    talk = "t1"; initialTalk = "t1";
    render(<TalkRoughRefresh token="synthetic" initialTalk={initialTalk} />); await tick(0);
    talk = undefined; await tick();
    talk = "t1"; await tick();
    expect(refresh).not.toHaveBeenCalled();
    talk = "t2"; await tick();
    expect(refresh).toHaveBeenCalledTimes(1);
    await tick();
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("refreshes once when the page was rendered from a different or unknown fingerprint", async () => {
    talk = "t2"; initialTalk = "t1";
    render(<TalkRoughRefresh token="synthetic" initialTalk={initialTalk} />); await tick(0);
    expect(refresh).toHaveBeenCalledTimes(1);
    await tick();
    expect(refresh).toHaveBeenCalledTimes(1);
    cleanup(); refresh.mockClear();
    talk = "t3"; initialTalk = null;
    render(<TalkRoughRefresh token="synthetic" initialTalk={initialTalk} />); await tick(0);
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("checks right away when the tab becomes visible again", async () => {
    talk = "t1"; initialTalk = "t1";
    render(<TalkRoughRefresh token="synthetic" initialTalk={initialTalk} />); await tick(0);
    const before = calls.length;
    talk = "t2";
    await act(async () => { document.dispatchEvent(new Event("visibilitychange")); await vi.advanceTimersByTimeAsync(0); });
    expect(calls.length).toBe(before + 1);
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("stays quiet on failures and on a probe without the rough field, and stops when unmounted", async () => {
    render(<TalkRoughRefresh token="synthetic" initialTalk={initialTalk} />); await tick(0);
    signature = undefined; await tick();
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("offline"); }));
    await tick();
    expect(refresh).not.toHaveBeenCalled();
    cleanup();
    const fetchMock = vi.fn(); vi.stubGlobal("fetch", fetchMock);
    await tick();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
