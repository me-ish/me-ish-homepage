import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { buildDeliveryCompletionMail } from "@/features/natori/server/deliveryCompletionMailService";

describe("buildDeliveryCompletionMail", () => {
  it("gives the client a clear completion record", () => {
    const mail = buildDeliveryCompletionMail({
      clientName: "空猫くるみ",
      title: "イベント用アクリルスタンドイラスト",
    });

    expect(mail.subject).toBe("【納品完了】ご依頼ありがとうございました（ナトリ）");
    expect(mail.body).toContain("空猫くるみ 様");
    expect(mail.body).toContain("納品データの受け取りを確認いたしました。");
    expect(mail.body).toContain(
      "「イベント用アクリルスタンドイラスト」のご依頼は納品完了となります。",
    );
    expect(mail.body).toContain("この度はナトリへご依頼いただき、本当にありがとうございました。");
    expect(mail.body).toContain("このメールにそのままご返信ください");
  });
});
