// @vitest-environment jsdom
// Actual deployed forms, hook, canonicalizer, crypto and storage; synthetic HTTP only.
import { webcrypto } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import PortfolioCommissionForm from "@/features/natori/components/portfolio/PortfolioCommissionForm";
import { defaultPortfolioContent } from "@/features/natori/constants/portfolioContent";
import { createFrozenIntakeOperation, loadFrozenIntakeOperation, saveFrozenIntakeOperation } from "@/features/natori/data/intakeOperationClient";
import { buildNatoriRequestDataV1, createInitialPortfolioRequestFormState, portfolioOptionChoices } from "@/features/natori/lib/portfolioRequestForm";

vi.mock("@/features/natori/data/pageEvents", () => ({ trackNatoriPageEvent: vi.fn() }));
const key = "natori-intake-operation-v1";
const draftsKey = "natori-intake-original-answers-v1";
const receiptsKey = "natori-intake-receipts-v1";
const fetchMock = vi.fn();
const posted: FormData[] = [];
function response(state: string, receipt?: string) {
  return new Response(JSON.stringify({ operationState: state, ...(receipt ? { accepted: true, receipt } : {}) }), { status: 200 });
}
function form() { return document.querySelector("form") as HTMLFormElement; }
function show(structuredIntake: boolean) { return render(<PortfolioCommissionForm content={defaultPortfolioContent} structuredIntake={structuredIntake} />); }
function change(label: RegExp | string, value: string) { fireEvent.change(screen.getByLabelText(label), { target: { value } }); }
async function fillAndSubmit(structured: boolean, message: string) {
  await waitFor(() => expect(screen.getByLabelText(/お名前/).closest("fieldset")?.disabled).not.toBe(true));
  change(/お名前/, "Synthetic client"); change(/メールアドレス/, "synthetic@example.invalid");
  change(structured ? /ご相談・ご依頼の内容/ : /ご依頼の詳細/, message);
  if (!structured) fireEvent.click(screen.getByRole("button", { name: "次へ進む" }));
  fireEvent.submit(form());
}
function legacyFields(message = "Legacy A\nFull original condition") {
  return { name: "Original A", email: "original@example.invalid", requestType: "Original type", plan: "Original plan",
    options: ["original option one", "original option two"], budget: "Original budget", deadline: "Original deadline",
    refUrls: "https://example.invalid/original", details: message, message: "Private publication condition retained" };
}
function structuredFields() {
  const state = createInitialPortfolioRequestFormState();
  state.message = "Structured original A\nSecond line";
  state.characterFeatures = "Original character features"; state.referenceNotes = "Original reference restrictions";
  state.publicationPolicy = "fully_private";
  return { name: "Original A", email: "original@example.invalid", formVersion: "etorie-request-v1",
    requestData: JSON.stringify(buildNatoriRequestDataV1(state, portfolioOptionChoices(defaultPortfolioContent))),
    referenceLinks: JSON.stringify([{ url: "https://example.invalid/original", label: "Original link label" }]) };
}

