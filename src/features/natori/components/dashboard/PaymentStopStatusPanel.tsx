"use client";
import {useCallback,useEffect,useState} from "react";
import {RefreshCw} from "lucide-react";
import {natoriAdminUi} from "@/features/natori/constants/adminUi";
import {paymentStopStatusSchema,type PaymentStopStatus} from "@/features/natori/lib/paymentStopStatus";
const date=(value:string|null)=>value?new Date(value).toLocaleString("ja-JP",{timeZone:"Asia/Tokyo"}):"記録なし";
const labels={pending:"停止未完了",processing:"停止処理中・結果確認待ち",needs_review:"停止未確定・照合が必要"};
export default function PaymentStopStatusPanel(){
 const [data,setData]=useState<PaymentStopStatus|null>(null),[error,setError]=useState(""),[busy,setBusy]=useState(false),[notice,setNotice]=useState("");
 const read=useCallback(async()=>{
  const response=await fetch("/api/natori/admin/payment-stops",{cache:"no-store"});
  if(!response.ok)throw new Error("read_failed");
  return paymentStopStatusSchema.parse(await response.json());
 },[]);
 useEffect(()=>{let active=true;void read().then(next=>{if(active)setData(next);}).catch(()=>{if(active)setError("支払リンクの停止状況を確認できません。停止状況を更新してください。");});return()=>{active=false;};},[read]);
 const run=async(projectId?:string,jobId?:string)=>{
  if(busy)return;
  setBusy(true);setError("");setNotice("");
  try{
   if(projectId&&jobId){
    const response=await fetch("/api/natori/admin/payment-stops",{method:"POST",headers:{"Content-Type":"application/json","x-requested-with":"me-ish"},body:JSON.stringify({projectId,jobId})});
    if(response.ok)setNotice("指定した停止ジョブの完了を確認しました。");
    else setError("停止完了を確認できませんでした。処理中・期限変更・照合待ちの可能性があります。一覧を確認してください。");
   }
   setData(await read());
  }catch{setError("支払リンクの停止状況を確認できません。停止状況を更新してください。結果が不明な場合も、同じジョブで再試行できます。");}
  finally{setBusy(false);}
 };
 if(data?.enabled===false)return null;
 if(!data&&!error)return null;
 const view=data?.enabled?data:null;
 const last=view?.lastRun;
 const overdue=view&&(!last||Date.parse(view.checkedAt)-Date.parse(last.startedAt)>86400000);
 return <section aria-labelledby="payment-stop-heading" aria-busy={busy} className={`mt-6 rounded-2xl ${natoriAdminUi.surface} p-4 sm:p-5`}>
  <div className="flex flex-wrap items-center justify-between gap-3">
   <h2 id="payment-stop-heading" className="text-sm font-semibold text-zinc-900">支払リンクの停止状況</h2>
   <button type="button" disabled={busy} onClick={()=>void run()} className={natoriAdminUi.btnSecondary}><RefreshCw className="h-4 w-4" aria-hidden/>停止状況を更新</button>
  </div>
  <p className="mt-2 text-sm text-zinc-600">停止未完了のリンクがあると、再発行を待つ場合があります。再試行では指定した停止ジョブを確認し、新しいリンクの発行やメール送信は行いません。</p>
  {error&&<p role="alert" className={`${natoriAdminUi.alert.error} mt-3`}>{error}</p>}
  {notice&&<p role="status" className="mt-3 text-sm">{notice}</p>}
  {view&&<>
   <p className="mt-3 text-sm">停止未完了：{view.unresolved}件{view.oldestAt?` ／ 最も古い受付：${date(view.oldestAt)}`:""}</p>
   <p className="mt-1 text-xs text-zinc-600">定期実行の最終開始：{date(last?.startedAt??null)} ／ 最終終了：{date(view.lastCompletedAt)}</p>
   {overdue&&<p role="status" className={`${natoriAdminUi.alert.warning} mt-2`}>{last?"24時間以上、定期実行の開始記録がありません。":"定期実行の記録がまだありません。"}定期処理の実行状況を確認してください。</p>}
   {last&&(!last.finishedAt||last.outcome!=="ok")&&<p role="status" className={`${natoriAdminUi.alert.warning} mt-2`}>{!last.finishedAt?"最後の定期実行は処理中、または終了結果が未確認です。":"最後の定期実行に未完了または確認できない処理があります。"}停止未完了の一覧を確認してください。</p>}
   {view.unresolved>view.jobs.length&&<p className="mt-2 text-sm">古い順の先頭{view.jobs.length}件を表示しています。完了後に停止状況を更新してください。</p>}
   <ul className="mt-3 space-y-2">{view.jobs.map(job=><li key={job.id} className="rounded-xl border border-zinc-200 p-3 text-sm">
    <p className="break-words font-semibold">{job.title}</p><p>{labels[job.status]}</p><p className="mt-1 text-xs text-zinc-600">受付：{date(job.createdAt)}</p>
    <button type="button" className={`${natoriAdminUi.btnSecondary} mt-2`} disabled={busy||Boolean(error)||Boolean(job.leaseUntil&&Date.parse(job.leaseUntil)>Date.parse(view.checkedAt))} onClick={()=>void run(job.projectId,job.id)}>この停止ジョブを再試行</button>
   </li>)}</ul>
  </>}
 </section>;
}
