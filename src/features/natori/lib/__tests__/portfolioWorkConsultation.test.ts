import { describe, expect, it } from "vitest";
import { defaultPortfolioContent } from "@/features/natori/constants/portfolioContent";
import {
  portfolioConsultationWork,
  portfolioWorkConsultationMessage,
  withPortfolioConsultationWork,
} from "@/features/natori/lib/portfolioWorkConsultation";
import type { PortfolioWork } from "@/features/natori/types/portfolio";

const base = defaultPortfolioContent.works[0];
const works: PortfolioWork[] = [
  { ...base, id: "shown", title: "八木かぷら様", image: "https://example.com/shown.webp", published: true },
  { ...base, id: "hidden", title: "非公開の作品", image: "https://example.com/hidden.webp", published: false },
  { ...base, id: "noimage", title: "画像なし", image: null, published: true },
];

describe("portfolioConsultationWork", () => {
  it("only carries published works with images", () => {
    expect(portfolioConsultationWork(works, "shown")?.title).toBe("八木かぷら様");
    expect(portfolioConsultationWork(works, "hidden")).toBeNull();
    expect(portfolioConsultationWork(works, "noimage")).toBeNull();
    expect(portfolioConsultationWork(works, "missing")).toBeNull();
    expect(portfolioConsultationWork(works, undefined)).toBeNull();
  });
});

describe("consultation text", () => {
  it("names the work in one sentence for the message field", () => {
    expect(portfolioWorkConsultationMessage(" 八木かぷら様 ")).toBe("掲載作品「八木かぷら様」の雰囲気で相談したいです。");
    expect(portfolioWorkConsultationMessage("")).toBe("掲載作品の雰囲気で相談したいです。");
  });

  it("adds the work above the legacy details template without changing the template", () => {
    expect(withPortfolioConsultationWork("【キャラクターの特徴】\n", "八木かぷら様")).toBe(
      "【参考にしたい作品】\n掲載作品「八木かぷら様」\n\n【キャラクターの特徴】\n"
    );
  });
});
