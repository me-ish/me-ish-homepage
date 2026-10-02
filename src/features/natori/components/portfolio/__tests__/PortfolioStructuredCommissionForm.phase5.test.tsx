// @vitest-environment jsdom
// Isolated Phase 5 UI proof uses the actual Phase 3A hashing/freeze client.
// fetch is deferred and mocked: no request leaves this test process.
import { webcrypto } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import PortfolioCommissionForm from "@/features/natori/components/portfolio/PortfolioCommissionForm";
import { defaultPortfolioContent } from "@/features/natori/constants/portfolioContent";
import type { PortfolioContent } from "@/features/natori/types/portfolio";
import { buildNatoriInquiryRequestView } from "@/features/natori/lib/inquiryRequestView";
import { validateNatoriRequestDataV1 } from "@/features/natori/lib/requestSchema";

const trackNatoriPageEvent = vi.hoisted(() => vi.fn());
vi.mock("@/features/natori/data/pageEvents", () => ({ trackNatoriPageEvent }));
const fetchMock = vi.fn();
function renderForm(content: PortfolioContent = defaultPortfolioContent) {
  return render(<PortfolioCommissionForm content={content} structuredIntake />);
}
async function fillMinimum(message = "相談したいです。") {
  await userEvent.type(screen.getByLabelText(/お名前/), "テスト太郎");
  await userEvent.type(screen.getByLabelText(/メールアドレス/), "client@example.com");
  await userEvent.type(screen.getByLabelText(/ご相談・ご依頼の内容/), message);
}
function detailsBySummary(text: string): HTMLDetailsElement {
  const details = Array.from(document.querySelectorAll("details")).find((element) =>
    element.querySelector("summary")?.textContent?.includes(text));
  if (!details) throw new Error(`details not found: ${text}`);
  return details;
}
let objectUrlCounter = 0;
beforeEach(() => {
  vi.clearAllMocks();
  sessionStorage.clear();
  objectUrlCounter = 0;
  vi.stubGlobal("crypto", webcrypto);
  vi.stubGlobal("fetch", fetchMock);
  Object.defineProperty(URL, "createObjectURL", { value: () => `blob:preview-${++objectUrlCounter}`, writable: true });
  Object.defineProperty(URL, "revokeObjectURL", { value: () => undefined, writable: true });
  // jsdom Files use FileReader; real browsers provide arrayBuffer natively.
  Object.defineProperty(File.prototype, "arrayBuffer", { configurable: true, value: function (this: File) {
    return new Promise<ArrayBuffer>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => reader.result instanceof ArrayBuffer ? resolve(reader.result) : reject(new Error("unexpected_file_result"));
      reader.onerror = () => reject(reader.error);
      reader.readAsArrayBuffer(this);
    });
  } });
});
afterEach(() => { cleanup(); sessionStorage.clear(); vi.unstubAllGlobals(); });

// PREPARED APPEND BLOCK: add the imports specified in source_guards.json, then insert
// before describe("アクセシビリティ / モバイル想定 DOM", ...). Uses existing suite helpers.
// Requires Phase 3A test setup (isolated operation storage/crypto) and Phase 5 UI.
// Deferred POST does not assume, fabricate or bypass a Phase 3A success response.

function phase5ContactPost(): FormData {
  const call = fetchMock.mock.calls.find((entry) => String(entry[0]) === "/api/natori/portfolio/contact" && (entry[1] as RequestInit | undefined)?.method === "POST");
  if (!call) throw new Error("contact POST has not been issued");
  const body = (call[1] as RequestInit).body;
  if (!(body instanceof FormData)) throw new Error("contact POST must use FormData");
  return body;
}

async function openPhase5Details(title: string): Promise<void> {
  const element = detailsBySummary(title);
  if (!element.open) await userEvent.click(element.querySelector("summary")!);
}

