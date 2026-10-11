// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import InquiryTalkMenu from "../InquiryTalkMenu";
import type { NatoriProject } from "../../../types/projects";

afterEach(cleanup);
const project = (over: Partial<NatoriProject> = {}): NatoriProject => ({
  id: "p1", title: "T", clientName: "C", amount: null, dueDate: null, status: "quoted", nextAction: "", type: "illustration", tasks: [], ...over,
});
const mount = (over: Partial<NatoriProject> = {}, props: Partial<React.ComponentProps<typeof InquiryTalkMenu>> = {}) => {
  const onOpenMail = vi.fn();
  render(<InquiryTalkMenu project={project(over)} readOnly={false} busy={false} estimateHref="/natori/estimate?p=1" projectsHref="/natori/projects?p=1" onOpenMail={onOpenMail} {...props} />);
  return onOpenMail;
};
const toggle = () => screen.getByRole("button", { name: "送る・進める" });

describe("InquiryTalkMenu", () => {
  it("starts closed and toggles with aria-expanded", () => {
    mount();
    expect(toggle().getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByRole("list")).toBeNull();
    fireEvent.click(toggle());
    expect(toggle().getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByRole("list")).toBeTruthy();
    fireEvent.click(toggle());
    expect(screen.queryByRole("list")).toBeNull();
  });

  it("links the quote to the estimate tool and opens the payment mail modal through the existing handler", () => {
    const onOpenMail = mount({ status: "quoted" });
    fireEvent.click(toggle());
    expect(screen.getByRole("link", { name: "見積りを開く・再送" }).getAttribute("href")).toBe("/natori/estimate?p=1");
    fireEvent.click(screen.getByRole("button", { name: "支払いリンクを送る" }));
    expect(onOpenMail).toHaveBeenCalledWith("payment");
    expect(screen.queryByRole("list")).toBeNull();
  });

  it("shows the reason instead of a button for steps that are not available yet", () => {
    mount({ status: "inquiry" });
    fireEvent.click(toggle());
    expect(screen.getByText("見積もりの承認後に送れます。")).toBeTruthy();
    expect(screen.getByText("お支払いの確認後に送れます。")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /支払いリンク/ })).toBeNull();
    expect(screen.getByRole("link", { name: "見積もりを作る" })).toBeTruthy();
  });

  it("links delivery to the project board once payment is confirmed", () => {
    mount({ status: "rough", paymentConfirmedAt: "2026-10-12T00:00:00Z" });
    fireEvent.click(toggle());
    expect(screen.getByRole("link", { name: "納品する" }).getAttribute("href")).toBe("/natori/projects?p=1");
  });

  it("disables the payment button while busy and omits the attachment note for a closed project", () => {
    mount({ status: "quoted" }, { busy: true });
    fireEvent.click(toggle());
    expect((screen.getByRole("button", { name: "支払いリンクを送る" }) as HTMLButtonElement).disabled).toBe(true);
    cleanup();
    mount({ status: "closed" }, { readOnly: true });
    fireEvent.click(toggle());
    expect(screen.queryByText(/添付からいつでも/)).toBeNull();
  });

  it("asks before leaving the conversation while a reply draft is unsent, and goes on only when confirmed", () => {
    const confirm = vi.spyOn(window, "confirm");
    const onOpenMail = mount({ status: "quoted" }, { hasDraft: true });
    fireEvent.click(toggle());
    confirm.mockReturnValueOnce(false);
    fireEvent.click(screen.getByRole("button", { name: "支払いリンクを送る" }));
    expect(onOpenMail).not.toHaveBeenCalled();
    expect(screen.getByRole("list")).toBeTruthy();
    confirm.mockReturnValueOnce(true);
    fireEvent.click(screen.getByRole("button", { name: "支払いリンクを送る" }));
    expect(onOpenMail).toHaveBeenCalledWith("payment");
    // A declined confirm keeps a link from navigating.
    cleanup();
    mount({ status: "quoted" }, { hasDraft: true });
    fireEvent.click(toggle());
    confirm.mockReturnValueOnce(false);
    expect(fireEvent.click(screen.getByRole("link", { name: "見積りを開く・再送" }))).toBe(false);
    confirm.mockRestore();
  });

  it("does not ask when there is no draft", () => {
    const confirm = vi.spyOn(window, "confirm");
    const onOpenMail = mount({ status: "quoted" });
    fireEvent.click(toggle());
    fireEvent.click(screen.getByRole("button", { name: "支払いリンクを送る" }));
    expect(confirm).not.toHaveBeenCalled();
    expect(onOpenMail).toHaveBeenCalledWith("payment");
    confirm.mockRestore();
  });

  it("locks the payment link while the quote is not accepted yet", () => {
    mount({ status: "quoted", quoteAcceptedAt: null });
    fireEvent.click(toggle());
    expect(screen.getByText("依頼者が見積もりを承認すると送れます。")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /支払いリンク/ })).toBeNull();
  });
});
