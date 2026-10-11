// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import TalkOpenButton from "../TalkOpenButton";

const assign = vi.fn();
let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => {
  assign.mockClear();
  vi.stubGlobal("location", { assign });
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
const click = () => fireEvent.click(screen.getByRole("button", { name: "内容を確認して承認" }));
const mount = () => render(<TalkOpenButton token="synthetic" target="quote" label="内容を確認して承認" />);

describe("TalkOpenButton", () => {
  it("posts the target with the CSRF header and goes to the returned page", async () => {
    fetchMock.mockResolvedValue(Response.json({ path: "/natori/quote/fresh-token" }));
    mount(); click();
    await waitFor(() => expect(assign).toHaveBeenCalledWith("/natori/quote/fresh-token"));
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/natori/consult/synthetic/open");
    expect(init.method).toBe("POST");
    expect(init.headers["x-requested-with"]).toBe("me-ish");
    expect(JSON.parse(init.body)).toEqual({ target: "quote" });
  });

  it("never navigates to a path outside the natori pages", async () => {
    fetchMock.mockResolvedValue(Response.json({ path: "https://evil.example/x" }));
    mount(); click();
    expect((await screen.findByRole("alert")).textContent).toContain("開けませんでした");
    expect(assign).not.toHaveBeenCalled();
  });

  it("explains an unavailable link and a throttled one, and lets the reader try again", async () => {
    fetchMock.mockResolvedValueOnce(Response.json({ error: "unavailable" }, { status: 409 }));
    mount(); click();
    expect((await screen.findByRole("alert")).textContent).toContain("いまは開けません");
    fetchMock.mockResolvedValueOnce(Response.json({ error: "throttled" }, { status: 429 }));
    click();
    await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("しばらくしてから"));
    expect((screen.getByRole("button", { name: "内容を確認して承認" }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("survives a network failure", async () => {
    fetchMock.mockRejectedValue(new Error("offline"));
    mount(); click();
    expect((await screen.findByRole("alert")).textContent).toContain("通信状況");
  });
});
