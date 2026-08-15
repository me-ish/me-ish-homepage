"use client";

// features/natori/components/dashboard/PageEventsPanel.tsx
// ダッシュボードのクリック解析パネル。リンク集・コミッションポートフォリオの
// クリック/送信イベント（自前計測）を 30日/90日 で集計表示する。
import { useEffect, useState } from "react";
import { BarChart3, ChevronDown, ChevronUp } from "lucide-react";
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
    <section className="mt-6 rounded-2xl border border-pink-100 bg-white shadow-sm">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 rounded-2xl p-3 text-left hover:bg-pink-50/40 sm:p-4"
      >
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-indigo-500 text-white">
            <BarChart3 className="h-4 w-4" aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-bold text-gray-900">
              クリック解析
              {state === "ready" ? (
                <span className="ml-2 text-xs font-medium text-gray-500">
                  直近30日 {total30}件
                </span>
              ) : null}
            </p>
            <p className="mt-0.5 text-xs text-gray-600">
              リンク集・コミッションページのクリックと依頼フォーム送信の回数です。
            </p>
          </div>
        </div>
        <span className="shrink-0 text-gray-500">
          {open ? <ChevronUp className="h-5 w-5" aria-hidden /> : <ChevronDown className="h-5 w-5" aria-hidden />}
        </span>
      </button>

      {open ? (
        <div className="space-y-4 border-t border-pink-100 px-3 pb-4 pt-3 sm:px-4">
          {state === "loading" ? (
            <div className="h-24 animate-pulse rounded-xl bg-pink-50/60" />
          ) : summary && summary.counts.length > 0 ? (
            <>
              {EVENT_META.map((meta) => {
                const rows = summary.counts.filter((entry) => entry.event === meta.event);
                if (rows.length === 0) return null;
                return (
                  <div key={meta.event}>
                    <p className="text-xs font-bold uppercase tracking-wide text-pink-700">
                      {meta.title}
                      {meta.hint ? (
                        <span className="ml-1.5 font-medium normal-case text-gray-400">
                          {meta.hint}
                        </span>
                      ) : null}
                    </p>
                    <table className="mt-1.5 w-full border-collapse text-sm">
                      <thead>
                        <tr className="text-left text-[11px] font-bold text-gray-500">
                          <th className="py-1 pr-2 font-bold"> </th>
                          <th className="w-20 py-1 pr-2 text-right">30日</th>
                          <th className="w-20 py-1 text-right">90日</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((entry) => (
                          <tr
                            key={`${entry.event}-${entry.label}`}
                            className="border-t border-pink-50"
                          >
                            <td className="max-w-0 truncate py-1.5 pr-2 text-gray-900">
                              {entry.label || "（ラベルなし）"}
                            </td>
                            <td className="py-1.5 pr-2 text-right font-bold text-gray-900">
                              {entry.last30Days}
                            </td>
                            <td className="py-1.5 text-right text-gray-500">{entry.last90Days}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                );
              })}
              {summary.truncated ? (
                <p className="text-[11px] text-gray-500">
                  ※件数が多いため一部のみ集計しています。
                </p>
              ) : null}
            </>
          ) : (
            <p className="rounded-xl border border-gray-200 bg-gray-50 p-3 text-xs text-gray-600">
              まだ計測データがありません。リンク集やコミッションページがクリックされると、ここに集計が表示されます。
            </p>
          )}
          <p className="text-[11px] leading-4 text-gray-400">
            同じイベントは GA4 にも送信しています。ページ全体のアクセス数（表示回数・流入元など）は
            Google アナリティクスまたは Vercel Analytics で確認できます。
          </p>
        </div>
      ) : null}
    </section>
  );
}
