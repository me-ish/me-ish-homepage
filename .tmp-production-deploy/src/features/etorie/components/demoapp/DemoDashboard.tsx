"use client";

// features/etorie/components/demoapp/DemoDashboard.tsx
// デモ環境のダッシュボード。実ダッシュボード（/natori/dashboard）と同じ構成で、
// 各カードはデモ環境内の各画面へリンクする。データはサンプル。
import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Calculator,
  FolderOpen,
  Inbox,
  Link2,
  Palette,
  PenLine,
  Trophy,
  type LucideIcon,
} from "lucide-react";
import DashboardTodaySummary from "@/features/natori/components/dashboard/DashboardTodaySummary";
import { isPreworkStatus } from "@/features/natori/lib/projects";
import { makeDemoWorkspaceProjects } from "@/features/etorie/lib/demoWorkspace";

type DemoCard = { href: string; title: string; icon: LucideIcon; accent: string };

const CARD_GROUPS: Array<{ heading: string; cards: DemoCard[] }> = [
  {
    heading: "管理ツール",
    cards: [
      {
        href: "/etorie/demo/app/inquiries",
        title: "問い合わせ",
        icon: Inbox,
        accent: "from-orange-100 to-orange-50 text-orange-700",
      },
      {
        href: "/etorie/demo/app/projects",
        title: "案件管理",
        icon: FolderOpen,
        accent: "from-pink-100 to-pink-50 text-pink-700",
      },
      {
        href: "/etorie/demo/app/estimate",
        title: "見積もり",
        icon: Calculator,
        accent: "from-rose-100 to-rose-50 text-rose-700",
      },
      {
        href: "/etorie/demo/app/results",
        title: "売上・実績",
        icon: Trophy,
        accent: "from-emerald-100 to-emerald-50 text-emerald-700",
      },
    ],
  },
  {
    heading: "公開ページ・編集",
    cards: [
      {
        href: "/etorie/demo/app/portfolio",
        title: "ポートフォリオ",
        icon: Palette,
        accent: "from-violet-100 to-violet-50 text-violet-700",
      },
      {
        href: "/etorie/demo/app/portfolio/edit",
        title: "ポートフォリオ編集",
        icon: PenLine,
        accent: "from-sky-100 to-sky-50 text-sky-700",
      },
      {
        href: "/etorie/demo/app/links",
        title: "リンク集",
        icon: Link2,
        accent: "from-amber-100 to-amber-50 text-amber-700",
      },
      {
        href: "/etorie/demo/app/links/edit",
        title: "リンク集編集",
        icon: PenLine,
        accent: "from-teal-100 to-teal-50 text-teal-700",
      },
    ],
  },
];

export default function DemoDashboard() {
  const [today] = useState(() => new Date());
  const projects = useMemo(() => makeDemoWorkspaceProjects(today), [today]);

  const inquiryCounts = useMemo(() => {
    const prework = projects.filter(
      (project) => project.status !== "closed" && isPreworkStatus(project.status)
    );
    const pending = prework.filter(
      (project) => project.status === "inquiry" || project.status === "consulting"
    ).length;
    return { pending, inProgress: prework.length - pending };
  }, [projects]);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-pink-600">Dashboard</p>
        <p className="text-sm font-bold text-gray-900">仕事用ダッシュボード</p>
        <span className="ml-auto rounded-full border border-[#E5DED4] bg-[#FAF7F2] px-3 py-1 text-xs font-bold text-[#A87F3C]">
          ユキノ（デモ）
        </span>
      </div>

      <DashboardTodaySummary projects={projects} today={today} />

      {CARD_GROUPS.map((group) => (
        <div key={group.heading} className="mt-6">
          <h2 className="text-xs font-bold uppercase tracking-[0.18em] text-pink-600">
            {group.heading}
          </h2>
          <ul className="mt-2 grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
            {group.cards.map((card) => {
              const Icon = card.icon;
              return (
                <li key={card.title}>
                  <Link
                    href={card.href}
                    className={`group flex h-full items-center gap-3 rounded-2xl border border-pink-100 bg-gradient-to-br ${card.accent} bg-white/80 p-3 shadow-sm transition hover:shadow-md`}
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white shadow-sm">
                      <Icon className="h-5 w-5" aria-hidden />
                    </div>
                    <p className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-sm font-black leading-5 text-gray-900">
                      {card.title}
                      {card.href.endsWith("/inquiries") ? (
                        <>
                          {inquiryCounts.pending > 0 ? (
                            <span className="inline-flex items-center rounded-full bg-red-500 px-2 py-0.5 text-[11px] font-bold text-white">
                              未対応 {inquiryCounts.pending}件
                            </span>
                          ) : null}
                          {inquiryCounts.inProgress > 0 ? (
                            <span className="inline-flex items-center rounded-full border border-orange-300 bg-white px-2 py-0.5 text-[11px] font-bold text-orange-700">
                              対応中 {inquiryCounts.inProgress}件
                            </span>
                          ) : null}
                        </>
                      ) : null}
                    </p>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}

      <p className="mt-6 text-xs leading-5 text-gray-500">
        実際の製品では、このダッシュボードに自分のデータが表示されます。ここはデモ環境なので、
        どの画面もサンプルデータで自由に操作できます（ページを再読み込みすると元に戻ります）。
      </p>
    </div>
  );
}