beforeEach(() => {
  sessionStorage.clear(); posted.length = 0; vi.clearAllMocks();
  vi.stubGlobal("crypto", webcrypto); vi.stubGlobal("fetch", fetchMock);
  Object.defineProperty(File.prototype, "arrayBuffer", { configurable: true, value() {
    return new Promise<ArrayBuffer>((resolve, reject) => { const reader = new FileReader();
      reader.onload = () => resolve(reader.result as ArrayBuffer); reader.onerror = () => reject(reader.error); reader.readAsArrayBuffer(this); });
  } });
  Object.defineProperty(URL, "createObjectURL", { configurable: true, value: () => "blob:synthetic-preview" });
  Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: () => undefined });
  fetchMock.mockImplementation((_url: string, init: RequestInit) => {
    if (init.body instanceof FormData) { posted.push(init.body); return Promise.resolve(response("completed", String(init.body.get("operationId")))); }
    const request = JSON.parse(String(init.body)) as { operationId: string };
    return Promise.resolve(response("completed", request.operationId));
  });
});
afterEach(() => { cleanup(); sessionStorage.clear(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe("completed receipt continuation and original answer recovery", () => {
  it.each([false, true])("starts a separate legitimate B only by the completed A action (structured=%s)", async (structured) => {
    show(structured);
    if (structured) change("キャラクターの特徴", "Original controlled feature A");
    const upload = form().querySelector<HTMLInputElement>('input[type="file"]');
    expect(upload).not.toBeNull();
    fireEvent.change(upload!, { target: { files: [new File(["synthetic"], "original-A.png", { type: "image/png" })] } });
    await fillAndSubmit(structured, "Original request A");
    const start = await screen.findByRole("button", { name: "新しい依頼を始める" });
    expect(posted).toHaveLength(1);
    const original = loadFrozenIntakeOperation(key)!;
    expect(original.operationId).toBe(posted[0].get("operationId"));
    expect(original.manifest).toHaveLength(1);
    fireEvent.click(start);
    await waitFor(() => expect(screen.getByLabelText(/お名前/)).toHaveProperty("value", ""));
    expect(screen.getByLabelText(/メールアドレス/)).toHaveProperty("value", "");
    expect(screen.getByLabelText(structured ? /ご相談・ご依頼の内容/ : /ご依頼の詳細/).getAttribute("value")).toBeNull();
    expect((screen.getByLabelText(structured ? /ご相談・ご依頼の内容/ : /ご依頼の詳細/) as HTMLTextAreaElement).value).not.toContain("Original request A");
    if (structured) expect(screen.getByLabelText("キャラクターの特徴")).toHaveProperty("value", "");
    expect(loadFrozenIntakeOperation(key)).toBeNull();
    const history = screen.getByLabelText("これまでの受付確認");
    expect(within(history).getByText(new RegExp(original.operationId))).toBeTruthy();
    expect(JSON.parse(sessionStorage.getItem(receiptsKey)!)).toEqual([{ receipt: original.operationId, clientEmail: "synthetic@example.invalid" }]);
    await fillAndSubmit(structured, "Legitimate second request B");
    await screen.findByRole("button", { name: "新しい依頼を始める" });
    expect(posted).toHaveLength(2);
    expect(posted[1].get("operationId")).not.toBe(original.operationId);
    expect(posted[1].get("refImages")).toBeNull();
    expect(String(posted[1].get(structured ? "requestData" : "details"))).toContain("Legitimate second request B");
    expect(loadFrozenIntakeOperation(key)?.operationId).toBe(posted[1].get("operationId"));
    expect(within(screen.getByLabelText("これまでの受付確認")).getByText(new RegExp(original.operationId))).toBeTruthy();
  });

  it("keeps completed A and its success screen when receipt history storage fails", async () => {
    show(true); await fillAndSubmit(true, "Completed A still protected");
    const start = await screen.findByRole("button", { name: "新しい依頼を始める" });
    const original = loadFrozenIntakeOperation(key);
    const realSet = Storage.prototype.setItem;
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(function(this: Storage, storageKey, value) {
      if (storageKey === receiptsKey) throw new DOMException("Synthetic quota failure", "QuotaExceededError");
      return realSet.call(this, storageKey, value);
    });
    fireEvent.click(start);
    await screen.findByRole("alert");
    expect(loadFrozenIntakeOperation(key)).toEqual(original);
    expect(screen.queryByLabelText(/お名前/)).toBeNull();
    expect(posted).toHaveLength(1);
    expect(sessionStorage.getItem(receiptsKey)).toBeNull();
  });

  it("ignores a completed new-request check from an unmounted success screen", async () => {
    const mounted = show(true); await fillAndSubmit(true, "Protected completed A");
    const start = await screen.findByRole("button", { name: "新しい依頼を始める" });
    const original = loadFrozenIntakeOperation(key)!;
    let resolve!: (value: Response) => void;
    const delayed = new Promise<Response>(done => { resolve = done; });
    fetchMock.mockImplementationOnce(() => delayed);
    fireEvent.click(start);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    mounted.unmount(); show(true);
    await screen.findByRole("button", { name: "新しい依頼を始める" });
    await act(async () => { resolve(response("completed", original.operationId)); await delayed; });
    await waitFor(() => expect(loadFrozenIntakeOperation(key)).toEqual(original));
    expect(sessionStorage.getItem(receiptsKey)).toBeNull();
    expect(screen.queryByLabelText(/お名前/)).toBeNull();
  });

  it.each([false, true])("keeps full original answers after selector change, failed settle and another reload (original structured=%s)", async (originalStructured) => {
    const fields = originalStructured ? structuredFields() : legacyFields();
    const original = await createFrozenIntakeOperation(fields, []); saveFrozenIntakeOperation(key, original);
    fetchMock.mockImplementation((_url: string, init: RequestInit) => {
      const request = JSON.parse(String(init.body)) as { action: string };
      return Promise.resolve(response(request.action === "settle" ? "failed" : "not_found"));
    });
    const mounted = show(!originalStructured);
    const saved = await screen.findByLabelText("元の保存情報") as HTMLTextAreaElement;
    await waitFor(() => expect(loadFrozenIntakeOperation(key)).toBeNull());
    expect(saved.readOnly).toBe(true); expect(JSON.parse(saved.value)).toEqual(fields);
    const readable = screen.getByLabelText("保存した入力内容") as HTMLTextAreaElement;
    expect(readable.value).toContain("お名前：Original A");
    expect(readable.value).toContain(originalStructured ? "Original character features" : "Full original condition");
    expect(readable.value).not.toContain("schemaVersion"); expect(readable.value).not.toContain("formVersion");
    expect(JSON.parse(sessionStorage.getItem(draftsKey)!)).toEqual([original]);
    expect(fetchMock.mock.calls.map(([, init]) => JSON.parse(String(init.body)).action)).toEqual(["reconcile", "settle"]);
    change(/お名前/, "Edited new name"); expect(screen.getByLabelText(/お名前/)).toHaveProperty("value", "Edited new name");
    expect(JSON.parse((screen.getByLabelText("元の保存情報") as HTMLTextAreaElement).value)).toEqual(fields);
    mounted.unmount(); show(!originalStructured);
    expect(JSON.parse((await screen.findByLabelText("元の保存情報") as HTMLTextAreaElement).value)).toEqual(fields);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    await waitFor(() => expect((screen.getByRole("button", { name: "入力内容を確認しました" }) as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(screen.getByRole("button", { name: "入力内容を確認しました" }));
    await waitFor(() => expect(screen.queryByLabelText("保存した入力内容")).toBeNull());
    expect(JSON.parse(sessionStorage.getItem(draftsKey)!)).toEqual([]);
  });

  it("does not overwrite earlier unconfirmed A answers when a later B also fails", async () => {
    const a = await createFrozenIntakeOperation(legacyFields("Unconfirmed A original"), []);
    const b = await createFrozenIntakeOperation(legacyFields("Unconfirmed B original"), []);
    saveFrozenIntakeOperation(key, a); fetchMock.mockImplementation(() => Promise.resolve(response("failed")));
    const first = show(true); await waitFor(() => expect(loadFrozenIntakeOperation(key)).toBeNull()); first.unmount();
    saveFrozenIntakeOperation(key, b); const second = show(true);
    await waitFor(() => expect(loadFrozenIntakeOperation(key)).toBeNull());
    expect(JSON.parse(sessionStorage.getItem(draftsKey)!)).toEqual([a, b]);
    expect(screen.getAllByLabelText("元の保存情報").map(node => JSON.parse((node as HTMLTextAreaElement).value))).toEqual([a.fields, b.fields]);
    second.unmount(); show(true);
    expect(screen.getAllByLabelText("保存した入力内容")).toHaveLength(2);
  });

  it("keeps unknown A frozen and denies a new-request action", async () => {
    const original = await createFrozenIntakeOperation(legacyFields(), []); saveFrozenIntakeOperation(key, original);
    fetchMock.mockImplementation(() => Promise.resolve(response("unknown"))); show(true);
    await screen.findByLabelText("保存した入力内容");
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(loadFrozenIntakeOperation(key)).toEqual(original);
    expect(screen.queryByRole("button", { name: "新しい依頼を始める" })).toBeNull();
    expect((screen.getByRole("button", { name: "入力内容を確認しました" }) as HTMLButtonElement).disabled).toBe(true);
    expect(sessionStorage.getItem(receiptsKey)).toBeNull();
  });

  it("keeps active A plus its copyable original when original-answer storage fails", async () => {
    const original = await createFrozenIntakeOperation(legacyFields(), []); saveFrozenIntakeOperation(key, original);
    const realSet = Storage.prototype.setItem;
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(function(this: Storage, storageKey, value) {
      if (storageKey === draftsKey) throw new DOMException("Synthetic quota failure", "QuotaExceededError");
      return realSet.call(this, storageKey, value);
    });
    fetchMock.mockImplementation(() => Promise.resolve(response("failed"))); show(true);
    const copy = await screen.findByLabelText("元の保存情報") as HTMLTextAreaElement;
    expect(copy.readOnly).toBe(true); expect(JSON.parse(copy.value)).toEqual(original.fields);
    expect(loadFrozenIntakeOperation(key)).toEqual(original);
    expect(fetchMock).not.toHaveBeenCalled();
    expect((screen.getByRole("button", { name: "入力内容を確認しました" }) as HTMLButtonElement).disabled).toBe(true);
  });
});
