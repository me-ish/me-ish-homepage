// @vitest-environment jsdom
// 問い合わせ詳細パネルの表示。structured / legacy / 表示不能の3系統と、
// raw JSON 非表示・parse error でも画面が壊れないことを固定する。
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

import InquiryDetailPanel from "@/features/natori/components/dashboard/InquiryDetailPanel";
import { parseInquiryNote } from "@/features/natori/lib/inquiryNoteView";
import type { NatoriProject } from "@/features/natori/types/projects";

const CLIENT_MESSAGE = "淡いピンクでお願いします。";
const CLIENT_EMAIL = "client@example.com";

function structuredRequest(overrides: Record<string, unknown> = {}) {
  return {
    schemaVersion: 1,
    formVersion: "etorie-request-v1",
    inquiryMode: "quote",
    requestType: "icon",
    requestTypeOther: null,
    commissionScope: "bust_up",
    commissionScopeOther: null,
    options: [
      { id: "expression_variation", label: "表情差分", quantity: 2, notes: "笑顔" },
    ],
    usageTypes: ["social_icon"],
    usageTypeOther: null,
    commercialUse: "unknown",
    publicationPolicy: "allowed",
    budget: { kind: "undecided", min: null, max: null, currency: "JPY" },
    deadline: { kind: "undecided", date: null, note: "" },
    characterFeatures: "黒髪ロング",
    expressionMood: "",
    composition: "",
    colorDirection: "",
    referenceNotes: "",
    message: CLIENT_MESSAGE,
    legacySource: null,
    ...overrides,
  };
}

function project(overrides: Partial<NatoriProject> = {}): NatoriProject {
  return {
    id: "2ef91cb1-e0a3-4f32-b846-a0d8c6bbf44c",
    title: "SNSアイコン / テスト太郎",
    clientName: "テスト太郎",
    clientEmail: CLIENT_EMAIL,
    amount: null,
    dueDate: null,
    status: "inquiry",
    nextAction: "内容確認・案件種別を確定",
    type: "undecided",
    createdAt: "2026-08-01T00:00:00.000Z",
    deliveryPlan: "normal",
    tasks: [],
    referenceImageUrls: [],
    referenceFiles: [],
    referenceLinks: [],
    ...overrides,
  };
}

function renderPanel(overrides: Partial<NatoriProject> = {}) {
  const target = project(overrides);
  return render(
    <InquiryDetailPanel
      project={target}
      view={parseInquiryNote(target.note)}
      busy={false}
      onClose={() => undefined}
      onOpenMail={() => undefined}
      onCloseInquiry={() => undefined}
      onConfirmPayment={() => undefined}
      onConfirmType={async () => undefined}
      onSaveCorrection={async () => undefined}
      onSaveNextAction={async () => undefined}
      onAddLink={async () => undefined}
      onUpdateLink={async () => undefined}
      onDeleteLink={async () => undefined}
    />
  );
}

let errorSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
  cleanup();
  errorSpy.mockRestore();
});

describe("structured 表示", () => {
  it("受付区分と field ごとの値を表示する", () => {
    const { container } = renderPanel({ requestData: structuredRequest() });
    const field = (key: string) =>
      container.querySelector(`[data-field="${key}"]`)?.textContent;

    // 受付区分は badge と「依頼の内容」欄の両方に出る
    expect(container.querySelector('[data-inquiry-mode="quote"]')?.textContent).toBe(
      "見積もりを希望"
    );
    expect(field("inquiryMode")).toBe("見積もりを希望");
    expect(field("requestType")).toBe("SNSアイコン");
    expect(field("commissionScope")).toBe("胸上");
    expect(field("options")).toBe("表情差分 ×2（笑顔）");
    expect(field("usageTypes")).toBe("SNSアイコン");
    expect(field("commercialUse")).toBe("わからない・相談したい");
    expect(field("publicationPolicy")).toBe("公開してよい");
    expect(field("characterFeatures")).toBe("黒髪ロング");
    expect(field("message")).toBe(CLIENT_MESSAGE);
  });

  it("stable ID を主表示に出さない", () => {
    const { container } = renderPanel({ requestData: structuredRequest() });
    expect(container.textContent).not.toContain("expression_variation");
    expect(container.textContent).not.toContain("bust_up");
    expect(container.textContent).not.toContain("etorie-request-v1");
  });

  it("raw JSON を表示しない", () => {
    const { container } = renderPanel({ requestData: structuredRequest() });
    expect(container.textContent).not.toContain("schemaVersion");
    expect(container.textContent).not.toContain("legacySource");
    expect(container.textContent).not.toContain('{"');
  });

  it("未定は既存の表示語に揃える", () => {
    renderPanel({ requestData: structuredRequest() });
    // 予算・希望納期がどちらも「未定」で表示される
    expect(screen.getAllByText("未定").length).toBeGreaterThanOrEqual(2);
  });

  it("原回答が編集不可であることを明示する", () => {
    renderPanel({ requestData: structuredRequest() });
    expect(
      screen.getByText("依頼者の原回答です（管理画面からは編集できません）")
    ).toBeTruthy();
  });
});

