// features/natori/components/portfolio/PortfolioGuidelines.tsx
// ご依頼前の確認事項。規約本文は別ページに分離し、ここでは意思決定に必要な要点だけを見せる。
// よくある質問も同じ「頼む前に知りたいこと」なので、children としてこの区画の中に続けて置く。
import type { ReactNode } from "react";
import { portfolioColors as c } from "@/features/natori/constants/portfolioContent";
import type { PortfolioContent } from "@/features/natori/types/portfolio";

const cardStyle = {
  background: c.surface,
  boxShadow: `0 10px 22px ${c.shadowSoft}`,
} as const;

const DEFAULT_REQUEST_GROUPS = [
  {
    title: "ご依頼内容",
    items: ["ご依頼時は、できるだけ詳細な資料・イメージをご提示ください"],
  },
  {
    title: "修正について",
    items: ["大幅な修正はラフ段階でお願いいたします"],
  },
  {
    title: "商用利用・実績公開",
    items: [
      "商用利用の有無を事前にお知らせください",
      "制作した作品は実績として掲載する場合があります（不可の場合は事前にご相談ください）",
    ],
  },
  {
    title: "禁止事項",
    items: ["自作発言・AI学習は禁止しております"],
  },
] as const;

type GuidelineGroup = {
  title: string;
  items: string[];
};

function groupRequests(requests: string[]): GuidelineGroup[] {
  const remaining = [...requests];
  const groups: GuidelineGroup[] = DEFAULT_REQUEST_GROUPS.map((group) => {
    const items = group.items.filter((item) => {
      const index = remaining.indexOf(item);
      if (index < 0) return false;
      remaining.splice(index, 1);
      return true;
    });

    return { title: group.title, items: [...items] };
  }).filter((group) => group.items.length > 0);

  if (remaining.length > 0) {
    groups.push({ title: "その他のお願い", items: remaining });
  }

  return groups;
}

export default function PortfolioGuidelines({ content, children }: { content: PortfolioContent; children?: ReactNode }) {
  const groups = groupRequests(content.requests);

  return (
    <section id="requests" className="pt-6 pb-16 md:py-16" style={{ background: c.surfaceSubtle }}>
      <div className="mx-auto max-w-3xl px-5">
        <h2 className="text-center text-2xl font-black md:text-3xl">ご依頼前にご確認ください</h2>
        <p
          className="mx-auto mt-3 mb-6 max-w-2xl text-center text-sm leading-relaxed md:text-base"
          style={{ color: c.textSoft }}
        >
          ご依頼フォームを送信する前に、制作条件と作品の取り扱いについてご確認ください。
        </p>

        {/* 4つの小さなカードに分けず、1枚の中に見出しと内容を並べて縦の長さを抑える */}
        <div className="divide-y rounded-2xl px-5 md:px-6" style={{ ...cardStyle, borderColor: c.borderSubtle }}>
          {groups.map((group, groupIndex) => {
            const headingId = `request-group-${groupIndex}`;
            return (
              <section
                key={group.title}
                aria-labelledby={headingId}
                className="grid gap-1.5 py-4 md:grid-cols-[10rem_minmax(0,1fr)] md:gap-4"
                style={{ borderColor: c.borderSubtle }}
              >
                <h3
                  id={headingId}
                  className="text-[15px] font-black md:text-base"
                  style={{ color: c.text }}
                >
                  {group.title}
                </h3>
                <ul className="space-y-1.5 text-sm leading-relaxed md:text-base">
                  {group.items.map((request, index) => (
                    <li key={`${request}-${index}`} className="flex items-start gap-2.5">
                      <span
                        className="mt-1.5 h-2 w-2 shrink-0 rounded-full"
                        style={{ background: c.action }}
                        aria-hidden="true"
                      />
                      <span style={{ color: c.textSoft }}>{request}</span>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>

        {children}
      </div>
    </section>
  );
}
