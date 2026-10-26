"use client";
import Link from "next/link";
import { BarChart3, ExternalLink, Link2, Palette, type LucideIcon } from "lucide-react";
import { natoriAdminUi as ui } from "../../constants/adminUi";

type PublicPage = { title: string; description: string; icon: LucideIcon; viewHref: string | null; editHref: string };

/** Entrances to the public pages. View links open a new tab so the workspace state stays. */
export function CasePublicPages({ portfolioHref, linksHref }: { portfolioHref: string | null; linksHref: string | null }) {
  const pages: PublicPage[] = [
    { title: "ポートフォリオ", description: "依頼者が最初に見るページ", icon: Palette, viewHref: portfolioHref, editHref: "/natori/portfolio/edit" },
    { title: "リンク集", description: "SNSや各ページへの入口", icon: Link2, viewHref: linksHref, editHref: "/natori/links/edit" },
  ];
  return <div className="space-y-3">
    {pages.map(page => <article key={page.title} className="rounded-2xl border border-zinc-200 bg-white p-4">
      <div className="flex items-center gap-3">
        <span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-pink-50 text-pink-800"><page.icon size={20} /></span>
        <div><h2 className="text-[16px] font-semibold leading-6">{page.title}</h2><p className="text-xs text-zinc-500">{page.description}</p></div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        {page.viewHref ? <a href={page.viewHref} target="_blank" rel="noopener noreferrer" className={ui.btnSecondary}>見る<ExternalLink aria-hidden="true" size={14} /><span className="sr-only">（新しいタブ）</span></a>
          : <span className="text-xs leading-5 text-amber-900">公開URLの設定を確認してください</span>}
        <Link href={page.editHref} className={ui.btnPrimary}>編集する</Link>
      </div>
    </article>)}
    <Link href="/natori/results" className="flex items-center gap-3 rounded-2xl border border-zinc-200 bg-white p-4">
      <span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-pink-50 text-pink-800"><BarChart3 size={20} /></span>
      <span className="min-w-0 flex-1"><span className="block text-[16px] font-semibold leading-6">実績</span><span className="block text-xs text-zinc-500">件数・売上の月別</span></span>
      <span aria-hidden="true" className="text-zinc-400">›</span>
    </Link>
  </div>;
}
