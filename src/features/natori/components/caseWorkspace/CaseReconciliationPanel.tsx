"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { evidenceCanApply, type ReconciliationKind, type ReconciliationView } from "../../lib/caseReconciliation";
import { postReconciliation, readReconciliation, ReconciliationReadError } from "../../data/supabaseCaseReconciliation";
import { workspaceLook as look } from "../../constants/workspaceLook";

const labels: Record<ReconciliationKind, string> = { price: "金額", link: "支払いリンク", mail: "メール", payment: "入金", stop: "古いリンクの停止" };
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
      if (current()) { setView(null); setConfirmation(null); setError(e instanceof Error ? e.message : "読み込めませんでした。"); }
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
      setMessage(result === "applied" ? "調べた結果を記録しました。" : result === "saved" || result === "existing" ? "調べました。下の結果を見てください。" : "はっきりしませんでした。要確認のままにしています。");
      setConfirmation(null); await refresh(); onChanged();
    } catch (e) {
      uncertain.current = true;
      setConfirmation(null); if (currentSelection.current === selectionKey) setError(e instanceof Error ? e.message : "うまくいったか分かりません。");
      if (e instanceof ReconciliationReadError && e.unauthorized) setView(null);
    } finally { inFlight.current = false; setBusy(false); }
  }
  const inspect = (kind: ReconciliationKind, target: string) => view && execute({ action: "inspect", projectId, id: crypto.randomUUID(), kind, target, revision: view.revision });
  function open(c: Confirmation) { setChecked(false); setConfirmation(c); }
  return <section aria-label="結果が分からない処理" className={`space-y-4 ${look.cardPadded}`}>
    <h3 className="font-semibold">結果が分からない処理を調べる</h3>
    <p className="text-sm text-zinc-600">Stripe やメールの送信サービスに問い合わせて、実際にどうなったかを調べます。分かるまで、同じ処理はやり直せません。</p>
    <button type="button" disabled={busy} className={look.btnSecondary} onClick={() => { void refresh(); }}>いまの記録を読み込む</button>
    {message ? <p role="status" className="text-sm">{message}</p> : null}
    {error ? <p role="alert" className="text-sm text-red-800">{error}</p> : null}
    {uncertain.current ? <p className="text-sm text-amber-900">結果が分からないので、ここでの操作を止めています。ページを読み込み直してください。</p> : null}
    {view&&(selectedNotificationId?view.selectedNotice===selectedNotificationId:!view.selectedNotice) ? <>
      {selectedNotificationId?<p className="text-sm">選んだメールについて調べます。</p>:null}
      {view.operations.length > 100 || view.notifications.length > 100 || view.jobs.length > 100 ? <p>件数が多すぎて全部は表示できません。</p> : null}
      <ul className="space-y-4">{view.operations.slice(0,100).map((o,index) => <li key={o.id} className={`${look.inset} text-sm`}>
        <p className="font-semibold">支払いリンクの処理 {index+1} · {o.reconciliation_id ? "調べ終わりました" : o.status === "pending" ? "結果が分かりません" : "記録があります"}</p>
        
        <div className="mt-3 flex flex-wrap gap-2">{(["price","link","payment","stop"] as const).map(kind => <button key={kind} type="button" className={look.btnSecondary} disabled={busy || uncertain.current} onClick={() => void inspect(kind,o.id)}>{kind === "stop" ? "止まったか調べる" : `${labels[kind]}を調べる`}</button>)}
          <button type="button" className={look.btnSecondary} disabled={busy || uncertain.current} onClick={() => open({kind:"stop",target:o.id})}>古いリンクを止める</button></div>
      </li>)}</ul>
      {view.notifications.filter(n => n.status === "unknown" || n.status === "sending").slice(0,100).map(n => <div key={n.id} className="text-sm"><p>{n.purpose} · {n.attempt_no}回目 · 送れたか分かりません</p><button type="button" disabled={busy || uncertain.current} className={`${look.btnSecondary} mt-2`} onClick={() => void inspect("mail",n.id)}>メールが送れたか調べる</button></div>)}
      {view.mailEvents.length ? <div className="space-y-2 text-sm" aria-label="送信サービスからの知らせ"><p>送信サービスからの知らせ：</p>{view.mailEvents.slice(0,100).map((e,index)=><p key={index}>{({"email.sent":"送信しました","email.delivered":"相手に届きました","email.bounced":"届きませんでした","email.complained":"迷惑メールとして報告されました","email.failed":"送れませんでした","email.delivery_delayed":"届くのが遅れています"} as Record<string,string>)[e.event_type]??"未分類"} · {new Date(e.occurred_at).toLocaleString("ja-JP")}</p>)}</div> : null}
      <ol className="space-y-3">{view.jobs.slice(0,100).map(j => <li key={j.id} className={`${look.inset} text-sm`}>
        <p className="font-semibold">{labels[j.kind]} · {j.resolution_id ? "記録しました" : j.facts?.state === "confirmed" ? "確かめられました（まだ記録していません）" : j.facts?.state === "mismatch" ? "内容が合いません" : j.facts?.state === "unavailable" ? "調べられませんでした" : "まだ分かりません"}</p>
        <p>{new Date(j.created_at).toLocaleString("ja-JP")}</p>
        {j.facts ? <><p>{j.facts.source === "provider_webhook" ? "送信サービスからの知らせ" : "問い合わせた結果"}{j.facts.complete ? "" : "（一部だけ）"}{j.facts.identity.amount !== null && j.facts.identity.amount !== undefined ? ` · ${j.facts.identity.amount.toLocaleString("ja-JP")}円` : ""}{j.facts.identity.livemode === false ? " · テスト環境" : ""}</p></> : <p>調べています。少し待ってから「いまの記録を読み込む」を押してください。</p>}
        {j.facts && !j.resolution_id && evidenceCanApply(j.kind,j.facts) ? <button type="button" disabled={busy || uncertain.current} className={`${look.btnSecondary} mt-3`} onClick={() => open({kind:"apply",job:j,resolutionId:crypto.randomUUID()})}>この結果を記録する</button> : null}
      </li>)}</ol>
      {!view.operations.length && !view.notifications.length ? <p className="text-sm">調べる処理はありません。</p> : null}
    </> : null}
    {confirmation && view ? <div role="dialog" aria-modal="true" aria-label="記録する前の確認" className={look.confirm}>
      <h4 className="font-semibold">{confirmation.kind === "apply" ? "この結果を記録しますか" : "古いリンクを止めますか"}</h4>
      
      {confirmation.kind === "apply" ? <><p>{labels[confirmation.job.kind]}について、調べた結果を案件の記録にします。メールは送りません。</p></> : <p>前に作った支払いリンクを使えなくして、止まったかを調べます。新しいリンクは作りません。</p>}
      <label className="flex gap-2 text-sm"><input type="checkbox" checked={checked} onChange={e => setChecked(e.target.checked)} />内容を見ました</label>
      <div className="flex flex-wrap gap-3"><button type="button" className={look.btnPrimary} disabled={!checked || busy || uncertain.current} onClick={() => void execute(confirmation.kind === "apply" ? {action:"apply-evidence",projectId,id:confirmation.job.id,evidenceId:confirmation.job.evidence_id,resolutionId:confirmation.resolutionId,confirmed:true} : {action:"stop-old-link",projectId,id:crypto.randomUUID(),kind:"stop",target:confirmation.target,revision:view.revision,confirmed:true})}>{confirmation.kind === "apply" ? "記録する" : "リンクを止める"}</button><button type="button" className={look.btnSecondary} disabled={busy} onClick={() => setConfirmation(null)}>やめる</button></div>
    </div> : null}
  </section>;
}
