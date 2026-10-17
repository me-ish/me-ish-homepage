import { describe, expect, it } from "vitest";
import { workflowStepView } from "../portfolioStepText";
import { NATORI_PUBLIC_WORKFLOW } from "../portfolioWorkflow";

describe("workflowStepView", () => {
  it("標準の文面は要約を見せ、全文は「くわしく」に残す", () => {
    for (const step of NATORI_PUBLIC_WORKFLOW) {
      const view = workflowStepView(step);
      expect(view.lead.length).toBeGreaterThan(0);
      expect(view.lead.length).toBeLessThan(step.body.length);
      expect(view.detail).toBe(step.body);
    }
  });

  it("本番に保存されている清書の行（1文少ない標準文面）も要約する", () => {
    const body = "ラフ確定後に清書を進めます。完成後はメールで納品ページをご案内します。ページから完成データをダウンロードし、「受け取りました」を押していただくと納品完了です。";
    expect(workflowStepView({ title: "清書・納品", body })).toEqual({
      lead: "完成後にメールでご案内する納品ページから、データを受け取っていただきます。",
      detail: body,
    });
  });

  it("大事な条件は要約にも残し、すぐ見積もりが届くとは書かない", () => {
    const leads = NATORI_PUBLIC_WORKFLOW.map((step) => workflowStepView(step).lead);
    expect(leads[0]).toContain("送信だけではご依頼は確定しません");
    expect(leads[1]).toContain("2〜3日以内にお返事");
    expect(leads[3]).toContain("無料リテイク2回まで");
    expect(leads[3]).toContain("量産イラストは原則リテイクなし");
    expect(leads.join("")).not.toContain("以内にお見積もりメール");
  });

  it("編集された文面は書かれたとおり全文を見せ、畳まない", () => {
    const body = "最初の文です。続きの文です。もう1文。";
    expect(workflowStepView({ title: "独自の手順", body })).toEqual({ lead: body, detail: "" });
    const edited = { ...NATORI_PUBLIC_WORKFLOW[0], body: `${NATORI_PUBLIC_WORKFLOW[0].body}追記。` };
    expect(workflowStepView(edited)).toEqual({ lead: edited.body, detail: "" });
  });
});
