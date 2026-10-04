"use client";

// features/natori/components/dashboard/PageEventsPanel.tsx
// ダッシュボードのクリック解析パネル。リンク集・コミッションポートフォリオの
// クリック/送信イベント（自前計測）を 30日/90日 で集計表示する。
import { useEffect, useState } from "react";
import { BarChart3, ChevronDown } from "lucide-react";
import { natoriAdminUi } from "@/features/natori/constants/adminUi";
import {
  fetchNatoriPageEventSummary,
  type NatoriPageEventSummary,
} from "@/features/natori/data/pageEvents";

const EVENT_META: Array<{ event: string; title: string; hint?: string }> = [
  { event: "links_click", title: "リンク集のクリック", hint: "/natori/links" },
  {
    event: "portfolio_primary_cta_click",
    title: "主要相談CTAクリック",
    hint: "hero / mobile_sticky / pricing",
  },
  { event: "portfolio_gallery_open", title: "作品の拡大表示", hint: "コレクション / 作品名" },
  {
    event: "portfolio_work_link_click",
    title: "実績の関連リンククリック",
    hint: "作品名 / client・usage / 表示名",
  },
  {
    event: "portfolio_form_start",
    title: "ご依頼フォーム入力開始",
    hint: "1ページ表示につき1回",
  },
  {
    event: "portfolio_form_mode_select",
    title: "ご希望モード選択",
    hint: "consultation / quote",
  },
  { event: "portfolio_form_submit", title: "ご依頼フォーム送信", hint: "/natori/portfolio" },
  { event: "portfolio_plan_click", title: "「このプランで相談」クリック", hint: "料金カード" },
  { event: "portfolio_sns_click", title: "SNSリンクのクリック", hint: "ポートフォリオ内の X / つなぐ" },
];

export default function PageEventsPanel() {
  const [open, setOpen] = useState(false);
  const [summary, setSummary] = useState<NatoriPageEventSummary | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await fetchNatoriPageEventSummary();
        if (cancelled) return;
        setSummary(data);
        setState("ready");
      } catch (err) {
        console.error("[PageEventsPanel] load failed", err);
        if (!cancelled) setState("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // 未認可などで取れないときはパネルごと出さない
  if (state === "error") return null;

  const total30 = summary?.counts.reduce((sum, entry) => sum + entry.last30Days, 0) ?? 0;

  return (
    <section className={`mt-6 rounded-2xl ${natoriAdminUi.surface}`}>
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        className="group flex w-full items-center justify-between gap-3 rounded-2xl p-4 text-left transition-colors hover:bg-zinc-50/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#831843] sm:px-5"
      >
        <div className="flex min-w-0 items-center gap-3">
          <span className={natoriAdminUi.iconTileNeutral}>
            <BarChart3 className="h-5 w-5" aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-semibold text-zinc-900">
              クリック解析
              {state === "ready" ? (
                <span className={`${natoriAdminUi.badge} ${natoriAdminUi.badgeTone.neutral} font-medium`}>
                  直近30日 {total30}件
                </span>
              ) : null}
            </p>
            <p className="mt-0.5 text-xs leading-5 text-zinc-600">
              リンク集・コミッションページのクリックと依頼フォーム送信の回数です。
            </p>
          </div>
        </div>
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-zinc-500 transition-colors group-hover:bg-zinc-100">
          <ChevronDown
            className={`h-5 w-5 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
            aria-hidden
          />
        </span>
      </button>

      {open ? (
        <div className="space-y-5 border-t border-zinc-100 px-4 pb-5 pt-4 sm:px-5">
          {state === "loading" ? (
            <div className="h-24 animate-pulse rounded-xl bg-zinc-100" />
          ) : summary && summary.counts.length > 0 ? (
            <>
              {EVENT_META.map((meta) => {
                const rows = summary.counts.filter((entry) => entry.event === meta.event);
                if (rows.length === 0) return null;
                return (
                  <div key={meta.event}>
                    <p className="text-xs font-semibold text-zinc-700">
                      {meta.title}
                      {meta.hint ? (
                        <span className="ml-1.5 font-medium normal-case text-zinc-500">
                          {meta.hint}
                        </span>
                      ) : null}
                    </p>
                    <table className="mt-1.5 w-full border-collapse text-sm">
                      <thead>
                        <tr className="text-left text-xs font-semibold text-zinc-500">
                          <th className="py-1 pr-2 font-semibold">
                            <span className="sr-only">項目</span>
                          </th>
                          <th className="w-20 py-1 pr-2 text-right">30日</th>
                          <th className="w-20 py-1 text-right">90日</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((entry) => (
                          <tr
                            key={`${entry.event}-${entry.label}`}
                            className="border-t border-zinc-100"
                          >
                            <td
                              className="max-w-0 truncate py-2 pr-2 text-zinc-900"
                              title={entry.label || undefined}
                            >
                              {entry.label || "（ラベルなし）"}
                            </td>
                            <td className="py-2 pr-2 text-right font-semibold tabular-nums text-zinc-900">
                              {entry.last30Days}
                            </td>
                            <td className="py-2 text-right tabular-nums text-zinc-500">{entry.last90Days}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                );
              })}
              {summary.truncated ? (
                <p className="text-xs text-zinc-500">
                  ※件数が多いため一部のみ集計しています。
                </p>
              ) : null}
            </>
          ) : (
            <p className="rounded-xl bg-zinc-50 p-3 text-xs leading-5 text-zinc-600">
              まだ計測データがありません。リンク集やコミッションページがクリックされると、ここに集計が表示されます。
            </p>
          )}
          <p className="text-xs leading-5 text-zinc-500">
            同じイベントは GA4 にも送信しています。ページ全体のアクセス数（表示回数・流入元など）は
            Google アナリティクスまたは Vercel Analytics で確認できます。
          </p>
        </div>
      ) : null}
    </section>
  );
}
