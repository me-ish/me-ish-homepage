// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { NATORI_TOAST_DURATION_MS, NatoriToastProvider, useNatoriToast } from "../NatoriToast";

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

  it("re-inserts the message when the same text is shown again so it is announced twice", () => {
    render(<NatoriToastProvider><Trigger /></NatoriToastProvider>);
    fireEvent.click(screen.getByText("go"));
    const first = screen.getByText("保存しました");
    fireEvent.click(screen.getByText("go"));
    const second = screen.getByText("保存しました");
    expect(second).not.toBe(first);
    expect(first.isConnected).toBe(false);
  });
});
