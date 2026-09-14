// features/natori/components/portfolio/PortfolioGuidelines.tsx
// ご依頼前の確認事項。規約本文は別ページに分離し、ここでは意思決定に必要な要点だけを見せる。
import Link from "next/link";

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

const legalLinks = [
  { href: "/natori/legal/terms", label: "ご依頼規約" },
  { href: "/natori/legal/privacy", label: "プライバシーポリシー" },
  { href: "/natori/legal/tokushoho", label: "特定商取引法に基づく表記" },
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

export default function PortfolioGuidelines({ content }: { content: PortfolioContent }) {
  const groups = groupRequests(content.requests);

  return (
    <section id="requests" className="pt-6 pb-16 md:py-16" style={{ background: c.surfaceSubtle }}>
      <div className="mx-auto max-w-4xl px-5">
        <h2 className="text-center text-2xl font-black md:text-3xl">ご依頼前にご確認ください</h2>
        <p
          className="mx-auto mt-3 mb-6 max-w-2xl text-center text-sm leading-relaxed md:text-base"
          style={{ color: c.textSoft }}
        >
          ご依頼フォームを送信する前に、制作条件と作品の取り扱いについてご確認ください。
        </p>

        <div className="grid gap-3 md:grid-cols-2">
          {groups.map((group, groupIndex) => {
            const headingId = `request-group-${groupIndex}`;
            return (
              <section
                key={group.title}
                aria-labelledby={headingId}
                className="rounded-2xl p-5 md:p-6"
                style={cardStyle}
              >
                <h3
                  id={headingId}
                  className="mb-3 text-base font-black md:text-lg"
                  style={{ color: c.accentDisplay }}
                >
                  {group.title}
                </h3>
                <ul className="space-y-2 text-sm leading-relaxed md:text-base">
                  {group.items.map((request, index) => (
                    <li key={`${request}-${index}`} className="flex items-start gap-2.5">
                      <span
                        className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ background: c.accent }}
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

        <div
          className="mt-4 rounded-2xl border p-5 text-sm md:flex md:items-center md:justify-between md:gap-6 md:text-base"
          style={{ background: c.accentSoft, borderColor: c.borderStrong }}
        >
          <div className="mb-3 md:mb-0">
            <p className="font-black">詳しい条件はこちら</p>
            <p className="mt-1 text-sm leading-relaxed" style={{ color: c.textSoft }}>
              お支払い・個人情報の取り扱いなど、詳細は各ページをご確認ください。
            </p>
          </div>
          <nav aria-label="ご依頼に関する規約" className="flex flex-wrap gap-2 md:justify-end">
            {legalLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="rounded-full border-2 px-3 py-2 text-sm font-bold underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                style={{ borderColor: c.borderStrong, color: c.accentText }}
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
      </div>
    </section>
  );
}