describe("legacy 表示", () => {
  const legacyNote = [
    "【ご依頼フォームからの自動起票】",
    "メール: legacy@example.com",
    "ご依頼の種類: SNSアイコン",
    "",
    "--- ご依頼の詳細 ---",
    "旧フォームの本文です。",
  ].join("\n");

  it("request_data が無ければ note 由来の表示を維持する", () => {
    renderPanel({ requestData: undefined, note: legacyNote });
    expect(screen.getByText("旧フォームの本文です。")).toBeTruthy();
    expect(screen.getByText("SNSアイコン")).toBeTruthy();
    expect(screen.queryByText("原依頼内容")).toBeNull();
  });

  it("legacy note を新 schema へ推測変換しない", () => {
    const { container } = renderPanel({ requestData: undefined, note: legacyNote });
    expect(container.querySelector("[data-inquiry-mode]")).toBeNull();
  });
});

describe("表示不能な request_data", () => {
  it.each([
    ["未知 schemaVersion", structuredRequest({ schemaVersion: 9 })],
    ["未知 formVersion", structuredRequest({ formVersion: "future-v9" })],
    ["shape 不正", { broken: true }],
    ["unknown enum", structuredRequest({ commercialUse: "maybe" })],
  ])("%s でも画面全体を error にしない", (_name, requestData) => {
    renderPanel({ requestData });
    expect(
      screen.getByText(
        "この依頼データは現在の画面では完全に表示できません。案件の基本情報とメモのみ表示しています。"
      )
    ).toBeTruthy();
    // 案件共通情報は表示され続ける
    expect(screen.getByText(/テスト太郎/)).toBeTruthy();
  });

  it("表示不能でも raw JSON と依頼者本文を出さない", () => {
    const { container } = renderPanel({
      requestData: { schemaVersion: 1, message: CLIENT_MESSAGE, email: CLIENT_EMAIL },
    });
    expect(container.textContent).not.toContain(CLIENT_MESSAGE);
    expect(container.textContent).not.toContain("schemaVersion");
  });

  it("parse error を PII 付きで log しない", () => {
    renderPanel({
      requestData: { schemaVersion: 1, message: CLIENT_MESSAGE, email: CLIENT_EMAIL },
    });
    const logged = errorSpy.mock.calls.flat().map(String).join("\n");
    expect(logged).not.toContain(CLIENT_MESSAGE);
    expect(logged).not.toContain(CLIENT_EMAIL);
    expect(logged).not.toContain("テスト太郎");
  });
});

describe("review warning と管理確定", () => {
  it("未確定項目を要確認事項として並べる", () => {
    const { container } = renderPanel({ requestData: structuredRequest() });
    const codes = Array.from(container.querySelectorAll("[data-warning-code]")).map(
      (node) => node.getAttribute("data-warning-code")
    );
    expect(codes).toContain("project_type_unconfirmed");
    expect(codes).toContain("amount_undecided");
    expect(codes).toContain("due_date_undecided");
    expect(codes).toContain("commercial_use_unknown");
    expect(codes).toContain("budget_undecided");
  });

  it("全て確定済みなら不要な warning を出さない", () => {
    const { container } = renderPanel({
      requestData: structuredRequest({
        commercialUse: "none",
        budget: { kind: "fixed", min: 8000, max: 8000, currency: "JPY" },
        deadline: { kind: "preferred_date", date: "2026-09-01", note: "" },
      }),
      type: "icon",
      amount: 8000,
      dueDate: "2026-09-01",
    });
    expect(container.querySelectorAll("[data-warning-code]")).toHaveLength(0);
    expect(screen.getByText("未確定の項目はありません。見積もりに進めます。")).toBeTruthy();
  });

  it("amount の3状態を統一表記で出す", () => {
    const { rerender } = renderPanel({ amount: null });
    expect(screen.getAllByText("未定").length).toBeGreaterThan(0);
    cleanup();

    renderPanel({ amount: 0 });
    expect(screen.getAllByText(/無料/).length).toBeGreaterThan(0);
    cleanup();

    renderPanel({ amount: 8000 });
    expect(screen.getAllByText(/8,000/).length).toBeGreaterThan(0);
    void rerender;
  });

  it("種別確定済みなら確定 UI を出さず現在種別を表示する", () => {
    renderPanel({
      requestData: structuredRequest(),
      type: "icon",
      tasks: Array.from({ length: 6 }, (_, i) => ({
        id: `task-${i}`,
        label: `工程${i}`,
        stage: "rough" as const,
        done: false,
      })),
    });
    expect(screen.getByText("確定済み: アイコン")).toBeTruthy();
    expect(screen.getByText("制作タスク 6 件を作成済み")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "案件種別を確定する" })).toBeNull();
  });
});

