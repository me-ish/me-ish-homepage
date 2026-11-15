import { describe, expect, it } from "vitest";
import { defaultPortfolioContent } from "@/features/natori/constants/portfolioContent";
import { buildNatoriInquiryRequestView } from "../inquiryRequestView";
import { portfolioPublicationLabel, relabelPortfolioConfirmation } from "../portfolioFormLabels";
import { buildNatoriRequestDataV1, createInitialPortfolioRequestFormState } from "../portfolioRequestForm";

const options = defaultPortfolioContent.options;

describe("依頼フォームの言葉", () => {
  it("実績掲載の選択肢はポートフォリオの呼び名と料金で出す", () => {
    expect(portfolioPublicationLabel("work_private", options)).toBe("サンプル使用不可（+1,000円）");
    expect(portfolioPublicationLabel("fully_private", options)).toBe("完全非公開（+2,000円）");
    expect(portfolioPublicationLabel("delayed", options)).toBe("一定期間後なら公開してよい（無料）");
    expect(portfolioPublicationLabel("allowed", options)).toBe("公開してよい");
    // 掲載設定にオプションが無いときは、これまでの名前のまま
    expect(portfolioPublicationLabel("work_private", [])).toBe("作品の公開は不可");
  });

  it("確認画面の項目名を入力画面と同じ言葉にし、管理画面の言葉は変えない", () => {
    const request = buildNatoriRequestDataV1({
      ...createInitialPortfolioRequestFormState(),
      inquiryMode: "quote",
      commissionScope: "full_body",
      requestType: "illustration",
      publicationPolicy: "work_private",
      budgetKind: "range",
      budgetMin: "0",
      budgetMax: "5000",
    }, []);
    const view = buildNatoriInquiryRequestView(request);
    if (view.kind !== "structured") throw new Error("structured view expected");
    const admin = view.sections.flatMap((section) => section.fields);
    const client = relabelPortfolioConfirmation(view.sections, request, options).flatMap((section) => section.fields);
    const label = (key: string) => client.find((field) => field.key === key);
    expect(label("inquiryMode")?.label).toBe("ご希望");
    expect(label("usageTypes")?.label).toBe("使いみち");
    expect(label("publicationPolicy")).toMatchObject({ label: "実績掲載", value: "サンプル使用不可（+1,000円）" });
    expect(label("budget")).toMatchObject({ label: "ご予算", value: "〜5,000円" });
    expect(admin.find((field) => field.key === "publicationPolicy")?.label).toBe("公開可否");
    expect(admin.find((field) => field.key === "budget")?.value).toBe("0円〜5,000円");
  });
});
