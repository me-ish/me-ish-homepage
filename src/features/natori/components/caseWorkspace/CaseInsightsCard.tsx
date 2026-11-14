"use client";
// 案件の「あとで振り返るための記録」。依頼の経路と、見送ったときの理由を選んで残す。
// 選択肢の値だけを保存する（名前やメールアドレスは持たない）。選んだらすぐ保存する。
import { useEffect, useState } from "react";
import { loadCaseInsights, saveCaseInsights } from "../../data/supabaseCaseInsights";
import {
  CASE_CLOSE_REASONS, CASE_CLOSE_REASON_LABELS, CASE_SOURCES, CASE_SOURCE_LABELS,
  type CaseCloseReason, type CaseInsights, type CaseSource,
} from "../../lib/caseInsights";
import { natoriAdminUi as ui } from "../../constants/adminUi";
import { workspaceLook as look } from "../../constants/workspaceLook";

export function CaseInsightsCard({ projectId, closed, hidden, refreshKey }: {
  projectId: string;
  /** 見送った案件のときだけ、理由の欄を出す。 */
  closed: boolean;
  hidden: boolean;
  refreshKey: string;
}) {
  const [insights, setInsights] = useState<CaseInsights | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  useEffect(() => {
    let live = true;
    void loadCaseInsights(projectId).then((result) => {
      if (live) setInsights(result.kind === "ok" ? result.insights : null);
    });
    return () => { live = false; };
  }, [projectId, refreshKey]);
  // 読めないとき（表がまだ無いなど）は、欄ごと出さない。
  if (!insights) return null;
  const save = async (patch: Partial<CaseInsights>) => {
    setBusy(true); setMessage("");
    const result = await saveCaseInsights(projectId, patch);
    setBusy(false);
    if (result.kind === "ok") { setInsights(result.insights); setMessage("保存しました。"); } else setMessage(result.message);
  };
  return (
    <section hidden={hidden} className={`space-y-3 ${look.panel}`}>
      <h3 className={look.sectionTitle}>あとで振り返るための記録</h3>
      <label className="block text-sm">
        依頼の経路（どこから来た方か）
        <select
          className={ui.input}
          disabled={busy}
          value={insights.source ?? ""}
          onChange={(e) => void save({ source: (e.target.value || null) as CaseSource | null })}
        >
          <option value="">まだ選んでいない</option>
          {CASE_SOURCES.map((value) => (
            <option key={value} value={value}>{CASE_SOURCE_LABELS[value]}</option>
          ))}
        </select>
      </label>
      <label className="block text-sm">
        依頼の回数
        <select
          className={ui.input}
          disabled={busy}
          value={insights.repeatClient === null ? "" : insights.repeatClient ? "repeat" : "first"}
          onChange={(e) => void save({ repeatClient: e.target.value === "" ? null : e.target.value === "repeat" })}
        >
          <option value="">まだ選んでいない</option>
          <option value="first">はじめて</option>
          <option value="repeat">2 回目以降</option>
        </select>
        <span className="mt-1 block text-xs">同じメールアドレスの案件が残っているときは、自動で「2 回目以降」が入ります。</span>
      </label>
      {closed ? (
        <label className="block text-sm">
          見送りの理由
          <select
            className={ui.input}
            disabled={busy}
            value={insights.closeReason ?? ""}
            onChange={(e) => void save({ closeReason: (e.target.value || null) as CaseCloseReason | null })}
          >
            <option value="">まだ選んでいない</option>
            {CASE_CLOSE_REASONS.map((value) => (
              <option key={value} value={value}>{CASE_CLOSE_REASON_LABELS[value]}</option>
            ))}
          </select>
        </label>
      ) : null}
      <p role="status" className="min-h-5 text-xs">{message}</p>
    </section>
  );
}