describe("archived project", () => {
  it("確定・編集 UI を出さず、閲覧のみにする", () => {
    renderPanel({
      requestData: structuredRequest(),
      deletedAt: "2026-08-02T00:00:00.000Z",
    });
    expect(
      screen.getByText(
        "アーカイブ済みの案件です。内容の閲覧のみ可能で、確定・編集はできません。"
      )
    ).toBeTruthy();
    expect(screen.queryByRole("button", { name: "確定内容を保存" })).toBeNull();
    expect(screen.queryByRole("button", { name: "案件種別を確定する" })).toBeNull();
    expect(screen.queryByRole("button", { name: /リンクを追加/ })).toBeNull();
  });
});

describe("外部リンクと参考画像", () => {
  it("リンクは安全な rel 付きで開き、案内文を出す", () => {
    renderPanel({
      requestData: structuredRequest(),
      referenceLinks: [
        {
          id: "link-1",
          url: "https://example.com/board",
          label: "資料ボード",
          sortOrder: 0,
          createdAt: "2026-08-01T00:00:00.000Z",
        },
      ],
    });
    const anchor = screen.getByRole("link", { name: /開く/ });
    expect(anchor.getAttribute("href")).toBe("https://example.com/board");
    expect(anchor.getAttribute("rel")).toContain("noopener");
    expect(anchor.getAttribute("rel")).toContain("noreferrer");
    expect(anchor.getAttribute("target")).toBe("_blank");
    expect(
      screen.getByText(/リンク先が開けない場合はURLを確認してください/)
    ).toBeTruthy();
  });

  it("並び替え操作は提供しない（P1-07 は add/edit/delete のみ）", () => {
    renderPanel({
      requestData: structuredRequest(),
      referenceLinks: [
        {
          id: "link-1",
          url: "https://example.com/a",
          label: "資料1",
          sortOrder: 0,
          createdAt: "2026-08-01T00:00:00.000Z",
        },
        {
          id: "link-2",
          url: "https://example.com/b",
          label: "資料2",
          sortOrder: 5,
          createdAt: "2026-08-02T00:00:00.000Z",
        },
      ],
    });
    expect(screen.queryByRole("button", { name: /上へ/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /下へ/ })).toBeNull();
    // 編集・削除は維持する
    expect(screen.getAllByRole("button", { name: /を編集/ })).toHaveLength(2);
    expect(screen.getAllByRole("button", { name: /を削除/ })).toHaveLength(2);
  });

  it("sort_order の数値は利用者へ見せない", () => {
    const { container } = renderPanel({
      requestData: structuredRequest(),
      referenceLinks: [
        {
          id: "link-1",
          url: "https://example.com/a",
          label: "資料1",
          sortOrder: 5,
          createdAt: "2026-08-01T00:00:00.000Z",
        },
      ],
    });
    const linkRow = container.querySelector('[data-link-id="link-1"]');
    expect(linkRow?.textContent).not.toContain("5");
    expect(container.textContent).not.toContain("sortOrder");
    expect(container.textContent).not.toContain("sort_order");
  });

  it("参考画像は表示名付きで並び、Storage path を出さない", () => {
    const { container } = renderPanel({
      requestData: structuredRequest(),
      referenceFiles: [
        { url: "https://signed.example.com/a.webp?token=x", name: "資料1（b65e16de）" },
      ],
    });
    expect(screen.getByText("参考画像（1件）")).toBeTruthy();
    expect(screen.getByAltText("資料1（b65e16de）")).toBeTruthy();
    expect(container.textContent).not.toContain("natori-inquiry-refs");
    expect(container.textContent).not.toContain("token=");
  });

  it("画像が無ければセクションごと出さない", () => {
    renderPanel({ requestData: structuredRequest(), referenceFiles: [] });
    expect(screen.queryByText(/参考画像/)).toBeNull();
  });
});
