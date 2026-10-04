// features/natori/lib/portfolioHeroFacts.ts
// 公開ポートフォリオの1画面目に添える「料金・お返事・納期」の目安を、掲載内容から作る純関数。
// 新しい値は作らず、料金表・受付文面・納期の説明文に書いてある値だけを短く言い直す。
// 読み取れない項目は出さない。
import { NATORI_INTAKE_COPY } from "@/features/natori/constants/portfolioContactCopy";
import type { PortfolioContent } from "@/features/natori/types/portfolio";

export type PortfolioHeroFact = {
  label: string;
  value: string;
};

/** 「3,000円」「3,000円～」のような単一金額だけを読む。範囲や文章は読まない。 */
function parsePlanPrice(price: string): number | null {
  const match = price.trim().match(/^([0-9][0-9,]*)円[〜～~]?$/u);
  if (!match) return null;
  const amount = Number(match[1].replaceAll(",", ""));
  return Number.isSafeInteger(amount) && amount > 0 ? amount : null;
}

/**
 * 通常イラストでいちばん安いプランを「SDキャラ」「3,000円～」の形で返す。
 * 量産イラストのほうが安いため、「料金〇円〜」ではなくプラン名と組にする。
 */
export function portfolioStartingPlan(
  plans: PortfolioContent["plans"],
): PortfolioHeroFact | null {
  let cheapest: { name: string; amount: number } | null = null;
  for (const plan of plans) {
    const amount = parsePlanPrice(plan.price);
    if (amount !== null && (cheapest === null || amount < cheapest.amount)) {
      cheapest = { name: plan.name.trim(), amount };
    }
  }
  if (cheapest === null) return null;
  // 料金表（PortfolioPricing）と同じ「～」を付ける。
  return { label: cheapest.name || "料金", value: `${cheapest.amount.toLocaleString("ja-JP")}円～` };
}

/** 受付文面（「2〜3日以内にお返事します」）に書かれた返信の目安。 */
export function portfolioReplyWithin(replyCopy: string = NATORI_INTAKE_COPY.reply): string | null {
  return replyCopy.match(/[0-9０-９]+(?:[〜～~][0-9０-９]+)?日以内/u)?.[0] ?? null;
}

/** 納期の説明文に最初に出てくる期間（「約1か月」「7〜14日」など）。 */
export function portfolioDeliveryEstimate(deliveryLead: string): string | null {
  return (
    deliveryLead.match(
      /(?:約|およそ)?[0-9０-９]+(?:[〜～~][0-9０-９]+)?(?:か月|ヶ月|カ月|ケ月|週間|日)/u,
    )?.[0] ?? null
  );
}

export function portfolioHeroFacts(
  content: Pick<PortfolioContent, "plans" | "deliveryLead">,
): PortfolioHeroFact[] {
  const facts: Array<PortfolioHeroFact | null> = [
    portfolioStartingPlan(content.plans),
    withValue("お返事", portfolioReplyWithin()),
    withValue("納期", portfolioDeliveryEstimate(content.deliveryLead)),
  ];
  return facts.filter((fact): fact is PortfolioHeroFact => fact !== null);
}

function withValue(label: string, value: string | null): PortfolioHeroFact | null {
  return value ? { label, value } : null;
}
