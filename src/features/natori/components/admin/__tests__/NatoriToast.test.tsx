// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { NATORI_TOAST_ACTION_DURATION_MS, NATORI_TOAST_DURATION_MS, NatoriToastProvider, useNatoriToast, useOptionalNatoriToast } from "../NatoriToast";

function Trigger() {
  const { showToast } = useNatoriToast();
  return <button onClick={() => showToast("保存しました")}>go</button>;
}

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("NatoriToast", () => {
  it("keeps a polite live region mounted and clears the message after 4 seconds", () => {
    vi.useFakeTimers();
    const { container } = render(<NatoriToastProvider><Trigger /></NatoriToastProvider>);
    expect(container.querySelector('[aria-live="polite"]')).not.toBeNull();
    fireEvent.click(screen.getByText("go"));
    expect(screen.getByText("保存しました")).toBeTruthy();
    act(() => { vi.advanceTimersByTime(NATORI_TOAST_DURATION_MS - 1); });
    expect(screen.queryByText("保存しました")).not.toBeNull();
    act(() => { vi.advanceTimersByTime(1); });
    expect(screen.queryByText("保存しました")).toBeNull();
    expect(container.querySelector('[aria-live="polite"]')).not.toBeNull();
  });

  it("can be closed with the close button", () => {
    render(<NatoriToastProvider><Trigger /></NatoriToastProvider>);
    fireEvent.click(screen.getByText("go"));
    fireEvent.click(screen.getByRole("button", { name: "通知を閉じる" }));
    expect(screen.queryByText("保存しました")).toBeNull();
  });

  it("useOptionalNatoriToast does nothing instead of throwing without a provider", () => {
    function OptionalTrigger() {
      const { showToast } = useOptionalNatoriToast();
      return <button onClick={() => showToast("保存しました")}>go</button>;
    }
    render(<OptionalTrigger />);
    fireEvent.click(screen.getByText("go"));
    expect(screen.queryByText("保存しました")).toBeNull();
  });

  it("re-inserts the message when the same text is shown again so it is announced twice", () => {
    render(<NatoriToastProvider><Trigger /></NatoriToastProvider>);
    fireEvent.click(screen.getByText("go"));
    const first = screen.getByText("保存しました");
    fireEvent.click(screen.getByText("go"));
    const second = screen.getByText("保存しました");
    expect(second).not.toBe(first);
    expect(first.isConnected).toBe(false);
  });

  it("shows an action button that runs the action once, closes the toast, and stays longer", () => {
    vi.useFakeTimers();
    const onAction = vi.fn();
    function ActionTrigger() {
      const { showToast } = useNatoriToast();
      return <button onClick={() => showToast("完了にしました", { action: { label: "元に戻す", onAction } })}>go</button>;
    }
    render(<NatoriToastProvider><ActionTrigger /></NatoriToastProvider>);
    fireEvent.click(screen.getByText("go"));
    act(() => { vi.advanceTimersByTime(NATORI_TOAST_DURATION_MS + 1); });
    // 操作ボタン付きは通常の4秒では消えない
    expect(screen.queryByText("完了にしました")).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "元に戻す" }));
    expect(onAction).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("完了にしました")).toBeNull();
  });

  it("clears an action toast after its longer duration", () => {
    vi.useFakeTimers();
    function ActionTrigger() {
      const { showToast } = useNatoriToast();
      return <button onClick={() => showToast("完了にしました", { action: { label: "元に戻す", onAction: () => undefined } })}>go</button>;
    }
    render(<NatoriToastProvider><ActionTrigger /></NatoriToastProvider>);
    fireEvent.click(screen.getByText("go"));
    act(() => { vi.advanceTimersByTime(NATORI_TOAST_ACTION_DURATION_MS); });
    expect(screen.queryByText("完了にしました")).toBeNull();
  });

  it("a plain toast after an action toast has no action button", () => {
    function Both() {
      const { showToast } = useNatoriToast();
      return (
        <>
          <button onClick={() => showToast("A", { action: { label: "元に戻す", onAction: () => undefined } })}>a</button>
          <button onClick={() => showToast("B")}>b</button>
        </>
      );
    }
    render(<NatoriToastProvider><Both /></NatoriToastProvider>);
    fireEvent.click(screen.getByText("a"));
    expect(screen.queryByRole("button", { name: "元に戻す" })).not.toBeNull();
    fireEvent.click(screen.getByText("b"));
    expect(screen.queryByRole("button", { name: "元に戻す" })).toBeNull();
  });
});
