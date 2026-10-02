// @vitest-environment jsdom
// Actual intake component and hashing; deferred mock fetch never leaves the process.
import { webcrypto } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import PortfolioCommissionForm from "@/features/natori/components/portfolio/PortfolioCommissionForm";
import { defaultPortfolioContent } from "@/features/natori/constants/portfolioContent";
import { buildNatoriInquiryRequestView } from "@/features/natori/lib/inquiryRequestView";
import { describeNatoriDeadline } from "@/features/natori/lib/requestPresentation";
import { validateNatoriRequestDataV1 } from "@/features/natori/lib/requestSchema";

const trackNatoriPageEvent = vi.hoisted(() => vi.fn());
vi.mock("@/features/natori/data/pageEvents", () => ({ trackNatoriPageEvent }));
const fetchMock = vi.fn();
const originalCases = [
  { mode: "consultation", date: null },
  { mode: "consultation", date: "2026-12-01" },
  { mode: "quote", date: null },
  { mode: "quote", date: "2026-12-01" },
] as const;

beforeEach(() => {
  vi.clearAllMocks();
  fetchMock.mockReset();
  fetchMock.mockReturnValue(new Promise<Response>(() => undefined));
  sessionStorage.clear();
  vi.stubGlobal("crypto", webcrypto);
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => { cleanup(); sessionStorage.clear(); vi.unstubAllGlobals(); });

async function openDetails(title: string): Promise<void> {
  const details = Array.from(document.querySelectorAll("details")).find((element) =>
    element.querySelector("summary")?.textContent?.includes(title));
  if (!details) throw new Error("expected synthetic form section not found");
  if (!details.open) await userEvent.click(details.querySelector("summary")!);
}

function contactPost(): FormData {
  const call = fetchMock.mock.calls.find((entry) =>
    String(entry[0]) === "/api/natori/portfolio/contact" &&
    (entry[1] as RequestInit | undefined)?.method === "POST");
  if (!call) throw new Error("actual contact POST has not started");
  const body = (call[1] as RequestInit).body;
  if (!(body instanceof FormData)) throw new Error("actual contact POST must use multipart form");
  return body;
}

describe("Phase 5 rush deadline terms survive confirmation and editing", () => {
  it.each(originalCases)("retains the nonbinding rush fee in $mode with date $date while posting the original deadline", async ({ mode, date }) => {
    render(<PortfolioCommissionForm content={defaultPortfolioContent} structuredIntake />);
    if (mode === "quote") await userEvent.click(screen.getByLabelText("見積もりを希望"));
    fireEvent.change(screen.getByLabelText(/ご相談・ご依頼の内容/), { target: { value: "お急ぎの相談です。" } });
    if (mode === "quote") await userEvent.click(screen.getByRole("button", { name: "条件・連絡先へ" }));
    fireEvent.change(screen.getByLabelText(/お名前/), { target: { value: "Synthetic rush client" } });
    fireEvent.change(screen.getByLabelText(/メールアドレス/), { target: { value: "client@rush-phase5.invalid" } });
    await openDetails(mode === "quote" ? "選べる詳細項目" : "詳しい条件を追加する");
    await openDetails("予算・納期");
    const deadlineKind = screen.getByLabelText("希望納期") as HTMLSelectElement;
    expect(Array.from(deadlineKind.options).find((option) => option.value === "rush_consultation")?.textContent).toBe("お急ぎ希望（+2,000円／要相談）");
    await userEvent.selectOptions(deadlineKind, "rush_consultation");
    const dateInput = screen.getByLabelText(/希望日/) as HTMLInputElement;
    expect(dateInput.required).toBe(false);
    if (date) fireEvent.change(dateInput, { target: { value: date } });
    fireEvent.change(screen.getByLabelText("納期の補足（任意）"), { target: { value: "イベント前まで" } });

    const expectedDeadline = { kind: "rush_consultation", date, note: "イベント前まで" };
    const expectedDisplay = date
      ? "お急ぎ希望（+2,000円／要相談）（2026年12月1日 希望） / イベント前まで"
      : "お急ぎ希望（+2,000円／要相談） / イベント前まで";
    await userEvent.click(screen.getByRole("button", { name: "内容を確認する" }));
    const firstReview = await screen.findByRole("region", { name: "送信前の確認" });
    expect(firstReview.textContent).toContain(expectedDisplay);
    expect(fetchMock).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole("button", { name: "予算・納期を修正する" }));
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole("heading", {
      name: mode === "quote" ? "ご希望の条件と連絡先" : "ご相談内容を教えてください",
    })));
    expect((screen.getByLabelText("希望納期") as HTMLSelectElement).value).toBe("rush_consultation");
    expect((screen.getByLabelText(/希望日/) as HTMLInputElement).value).toBe(date ?? "");
    expect((screen.getByLabelText("納期の補足（任意）") as HTMLInputElement).value).toBe("イベント前まで");
    await userEvent.click(screen.getByRole("button", { name: "内容を確認する" }));
    const reviewedAgain = await screen.findByRole("region", { name: "送信前の確認" });
    expect(reviewedAgain.textContent).toContain(expectedDisplay);
    expect(reviewedAgain.textContent).not.toContain("納期確定");
    expect(fetchMock).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole("button", { name: mode === "quote" ? "見積もりを依頼する" : "相談内容を送信する" }));
    await waitFor(() => contactPost());
    const form = contactPost();
    const rawRequest = String(form.get("requestData"));
    const parsed = validateNatoriRequestDataV1(JSON.parse(rawRequest));
    expect(parsed.success).toBe(true);
    if (!parsed.success) throw new Error("actual rush request is invalid");
    expect(parsed.data.inquiryMode).toBe(mode);
    expect(parsed.data.deadline).toEqual(expectedDeadline);
    expect(Object.keys(parsed.data.deadline).sort()).toEqual(["date", "kind", "note"]);
    expect(rawRequest).not.toContain("2,000");
    expect(rawRequest).not.toContain("要相談");
    expect(form.get("name")).toBe("Synthetic rush client");
    expect(form.get("email")).toBe("client@rush-phase5.invalid");
    expect(JSON.parse(String(form.get("referenceLinks")))).toEqual([]);
    expect(form.getAll("refImages")).toHaveLength(0);
    const snapshotBeforePresentation = JSON.stringify(parsed.data);
    const admin = buildNatoriInquiryRequestView(parsed.data);
    expect(admin.kind).toBe("structured");
    if (admin.kind !== "structured") throw new Error("shared original-answer reader rejected rush request");
    expect(admin.request.deadline).toEqual(expectedDeadline);
    expect(admin.sections.flatMap((section) => section.fields).find((field) => field.key === "deadline")?.value).toBe(expectedDisplay);
    expect(describeNatoriDeadline(parsed.data.deadline)).toBe(expectedDisplay);
    expect(JSON.stringify(parsed.data)).toBe(snapshotBeforePresentation);
    expect(String(form.get("requestData"))).toBe(rawRequest);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect((screen.getByRole("button", { name: "送信中…" }) as HTMLButtonElement).disabled).toBe(true);
  });
});
