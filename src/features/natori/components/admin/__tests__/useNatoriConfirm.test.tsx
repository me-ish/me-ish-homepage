// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useNatoriConfirm, type NatoriConfirmResult } from "../useNatoriConfirm";

afterEach(() => cleanup());

function Harness({ onResult, withReason = false }: { onResult: (r: NatoriConfirmResult | null) => void; withReason?: boolean }) {
  const { confirm, confirmDialog } = useNatoriConfirm();
  return (
    <>
      <button onClick={async () => onResult(await confirm({ title: "確認", confirmLabel: "実行する", withReason: withReason ? { label: "理由" } : undefined }))}>open</button>
      {confirmDialog}
    </>
  );
}

describe("useNatoriConfirm", () => {
  it("resolves null on cancel", async () => {
    const onResult = vi.fn();
    render(<Harness onResult={onResult} />);
    fireEvent.click(screen.getByText("open"));
    fireEvent.click(await screen.findByRole("button", { name: "キャンセル" }));
    await waitFor(() => expect(onResult).toHaveBeenCalledWith(null));
  });

  it("resolves with the reason on confirm", async () => {
    const onResult = vi.fn();
    render(<Harness onResult={onResult} withReason />);
    fireEvent.click(screen.getByText("open"));
    fireEvent.change(await screen.findByLabelText("理由"), { target: { value: "都合" } });
    fireEvent.click(screen.getByRole("button", { name: "実行する" }));
    await waitFor(() => expect(onResult).toHaveBeenCalledWith({ reason: "都合" }));
  });

  it("resolves an empty reason (not null) when confirmed without typing", async () => {
    const onResult = vi.fn();
    render(<Harness onResult={onResult} withReason />);
    fireEvent.click(screen.getByText("open"));
    fireEvent.click(await screen.findByRole("button", { name: "実行する" }));
    await waitFor(() => expect(onResult).toHaveBeenCalledWith({ reason: "" }));
  });
});
