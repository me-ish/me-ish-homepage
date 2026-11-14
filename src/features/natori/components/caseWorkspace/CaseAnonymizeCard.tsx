"use client";
// 案件の依頼者情報の匿名化。完了・見送りから 90 日で自動で行われ、ここから「今すぐ」もできる。
// 取り消せないので、ボタンを押したあとに中身を見せて、もう一度押してもらう。
import { useEffect, useState } from "react";
import { anonymizeCaseNow, loadCaseAnonymization } from "../../data/supabaseCaseAnonymization";
import { NATORI_ANONYMIZE_AFTER_DAYS, type CaseAnonymizationStatus } from "../../lib/caseAnonymization";
import { caseTime } from "../../lib/caseWorkspacePresentation";
import { natoriAdminUi as ui } from "../../constants/adminUi";

export function CaseAnonymizeCard({ projectId, refreshKey, onChanged }: { projectId: string; refreshKey: string; onChanged: () => void }) {
  const [status, setStatus] = useState<CaseAnonymizationStatus | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  useEffect(() => {
    let live = true;
    setConfirming(false);
    void loadCaseAnonymization(projectId).then((s) => { if (live) setStatus(s); });
    return () => { live = false; };
  }, [projectId, refreshKey]);
  if (!status) return null;
  if (status.state === "done")
    return (
      <div className="space-y-1 text-sm">
        <p className="font-bold">依頼者の情報は匿名化済みです（{status.label}）</p>
        <p>{caseTime(status.anonymizedAt)} に、名前・メールアドレス・依頼文・相談のやりとりを消しました。金額と日付、見積と支払い案内の控えは残しています。</p>
        {status.filesRemoved ? null : <p role="status">添付ファイルの削除が残っています。毎日の処理で消し直します。</p>}
      </div>
    );
  if (!status.eligible)
    return <p className="text-sm">完了か見送りにすると、{NATORI_ANONYMIZE_AFTER_DAYS} 日後に依頼者の情報を自動で匿名化します。</p>;
  const run = async () => {
    setBusy(true); setMessage("");
    const result = await anonymizeCaseNow(projectId);
    setBusy(false);
    if (result.kind === "error") { setMessage(result.message); return; }
    setConfirming(false);
    setStatus(await loadCaseAnonymization(projectId));
    onChanged();
  };
  return (
    <div className="space-y-2 text-sm">
      <p>{status.scheduledFrom} ごろ、依頼者の情報を自動で匿名化します。</p>
      {confirming ? (
        <div role="group" aria-label="匿名化の確認" className="space-y-2">
          <p className="font-bold">元に戻せません。次のものを消します。</p>
          <ul className="list-disc pl-5">
            <li>名前（受付番号に置き換えます）とメールアドレス</li>
            <li>依頼文の自由記入、メモ、参考リンク</li>
            <li>相談ページのやりとりと添付ファイル、参考画像、納品データ</li>
          </ul>
          <p>金額・入金・日付、見積と支払い案内の控え、品目と公開条件、振り返り用の記録は残ります。</p>
          <div className="flex flex-wrap gap-2">
            <button className={ui.btnDanger} disabled={busy} onClick={() => void run()}>
              {busy ? "匿名化しています…" : "匿名化する"}
            </button>
            <button className={ui.btnSecondary} disabled={busy} onClick={() => setConfirming(false)}>やめる</button>
          </div>
        </div>
      ) : (
        <button className={ui.btnSecondary} onClick={() => { setMessage(""); setConfirming(true); }}>
          今すぐ匿名化する（前に内容を表示）
        </button>
      )}
      {message ? <p role="alert">{message}</p> : null}
    </div>
  );
}
