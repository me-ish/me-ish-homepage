"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { evidenceCanApply, type ReconciliationKind, type ReconciliationView } from "../../lib/caseReconciliation";
import { postReconciliation, readReconciliation, ReconciliationReadError } from "../../data/supabaseCaseReconciliation";

const labels: Record<ReconciliationKind, string> = { price: "価格", link: "支払リンク", mail: "メール受付", payment: "入金", stop: "旧リンク停止" };
type Confirmation = { kind: "apply"; job: ReconciliationView["jobs"][number]; resolutionId: string } | { kind: "stop"; target: string };
export function CaseReconciliationPanel({ projectId, onChanged,selectedNotificationId }: {selectedNotificationId?:string; projectId: string; onChanged: () => void }) {
  const [view, setView] = useState<ReconciliationView | null>(null), [error, setError] = useState(""), [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false), [confirmation, setConfirmation] = useState<Confirmation | null>(null), [checked, setChecked] = useState(false);
  const inFlight = useRef(false), uncertain = useRef(false);
  const selectionKey = `${projectId}/${selectedNotificationId ?? "all"}`;
  const currentSelection = useRef(selectionKey), generation = useRef(0);
  currentSelection.current = selectionKey;
  const refresh = useCallback(async (signal?: AbortSignal) => {
    if (currentSelection.current !== selectionKey) return;
    const request = ++generation.current;
    const current = () => !signal?.aborted && request === generation.current && currentSelection.current === selectionKey;
    try {
      const value = await readReconciliation(projectId,signal,selectedNotificationId);
      if (current()) { setView(value); setError(""); }
    } catch (e) {
      if (current()) { setView(null); setConfirmation(null); setError(e instanceof Error ? e.message : "記録を確認できません。"); }
    }
  }, [projectId,selectedNotificationId,selectionKey]);
  const invalidate=useCallback(()=>{generation.current++;},[]);
  useEffect(() => {
    setView(null);setConfirmation(null);setChecked(false);setMessage("");setError("");
    const controller = new AbortController();
    void refresh(controller.signal);
    return () => {invalidate();controller.abort();};
  }, [refresh,invalidate]);
  async function execute(command: object) {
    if (inFlight.current || uncertain.current) return;
    inFlight.current = true; setBusy(true); setError("");
    try {
      const result = await postReconciliation(command);
      if (currentSelection.current !== selectionKey) return;
      setMessage(result === "applied" ? "照合結果を保存しました。送信・再発行は別の確認操作です。" : result === "saved" || result === "existing" ? "照合の記録を取得しました。根拠を確認してください。" : "状態が変わったか、証拠が不足しています。要確認と再実行停止を保っています。");
      setConfirmation(null); await refresh(); onChanged();
    } catch (e) {
      uncertain.current = true;
      setConfirmation(null); if (currentSelection.current === selectionKey) setError(e instanceof Error ? e.message : "結果は未確認です。");
      if (e instanceof ReconciliationReadError && e.unauthorized) setView(null);
    } finally { inFlight.current = false; setBusy(false); }
  }
  const inspect = (kind: ReconciliationKind, target: string) => view && execute({ action: "inspect", projectId, id: crypto.randomUUID(), kind, target, revision: view.revision });
  function open(c: Confirmation) { setChecked(false); setConfirmation(c); }
  return <section aria-label="結果不明の照合" className="space-y-4 rounded-2xl border border-zinc-200 bg-white p-4 sm:p-5">
    <h3 className="font-semibold">結果不明の照合・解決</h3>
    <p className="text-sm text-zinc-600">価格・リンク・メール受付・入金を別々に確認します。「見つからない」だけでは未実行と判断せず、再実行の停止を保ちます。</p>
    <button type="button" disabled={busy} className="rounded-lg border px-3 py-2 text-sm" onClick={() => { void refresh(); }}>現在の記録を照会</button>
    {message ? <p role="status" className="text-sm">{message}</p> : null}
    {error ? <p role="alert" className="text-sm text-red-800">{error}</p> : null}
    {uncertain.current ? <p className="text-sm text-amber-900">応答が未確認のため、この画面では追加実行を停止しています。現在の記録と履歴を確認してください。</p> : null}
    {view&&(selectedNotificationId?view.selectedNotice===selectedNotificationId:!view.selectedNotice) ? <>
      {selectedNotificationId?<p className="text-sm">選択した通知ID：{selectedNotificationId}。この通知の照合入口です。別用途や他の未解決を解除しません。</p>:null}
      {view.operations.length > 100 || view.notifications.length > 100 || view.jobs.length > 100 ? <p>取得上限に達しました。全件確認できるまで解除できません。</p> : null}
      <ul className="space-y-4">{view.operations.slice(0,100).map((o,index) => <li key={o.id} className="rounded-xl bg-zinc-50 p-3 text-sm">
        <p className="font-semibold">リンク処理 {index+1} · {o.reconciliation_id ? "照合解決の記録あり（旧処理の再開は停止）" : o.status === "pending" ? "処理結果の確認が必要" : "保存結果の記録あり"}</p>
        <p className="break-all text-xs text-zinc-500">対象操作：{o.id}</p>
        <div className="mt-3 flex flex-wrap gap-2">{(["price","link","payment","stop"] as const).map(kind => <button key={kind} type="button" className="rounded-lg border bg-white px-3 py-2" disabled={busy || uncertain.current} onClick={() => void inspect(kind,o.id)}>{kind === "stop" ? "停止結果を外部照合" : `${labels[kind]}を外部照合`}</button>)}
          <button type="button" className="rounded-lg border bg-white px-3 py-2" disabled={busy || uncertain.current} onClick={() => open({kind:"stop",target:o.id})}>旧リンク停止を確認</button></div>
      </li>)}</ul>
      {view.notifications.filter(n => n.status === "unknown" || n.status === "sending").slice(0,100).map(n => <div key={n.id} className="text-sm"><p>{n.purpose} · 試行{n.attempt_no} · 受付結果は未確認</p><button type="button" disabled={busy || uncertain.current} className="mt-2 rounded-lg border px-3 py-2" onClick={() => void inspect("mail",n.id)}>メール受付を外部照合</button></div>)}
      {view.mailEvents.length ? <div className="space-y-2 text-sm" aria-label="署名通知の記録"><p>署名通知：送信受付・到達・問題を分けて表示します。到達は既読や受取の証拠ではありません。</p>{view.mailEvents.slice(0,100).map((e,index)=><p key={index}>{({"email.sent":"送信受付","email.delivered":"宛先サーバーへ到達","email.bounced":"配信失敗","email.complained":"苦情","email.failed":"受付失敗","email.delivery_delayed":"配信遅延"} as Record<string,string>)[e.event_type]??"未分類"} · {new Date(e.occurred_at).toLocaleString("ja-JP")}</p>)}</div> : null}
      <ol className="space-y-3">{view.jobs.slice(0,100).map(j => <li key={j.id} className="rounded-xl border p-3 text-sm">
        <p className="font-semibold">{labels[j.kind]} · {j.resolution_id ? "照合結果を保存済み" : j.facts?.state === "confirmed" ? "肯定証拠あり・保存前" : j.facts?.state === "mismatch" ? "対象が一致しません" : j.facts?.state === "unavailable" ? "取得できません" : "結果は未確認"}</p>
        <p>{new Date(j.created_at).toLocaleString("ja-JP")}</p>
        {j.facts ? <><p>取得元：{j.facts.source === "provider_webhook" ? "署名済み通知" : "外部照会"} · 取得範囲：{j.facts.complete ? "完了" : "不完全"} · {j.facts.limits.join(" / ") || "制限の記録なし"}</p><p className="break-all">参照：{j.facts.reference ?? "未確認"}</p><p>{j.facts.identity.account ?? "accountの記録なし"} · {j.facts.identity.mailEnvironment === "acceptance" ? "専用受入" : j.facts.identity.livemode === null ? "mode未確認" : j.facts.identity.livemode ? "live" : "test"} · {j.facts.identity.amount ?? "金額未確認"} JPY</p></> : <p>照合中または応答未確認。送信し直さず記録を照会してください。</p>}
        {j.facts && !j.resolution_id && evidenceCanApply(j.kind,j.facts) ? <button type="button" disabled={busy || uncertain.current} className="mt-3 rounded-lg border px-3 py-2" onClick={() => open({kind:"apply",job:j,resolutionId:crypto.randomUUID()})}>照合結果の保存内容を確認</button> : null}
      </li>)}</ol>
      {!view.operations.length && !view.notifications.length ? <p className="text-sm">照合対象の処理記録はありません。</p> : null}
    </> : null}
    {confirmation && view ? <div role="dialog" aria-modal="true" aria-label="照合操作の確認" className="space-y-3 rounded-xl border-2 border-pink-200 bg-pink-50 p-4">
      <h4 className="font-semibold">{confirmation.kind === "apply" ? "照合結果の保存確認" : "旧リンク停止の確認"}</h4>
      <p className="break-all text-sm">案件：{projectId} / 対象：{confirmation.kind === "apply" ? confirmation.job.target_id : confirmation.target}</p>
      {confirmation.kind === "apply" ? <><p>{labels[confirmation.job.kind]}の肯定証拠を正本に反映します。他の不明点は残ります。</p><p className="break-all text-sm">根拠：{confirmation.job.facts?.reference} · {confirmation.job.facts?.checkedAt}</p><p>旧処理・消去済み本文は復活させません。メール送信・新規発行は行いません。</p></> : <p>既存Sessionを含めて停止結果を照合します。リンク無効化だけでは解決しません。停止と結果保存、新規発行は別操作です。専用受入環境でのみ接続を許可します。</p>}
      <label className="flex gap-2 text-sm"><input type="checkbox" checked={checked} onChange={e => setChecked(e.target.checked)} />対象と根拠、残る未確認事項を確認しました</label>
      <div className="flex flex-wrap gap-3"><button type="button" className="rounded-lg bg-pink-700 px-3 py-2 text-white" disabled={!checked || busy || uncertain.current} onClick={() => void execute(confirmation.kind === "apply" ? {action:"apply-evidence",projectId,id:confirmation.job.id,evidenceId:confirmation.job.evidence_id,resolutionId:confirmation.resolutionId,confirmed:true} : {action:"stop-old-link",projectId,id:crypto.randomUUID(),kind:"stop",target:confirmation.target,revision:view.revision,confirmed:true})}>{confirmation.kind === "apply" ? "照合結果を保存" : "確認した旧リンクを停止・照合"}</button><button type="button" disabled={busy} onClick={() => setConfirmation(null)}>閉じる</button></div>
    </div> : null}
  </section>;
}
