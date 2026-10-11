// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
import TalkRoughOkButton from "../TalkRoughOkButton";

let fetchMock: ReturnType<typeof vi.fn>;
let confirmMock: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  refresh.mockClear();
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  confirmMock = vi.spyOn(window, "confirm").mockReturnValue(true);
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); confirmMock.mockRestore(); });
const mount = () => render(<TalkRoughOkButton token="synthetic" roughId="r1" label="このラフでOK" />);
const click = () => fireEvent.click(screen.getByRole("button", { name: "このラフでOK" }));

describe("TalkRoughOkButton", () => {
  it("asks first, then posts the rough id with the CSRF header and refreshes the page", async () => {
    fetchMock.mockResolvedValue(Response.json({ ok: true }));
    mount(); click();
    await waitFor(() => expect(refresh).toHaveBeenCalled());
    expect(confirmMock.mock.calls[0][0]).toContain("直したい点がある場合は、OKを押さずに");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/natori/consult/synthetic/rough-ok");
    expect(init.method).toBe("POST");
    expect(init.headers["x-requested-with"]).toBe("me-ish");
    expect(JSON.parse(init.body)).toEqual({ roughId: "r1" });
  });

  it("sends nothing when the reader declines", () => {
    confirmMock.mockReturnValue(false);
    mount(); click();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("explains a closed talk and a failure, and lets the reader try again", async () => {
    fetchMock.mockResolvedValueOnce(Response.json({ error: "closed" }, { status: 409 }));
    mount(); click();
    expect((await screen.findByRole("alert")).textContent).toContain("終了している");
    fetchMock.mockRejectedValueOnce(new Error("offline"));
    click();
    await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("通信状況"));
    expect((screen.getByRole("button", { name: "このラフでOK" }) as HTMLButtonElement).disabled).toBe(false);
    expect(refresh).not.toHaveBeenCalled();
  });
});
