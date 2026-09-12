"use client";

import { ExternalLink } from "lucide-react";
import { portfolioColors as c } from "@/features/natori/constants/portfolioContent";
import { trackNatoriPageEvent } from "@/features/natori/data/pageEvents";
import { portfolioWorkLinkEventLabel } from "@/features/natori/lib/pageEvents";
import type {
  PortfolioWorkLink,
  PortfolioWorkLinkKind,
} from "@/features/natori/types/portfolio";

const GROUPS: Array<{ kind: PortfolioWorkLinkKind; title: string }> = [
  { kind: "client", title: "ご依頼者様" },
  { kind: "usage", title: "制作物の使用例" },
];

function serviceLabel(href: string): string {
  try {
    const host = new URL(href).hostname.toLowerCase().replace(/^www\./u, "");
    if (host === "x.com" || host === "twitter.com") return "X";
    if (host === "youtube.com" || host === "youtu.be") return "YouTube";
    if (host === "twitch.tv") return "Twitch";
    if (host === "booth.pm") return "BOOTH";
  } catch {
    return "関連ページ";
  }
  return "関連ページ";
}

export default function PortfolioWorkRelatedLinks({
  workTitle,
  links,
}: {
  workTitle: string;
  links: PortfolioWorkLink[];
}) {
  const visibleLinks = links.filter((link) => link.href.trim().length > 0);
  if (visibleLinks.length === 0) return null;

  return (
    <div className="mt-3 space-y-3 border-t pt-3" style={{ borderColor: c.borderSubtle }}>
      {GROUPS.map((group) => {
        const groupLinks = visibleLinks.filter((link) => link.kind === group.kind);
        if (groupLinks.length === 0) return null;
        return (
          <div key={group.kind}>
            <p className="text-xs font-bold" style={{ color: c.textSoft }}>
              {group.title}
            </p>
            <div className="mt-1.5 flex flex-wrap gap-2">
              {groupLinks.map((link) => {
                const label = link.label.trim() || serviceLabel(link.href);
                return (
                  <a
                    key={link.id}
                    href={link.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() =>
                      trackNatoriPageEvent(
                        "portfolio_work_link_click",
                        portfolioWorkLinkEventLabel(workTitle, link.kind, label),
                      )
                    }
                    className="pf-cute-focus inline-flex min-h-[40px] items-center gap-1.5 rounded-full border px-3 py-2 text-xs font-bold transition hover:-translate-y-0.5 hover:shadow-sm"
                    style={{
                      background: c.surface,
                      borderColor: c.borderStrong,
                      color: c.text,
                    }}
                  >
                    {label}
                    <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                  </a>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
