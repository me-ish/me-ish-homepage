import { describe, expect, it } from "vitest";
import {
  DELIVERY_LINK_PLACEHOLDER,
  FILES_LINK_PLACEHOLDER,
  buildDeliveryMailDraft,
  buildOrderMailLogEntry,
  buildRoughMailDraft,
  injectDeliveryLink,
  injectFilesLinks,
} from "@/features/natori/lib/orderMail";
import { formatYen } from "@/features/natori/lib/pricing";

describe("buildRoughMailDraft / buildDeliveryMailDraft", () => {
  it("ラフ提出メールに名乗り・案件名・ファイルリンクのプレースホルダが入る", () => {
    const draft = buildRoughMailDraft({
      clientName: "ゆきうさぎ",
      title: "全身立ち絵",
      artistName: "ユキノ",
    });
    expect(draft.subject).toBe("【ラフのご確認】全身立ち絵 について（ユキノ）");
    expect(draft.body).toContain("ゆきうさぎ 様");
    expect(draft.body).toContain(FILES_LINK_PLACEHOLDER);
    expect(draft.body).toContain("ユキノ");
    expect(draft.body).not.toContain("ナトリ");
  });

  it("名乗り省略時はナトリになる（現行運用の既定値）", () => {
    const rough = buildRoughMailDraft({ clientName: "A", title: "B" });
    const delivery = buildDeliveryMailDraft({ clientName: "A", title: "B" });
    expect(rough.body).toContain("ナトリ");
    expect(delivery.body).toContain("ナトリ");
  });

  it("納品メールに納品ページのプレースホルダと受け取り確認の案内が入る", () => {
    const draft = buildDeliveryMailDraft({ clientName: "A", title: "B" });
    expect(draft.body).toContain(DELIVERY_LINK_PLACEHOLDER);
    expect(draft.body).toContain("受け取りました");
  });
});

describe("injectFilesLinks / injectDeliveryLink", () => {
  it("プレースホルダをリンク行に差し替える", () => {
    const body = `前\n${FILES_LINK_PLACEHOLDER}\n後`;
    const out = injectFilesLinks(body, ["・a.png: https://x/a", "・b.psd: https://x/b"]);
    expect(out).toBe("前\n・a.png: https://x/a\n・b.psd: https://x/b\n後");
  });

  it("プレースホルダが消えていたら末尾に追記する", () => {
    expect(injectFilesLinks("本文だけ", ["・a: u"])).toContain("■ ラフ確認用リンク:\n・a: u");
    expect(injectDeliveryLink("本文だけ", "https://x/d")).toContain(
      "■ 納品ページ:\nhttps://x/d"
    );
  });

  it("納品リンクのプレースホルダを差し替える", () => {
    const out = injectDeliveryLink(`A\n${DELIVERY_LINK_PLACEHOLDER}\nB`, "https://x/d");
    expect(out).toBe("A\nhttps://x/d\nB");
  });
});

describe("buildOrderMailLogEntry (rough / delivery)", () => {
  it("ラフ提出・納品のログは金額を含まない", () => {
    expect(buildOrderMailLogEntry("rough", "2026-07-20", "a@b.c", 0)).toBe(
      "【ラフ提出メール送信 2026-07-20】宛先: a@b.c"
    );
    expect(buildOrderMailLogEntry("delivery", "2026-07-20", "a@b.c", 0)).toBe(
      "【納品メール送信 2026-07-20】宛先: a@b.c"
    );
  });

  it("見積もり・支払いのログは従来どおり金額を含む", () => {
    expect(buildOrderMailLogEntry("estimate", "2026-07-20", "a@b.c", 1000)).toContain(
      `金額: ${formatYen(1000)}`
    );
  });
});
