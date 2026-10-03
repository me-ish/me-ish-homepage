// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { NatoriConfirmDialog } from "../NatoriConfirmDialog";

afterEach(() => cleanup());

const setup = (props: Partial<React.ComponentProps<typeof NatoriConfirmDialog>> = {}) => {
  const onCancel = vi.fn();
  const onConfirm = vi.fn();
  render(
    <NatoriConfirmDialog
      open
      title="見送りにしますか？"
      confirmLabel="見送りにする"
      onCancel={onCancel}
      onConfirm={onConfirm}
      {...props}
    />,
  );
  return { onCancel, onConfirm };
};

describe("NatoriConfirmDialog", () => {
  it("calls onCancel and never onConfirm for キャンセル", () => {
    const { onCancel, onConfirm } = setup();
    fireEvent.click(screen.getByRole("button", { name: "キャンセル" }));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("treats Escape as cancel", () => {
    const { onCancel, onConfirm } = setup();
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("passes an empty reason string on confirm when withReason is set", () => {
    const { onConfirm } = setup({ withReason: { label: "理由（任意）" } });
    fireEvent.click(screen.getByRole("button", { name: "見送りにする" }));
    expect(onConfirm).toHaveBeenCalledWith("");
  });

  it("passes the typed reason untrimmed", () => {
    const { onConfirm } = setup({ withReason: { label: "理由（任意）" } });
    fireEvent.change(screen.getByLabelText("理由（任意）"), { target: { value: " 都合 " } });
    fireEvent.click(screen.getByRole("button", { name: "見送りにする" }));
    expect(onConfirm).toHaveBeenCalledWith(" 都合 ");
  });

  it("focuses キャンセル first for danger and the confirm button for primary", async () => {
    setup({ tone: "danger" });
    await vi.waitFor(() => expect(document.activeElement).toBe(screen.getByRole("button", { name: "キャンセル" })));
    cleanup();
    setup({ tone: "primary", confirmLabel: "入金確認する" });
    await vi.waitFor(() => expect(document.activeElement).toBe(screen.getByRole("button", { name: "入金確認する" })));
  });
});
