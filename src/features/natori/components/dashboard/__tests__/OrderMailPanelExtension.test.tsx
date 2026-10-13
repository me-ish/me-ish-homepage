// @vitest-environment jsdom
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { NatoriProject } from "../../../types/projects";

vi.mock("../DeliveryFilesManager", () => {
  function FilesStub({ onFilesChange }: { onFilesChange: (files: unknown[]) => void }) {
    React.useEffect(() => { onFilesChange([{ id: "ffffffff-ffff-4fff-8fff-ffffffffffff", state: "ready" }]); }, [onFilesChange]);
    return null;
  }
  return { default: FilesStub };
});

import OrderMailPanel from "../OrderMailPanel";

const project = {
  id: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee", title: "Synthetic", clientName: "Fixture", clientEmail: "client@fixture.invalid",
  type: "illustration", status: "delivered", amount: 12000, dueDate: null, nextAction: "", tasks: [],
} as unknown as NatoriProject;

afterEach(() => { cleanup(); sessionStorage.clear(); vi.unstubAllGlobals(); });

describe("OrderMailPanel delivery extension", () => {
  it("期限切れと返されたときだけ延長の入力を出し、理由を入れると延長つきで再送する", async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: false, code: "delivery_expired", error: "期限切れ" }), { status: 409 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    vi.stubGlobal("fetch", fetcher);
    const onSent = vi.fn();
    render(<OrderMailPanel project={project} kind="delivery" onClose={() => {}} onSent={onSent} />);

    expect(screen.queryByLabelText("延長する期間")).toBeNull();
    const send = await screen.findByRole("button", { name: "納品メールを送信" });
    await waitFor(() => expect((send as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(send);

    await screen.findByLabelText("延長する期間");
    expect((screen.getByRole("button", { name: "納品メールを送信" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(screen.getByLabelText("延長する期間"), { target: { value: "14" } });
    fireEvent.change(screen.getByLabelText(/延長の理由/), { target: { value: "お客様のご希望" } });
    fireEvent.click(screen.getByRole("button", { name: "納品メールを送信" }));

    await waitFor(() => expect(onSent).toHaveBeenCalledOnce());
    const first = JSON.parse(fetcher.mock.calls[0][1].body as string);
    const second = JSON.parse(fetcher.mock.calls[1][1].body as string);
    expect(first.extension).toBeUndefined();
    expect(second.extension).toEqual({ days: 14, reason: "お客様のご希望" });
    expect(second.operationId).toBe(first.operationId);
  });
});
