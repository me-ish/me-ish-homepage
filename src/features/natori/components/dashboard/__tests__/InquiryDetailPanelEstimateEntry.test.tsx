// @vitest-environment jsdom
// 見積もり導線の一本化（Q-05）: 本番は確認モーダルを挟まず見積りページへ直接進む。
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import InquiryDetailPanel from "@/features/natori/components/dashboard/InquiryDetailPanel";
import { parseInquiryNote } from "@/features/natori/lib/inquiryNoteView";
import type { NatoriProject } from "@/features/natori/types/projects";

afterEach(cleanup);

const ESTIMATE_HREF = "/natori/estimate?inquiry=2ef91cb1-e0a3-4f32-b846-a0d8c6bbf44c";

function project(overrides: Partial<NatoriProject> = {}): NatoriProject {
  return {
    id: "2ef91cb1-e0a3-4f32-b846-a0d8c6bbf44c",
    title: "SNSアイコン / テスト太郎",
    clientName: "テスト太郎",
    clientEmail: "client@example.com",
    amount: null,
    dueDate: null,
    status: "inquiry",
    nextAction: "内容確認",
    type: "illustration",
    createdAt: "2026-08-01T00:00:00.000Z",
    deliveryPlan: "normal",
    tasks: [],
    referenceImageUrls: [],
    referenceFiles: [],
    referenceLinks: [],
    ...overrides,
  };
}

function renderPanel(overrides: Partial<NatoriProject>, props: { demoMode?: boolean; onOpenMail?: () => void } = {}) {
  const target = project(overrides);
  return render(
    <InquiryDetailPanel
      project={target}
      view={parseInquiryNote(target.note)}
      busy={false}
      demoMode={props.demoMode}
      estimateHref={props.demoMode ? "/etorie/demo/app/estimate?inquiry=x" : ESTIMATE_HREF}
      projectsHref="/natori/projects"
      onClose={() => undefined}
      onOpenMail={props.onOpenMail ?? (() => undefined)}
      onCloseInquiry={() => undefined}
      onConfirmPayment={() => undefined}
    />
  );
}

describe("InquiryDetailPanel estimate entry (Q-05)", () => {
  it("in production the estimate mail item no longer opens a confirm modal", () => {
    const onOpenMail = vi.fn();
    renderPanel({ status: "inquiry" }, { onOpenMail });
    expect(screen.queryByRole("button", { name: /見積もりメール/ })).toBeNull();
    // 主ボタンの「見積りを作る」が見積りページへの唯一の入口
    const links = screen.getAllByRole("link", { name: "見積りを作る" });
    expect(links).toHaveLength(1);
    expect(links[0].getAttribute("href")).toBe(ESTIMATE_HREF);
    expect(onOpenMail).not.toHaveBeenCalled();
  });

  it("for a quoted inquiry the resend entry is one link to the estimate page", () => {
    renderPanel({ status: "quoted", amount: 12000 });
    expect(screen.queryByRole("button", { name: /見積もりメール/ })).toBeNull();
    expect(screen.queryByRole("link", { name: "見積りを作る" })).toBeNull();
    const link = screen.getByRole("link", { name: "見積りを開く・再送" });
    expect(link.getAttribute("href")).toBe(ESTIMATE_HREF);
  });

  it("the demo keeps its in-page mail draft", () => {
    const onOpenMail = vi.fn();
    renderPanel({ status: "inquiry" }, { demoMode: true, onOpenMail });
    fireEvent.click(screen.getByRole("button", { name: "見積もりメールを送る" }));
    expect(onOpenMail).toHaveBeenCalledWith("estimate");
  });
});