function phase5Change(label: string | RegExp, value: string): void {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

describe("Phase 5 confirmation and actual submitted values", () => {
  it("restores the frozen original answers and historical option label after reload without inventing image previews", async () => {
    fetchMock.mockRejectedValue(new Error("response lost"));
    const view = renderForm();
    await fillMinimum("再読込後も同じ相談内容");
    await openPhase5Details("詳しい条件を追加する");
    await openPhase5Details("依頼の種類");
    await userEvent.click(screen.getByLabelText(/表情を追加する（表情差分）/));
    phase5Change("追加する表情の数", "2");
    phase5Change("補足（任意）", "受付時の補足");
    await openPhase5Details("資料");
    phase5Change("参考URL 1", "https://example.com/original");
    phase5Change("このURLの内容（任意）", "受付時の資料");
    fireEvent.change(screen.getByLabelText("キャラクター資料の画像を選択"), {
      target: { files: [new File([new Uint8Array([1])], "private-local.png", { type: "image/png" })] },
    });
    await userEvent.click(screen.getByRole("button", { name: "内容を確認する" }));
    await userEvent.click(screen.getByRole("button", { name: "相談内容を送信する" }));
    await waitFor(() => phase5ContactPost());
    await waitFor(() => expect((screen.getByRole("button", { name: "受付結果を確認する" }) as HTMLButtonElement).disabled).toBe(false));
    const saved = sessionStorage.getItem("natori-intake-operation-v1");
    expect(saved).not.toBeNull();
    const original = phase5ContactPost();
    view.unmount();
    fetchMock.mockReset();
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ operationState: "processing" }), { status: 202 }));
    renderForm({ ...defaultPortfolioContent, options: defaultPortfolioContent.options.map((option) =>
      option.id === "expression_variation" ? { ...option, name: "現在の異なる表情ラベル" } : option) });
    const confirmation = await screen.findByRole("region", { name: "送信前の確認" });
    expect(confirmation.textContent).toContain("表情差分 ×2（受付時の補足）");
    expect(confirmation.textContent).not.toContain("現在の異なる表情ラベル");
    expect(confirmation.textContent).toContain("再読込後も同じ相談内容");
    expect(confirmation.textContent).toContain("受付時の資料（example.com）");
    expect(confirmation.textContent).toContain("前回選択した画像：1枚");
    expect(confirmation.querySelector('img[src^="blob:"]')).toBeNull();
    expect(confirmation.textContent).not.toContain("private-local.png");
    expect((screen.getByLabelText(/お名前/) as HTMLInputElement).value).toBe("テスト太郎");
    expect((screen.getByLabelText(/お名前/) as HTMLInputElement).closest("fieldset")?.disabled).toBe(true);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({ action: "reconcile", operationId: original.get("operationId") });
    expect(sessionStorage.getItem("natori-intake-operation-v1")).toBe(saved);
  });

  it.each(["consultation", "quote"] as const)("shows every answered %s condition, material and contact from the actual POST", async (mode) => {
    fetchMock.mockReturnValue(new Promise<Response>(() => undefined));
    renderForm();
    if (mode === "quote") await userEvent.click(screen.getByLabelText("見積もりを希望"));
    await openPhase5Details(mode === "quote" ? "選べる詳細項目" : "詳しい条件を追加する");
    await openPhase5Details("依頼の種類");
    phase5Change("ご依頼の種類", "other");
    phase5Change(/ご依頼の種類（その他の内容）/, " 表紙 ");
    phase5Change("制作範囲", "other");
    phase5Change(/制作範囲（その他の内容）/, " 二人の全身 ");
    await userEvent.click(screen.getByLabelText(/表情を追加する（表情差分）/));
    phase5Change("追加する表情の数", "2");
    phase5Change("補足（任意）", " 笑顔・泣き顔 ");
    await openPhase5Details("キャラクター・イメージの詳細");
    phase5Change("キャラクターの特徴", " 水色の髪 ");
    phase5Change("希望する表情・雰囲気", " 笑顔 ");
    phase5Change("構図のイメージ", " 二人並び ");
    phase5Change("色のイメージ", " 青 ");
    phase5Change("資料についての補足", " 画像の服装 ");
    // Details are sufficient for consultation; the empty message must not mean no content.
    await openPhase5Details("資料");
    phase5Change("参考URL 1", " https://example.com/reference ");
    phase5Change("このURLの内容（任意）", " 衣装の設定資料 ");
    const image = new File([new Uint8Array([1, 2, 3])], "costume.png", { type: "image/png" });
    fireEvent.change(screen.getByLabelText("キャラクター資料の画像を選択"), { target: { files: [image] } });
    if (mode === "quote") await userEvent.click(screen.getByRole("button", { name: "条件・連絡先へ" }));
    await openPhase5Details("用途・条件");
    await userEvent.click(screen.getByLabelText("配信で使用"));
    await userEvent.click(screen.getByLabelText("その他"));
    phase5Change(/使用目的（その他の内容）/, " 特番 ");
    phase5Change("商用利用", "yes");
    phase5Change(/作品の公開可否/, "delayed");
    phase5Change("公開可能日必須", "2026-11-15");
    await openPhase5Details("予算・納期");
    phase5Change("ご予算", "range");
    phase5Change(/下限（円）/, "10000");
    phase5Change("上限（円・任意）", "15000");
    phase5Change("希望納期", "preferred_date");
    phase5Change(/希望日/, "2026-12-01");
    phase5Change("納期の補足（任意）", " イベント前まで ");
    phase5Change(/お名前/, " テスト太郎 ");
    phase5Change(/メールアドレス/, " client@example.com ");
    await userEvent.click(screen.getByRole("button", { name: "内容を確認する" }));
    const confirmation = await screen.findByRole("region", { name: "送信前の確認" });
    for (const value of ["その他（表紙）", "その他（二人の全身）", "表情差分 ×2（笑顔・泣き顔）", "水色の髪", "笑顔", "二人並び", "青", "画像の服装", "配信で使用 / その他（特番）", "商用利用する", "一定期間後なら公開してよい（2026年11月15日から）", "10,000円〜15,000円", "2026年12月1日 希望 / イベント前まで", "衣装の設定資料", "example.com", "costume.png", "テスト太郎", "client@example.com"]) {
      expect(confirmation.textContent).toContain(value);
    }
    expect(confirmation.textContent).not.toContain("相談内容なし");
    expect(confirmation.querySelector('a[href="https://example.com/reference"]')).not.toBeNull();
    expect(confirmation.querySelector('img[src^="blob:preview-"]')).not.toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: mode === "quote" ? "見積もりを依頼する" : "相談内容を送信する" }));
    await waitFor(() => phase5ContactPost());
    const form = phase5ContactPost();
    expect(form.get("name")).toBe("テスト太郎");
    expect(form.get("email")).toBe("client@example.com");
    expect(JSON.parse(String(form.get("referenceLinks")))).toEqual([{ url: "https://example.com/reference", label: "衣装の設定資料" }]);
    const sentImages = form.getAll("refImages");
    expect(sentImages).toHaveLength(1);
    expect(sentImages[0]).toBeInstanceOf(File);
    expect((sentImages[0] as File).name).toBe("costume.png");
    expect((sentImages[0] as File).size).toBe(3);
    const parsed = validateNatoriRequestDataV1(JSON.parse(String(form.get("requestData"))));
    expect(parsed.success).toBe(true);
    if (!parsed.success) throw new Error("actual submitted request is invalid");
    expect(parsed.data).toMatchObject({ inquiryMode: mode, requestTypeOther: "表紙", commissionScopeOther: "二人の全身", options: [{ id: "expression_variation", label: "表情差分", quantity: 2, notes: "笑顔・泣き顔" }], characterFeatures: "水色の髪", expressionMood: "笑顔", composition: "二人並び", colorDirection: "青", referenceNotes: "画像の服装", commercialUse: "yes", publicationPolicy: "delayed", publicationAllowedFrom: "2026-11-15", budget: { kind: "range", min: 10000, max: 15000 }, deadline: { kind: "preferred_date", date: "2026-12-01", note: "イベント前まで" }, message: "" });
    const admin = buildNatoriInquiryRequestView(parsed.data);
    expect(admin.kind).toBe("structured");
    if (admin.kind !== "structured") throw new Error("admin reader cannot show actual submission");
    for (const field of admin.sections.flatMap((section) => section.fields).filter((field) => field.value !== "未記入")) {
      expect(confirmation.textContent).toContain(field.value);
    }
  });

  it.each(["", "2.5", "0", "11"])("rejects raw quantity '%s', focuses it, and permits an explicit valid correction", async (quantity) => {
    fetchMock.mockReturnValue(new Promise<Response>(() => undefined));
    renderForm();
    await fillMinimum();
    await openPhase5Details("詳しい条件を追加する");
    await openPhase5Details("依頼の種類");
    await userEvent.click(screen.getByLabelText(/表情を追加する（表情差分）/));
    const input = screen.getByLabelText("追加する表情の数") as HTMLInputElement;
    fireEvent.change(input, { target: { value: quantity } });
    expect(input.value).toBe(quantity);
    await userEvent.click(screen.getByRole("button", { name: "内容を確認する" }));
    await waitFor(() => expect(document.activeElement).toBe(input));
    expect(input.getAttribute("aria-invalid")).toBe("true");
    expect(fetchMock).not.toHaveBeenCalled();
    fireEvent.change(input, { target: { value: "10" } });
    await userEvent.click(screen.getByRole("button", { name: "内容を確認する" }));
    expect((await screen.findByRole("region", { name: "送信前の確認" })).textContent).toContain("表情差分 ×10");
    await userEvent.click(screen.getByRole("button", { name: "相談内容を送信する" }));
    await waitFor(() => phase5ContactPost());
    expect(JSON.parse(String(phase5ContactPost().get("requestData"))).options[0].quantity).toBe(10);
  });

  it("named editing preserves production answers, updates conditions, and returns to confirmation", async () => {
    renderForm();
    await userEvent.click(screen.getByLabelText("見積もりを希望"));
    phase5Change("キャラクターの特徴", "戻っても残す特徴");
    await userEvent.click(screen.getByRole("button", { name: "条件・連絡先へ" }));
    phase5Change(/お名前/, "テスト");
    phase5Change(/メールアドレス/, "client@example.com");
    phase5Change("商用利用", "yes");
    await userEvent.click(screen.getByRole("button", { name: "内容を確認する" }));
    await userEvent.click(within(await screen.findByRole("region", { name: "送信前の確認" })).getByRole("button", { name: "用途・条件を修正する" }));
    await waitFor(() => expect(document.activeElement?.textContent).toBe("ご希望の条件と連絡先"));
    expect((screen.getByLabelText("商用利用") as HTMLSelectElement).value).toBe("yes");
    phase5Change("商用利用", "none");
    await userEvent.click(screen.getByRole("button", { name: "内容を確認する" }));
    const confirmation = await screen.findByRole("region", { name: "送信前の確認" });
    expect(confirmation.textContent).toContain("商用利用しない");
    expect(confirmation.textContent).toContain("戻っても残す特徴");
    await userEvent.click(within(confirmation).getByRole("button", { name: "詳細を修正する" }));
    expect((screen.getByLabelText("キャラクターの特徴") as HTMLTextAreaElement).value).toBe("戻っても残す特徴");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("Phase 5 option and image access", () => {
  it("uses the checkbox label for blank-card clicks and Space without including its quantity controls", async () => {
    renderForm();
    await openPhase5Details("詳しい条件を追加する");
    await openPhase5Details("依頼の種類");
    const checkbox = screen.getByRole("checkbox", { name: /表情を追加する（表情差分）/ }) as HTMLInputElement;
    const label = checkbox.closest("label");
    if (!label) throw new Error("option has no associated card label");
    fireEvent.click(label);
    expect(checkbox.checked).toBe(true);
    expect(label.contains(screen.getByLabelText("追加する表情の数"))).toBe(false);
    checkbox.focus();
    await userEvent.keyboard(" ");
    expect(checkbox.checked).toBe(false);
    await userEvent.keyboard(" ");
    expect(checkbox.checked).toBe(true);
  });

  it("reports omitted image count and offers a keyboard focus route to the existing reference URL", async () => {
    renderForm();
    await openPhase5Details("詳しい条件を追加する");
    await openPhase5Details("資料");
    const files = Array.from({ length: 7 }, (_, index) => new File([new Uint8Array(4)], `ref-${index}.png`, { type: "image/png" }));
    fireEvent.change(screen.getByLabelText("キャラクター資料の画像を選択"), { target: { files } });
    expect(screen.getAllByRole("img")).toHaveLength(5);
    expect(document.getElementById("pf-ref-image-error")?.textContent).toMatch(/2(?:枚|件).*?(?:追加|省|選択)/);
    const shortcut = screen.getByRole("button", { name: "参考URL欄へ移動する" });
    shortcut.focus();
    await userEvent.keyboard("{Enter}");
    await waitFor(() => expect(document.activeElement).toBe(screen.getByLabelText("参考URL 1")));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("retains the 3MiB reference preview when a later 2MiB image exceeds the cumulative 4MiB limit and routes keyboard focus to the reference URL", async () => {
    renderForm();
    await openPhase5Details("詳しい条件を追加する");
    await openPhase5Details("資料");
    const retained = new File([new Uint8Array(3 * 1024 * 1024)], "retained-3mib.png", { type: "image/png" });
    fireEvent.change(screen.getByLabelText("キャラクター資料の画像を選択"), { target: { files: [retained] } });
    const preview = screen.getByRole("img");
    const previewUrl = preview.getAttribute("src");
    expect(previewUrl).toBe("blob:preview-1");
    expect(document.getElementById("pf-ref-image-error")).toBeNull();
    const rejected = new File([new Uint8Array(2 * 1024 * 1024)], "rejected-2mib.png", { type: "image/png" });
    fireEvent.change(screen.getByLabelText("キャラクター資料の画像を選択"), { target: { files: [rejected] } });
    expect(screen.getAllByRole("img")).toHaveLength(1);
    expect(screen.getByRole("img")).toBe(preview);
    expect(preview.getAttribute("src")).toBe(previewUrl);
    expect(document.getElementById("pf-ref-image-error")?.textContent).toContain("画像の合計サイズは4MBまでです。");
    expect(document.getElementById("pf-ref-image-error")?.textContent).toContain("選択した1枚は追加していません。");
    const shortcut = screen.getByRole("button", { name: "参考URL欄へ移動する" });
    shortcut.focus();
    await userEvent.keyboard("{Enter}");
    await waitFor(() => expect(document.activeElement).toBe(screen.getByLabelText("参考URL 1")));
    expect(screen.getByRole("img")).toBe(preview);
    expect(preview.getAttribute("src")).toBe(previewUrl);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("keeps the original_character stable ID under subject through keyboard toggles, confirmation, actual mock multipart POST and the shared admin presentation", async () => {
    fetchMock.mockReset();
    fetchMock.mockReturnValue(new Promise<Response>(() => undefined));
    renderForm();
    await fillMinimum("オリジナルキャラクターの相談です。");
    await openPhase5Details("詳しい条件を追加する");
    await openPhase5Details("用途・条件");
    const checkbox = screen.getByRole("checkbox", { name: "オリジナルキャラクター" }) as HTMLInputElement;
    const subject = checkbox.closest("fieldset");
    expect(subject?.querySelector("legend")?.textContent).toContain("題材");
    expect(document.getElementById("pf-usage-types")?.contains(checkbox)).toBe(false);
    expect(checkbox.checked).toBe(false);
    await userEvent.click(checkbox);
    expect(checkbox.checked).toBe(true);
    checkbox.focus();
    await userEvent.keyboard(" ");
    expect(checkbox.checked).toBe(false);
    await userEvent.keyboard(" ");
    expect(checkbox.checked).toBe(true);
    await userEvent.click(screen.getByRole("button", { name: "内容を確認する" }));
    const confirmation = await screen.findByRole("region", { name: "送信前の確認" });
    expect(confirmation.textContent).toContain("オリジナルキャラクター");
    expect(fetchMock).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "相談内容を送信する" }));
    await waitFor(() => phase5ContactPost());
    const form = phase5ContactPost();
    expect(String(form.get("operationId"))).toMatch(/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i);
    const parsed = validateNatoriRequestDataV1(JSON.parse(String(form.get("requestData"))));
    expect(parsed.success).toBe(true);
    if (!parsed.success) throw new Error("actual original-character submission is invalid");
    expect(parsed.data.schemaVersion).toBe(1);
    expect(parsed.data.usageTypes).toEqual(["original_character"]);
    const admin = buildNatoriInquiryRequestView(parsed.data);
    expect(admin.kind).toBe("structured");
    if (admin.kind !== "structured") throw new Error("admin reader cannot show actual original-character submission");
    expect(admin.request.usageTypes).toEqual(["original_character"]);
    const adminUsage = admin.sections.flatMap((section) => section.fields).find((field) => field.key === "usageTypes");
    expect(adminUsage?.value).toBe("オリジナルキャラクター");
    expect(confirmation.textContent).toContain(adminUsage!.value);
    expect(form.getAll("refImages")).toHaveLength(0);
  });
});
