// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { trackNatoriPageEvent } from "@/features/natori/data/pageEvents";

const fetchMock = vi.fn();
const gtagMock = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  window.history.replaceState({}, "", "/natori/portfolio");
  vi.stubGlobal("fetch", fetchMock.mockResolvedValue({ ok: true }));
  Object.assign(window, { gtag: gtagMock });
});

afterEach(() => {
  vi.unstubAllGlobals();
  Reflect.deleteProperty(window, "gtag");
});

describe("trackNatoriPageEvent", () => {
  it("sends only the event, bounded label, and current path", () => {
    trackNatoriPageEvent("portfolio_gallery_open", "x".repeat(120));

    expect(fetchMock).toHaveBeenCalledOnce();
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect(JSON.parse(init.body as string)).toEqual({
      event: "portfolio_gallery_open",
      label: "x".repeat(100),
      path: "/natori/portfolio",
    });
    expect(gtagMock).toHaveBeenCalledWith("event", "portfolio_gallery_open", {
      event_label: "x".repeat(100),
    });
  });

  it("does not record etorie demo interactions", () => {
    window.history.replaceState({}, "", "/etorie/portfolio");
    trackNatoriPageEvent("portfolio_primary_cta_click", "hero");

    expect(fetchMock).not.toHaveBeenCalled();
    expect(gtagMock).not.toHaveBeenCalled();
  });

  it("keeps tracking failures from escaping to the UI", async () => {
    fetchMock.mockRejectedValueOnce(new Error("network down"));

    expect(() => trackNatoriPageEvent("portfolio_form_start", "form")).not.toThrow();
    await Promise.resolve();
    await Promise.resolve();
  });
});
