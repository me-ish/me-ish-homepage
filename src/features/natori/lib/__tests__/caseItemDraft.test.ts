import { describe, expect, it } from "vitest";
import { caseItemDraftToFields, readCaseItemDraft } from "../caseItems";

const row = (title: string, projectType = "", amount = "", dueDate = "") => ({ title, projectType, amount, dueDate });

describe("登録フォームの品目", () => {
  it("全品目に種類と金額があれば、案件の種類は1点目・金額は合計・納期はいちばん早い日", () => {
    const result = caseItemDraftToFields([
      row("立ち絵A", "standing", "20000", "2026-12-20"),
      row("SD", "sd", "6000", "2026-12-10"),
      row("", "", "", ""),
    ]);
    expect(result).toMatchObject({ kind: "ok", type: "standing", amount: 26000, dueDate: "2026-12-10" });
    if (result.kind !== "ok") throw new Error();
    expect(result.items.map((i) => [i.title, i.projectType, i.amount, i.progress, i.publicationPolicy])).toEqual([
      ["立ち絵A", "standing", 20000, "not_started", "unknown"],
      ["SD", "sd", 6000, "not_started", "unknown"],
    ]);
  });

  it("金額か種類が1つでも空なら、案件の種類と金額は決めない（品目は保存する）", () => {
    const result = caseItemDraftToFields([row("A", "icon", "5000"), row("B", "icon", "")]);
    expect(result).toMatchObject({ kind: "ok", type: null, amount: null, dueDate: null });
    if (result.kind === "ok") expect(result.items).toHaveLength(2);
  });

  it("名前のない行や、おかしな金額は止める", () => {
    expect(caseItemDraftToFields([row("A"), row("", "sd", "100")])).toEqual({ kind: "error", message: "2つ目の品目に名前を入れてください。" });
    expect(caseItemDraftToFields([row("A", "sd", "-1")])).toEqual({ kind: "error", message: "1つ目の品目の入力を見直してください。" });
    expect(caseItemDraftToFields([row("A", "sd", "1.5")])).toMatchObject({ kind: "error" });
  });

  it("下書きの文字列が壊れていても空として読む", () => {
    expect(readCaseItemDraft("not json")).toEqual([]);
    expect(readCaseItemDraft('{"a":1}')).toEqual([]);
    expect(readCaseItemDraft('[{"title":"A","amount":3}]')).toEqual([row("A")]);
  });
});
