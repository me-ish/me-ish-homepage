"use client";
import type { CaseSection, CaseWorkspaceRecord } from "../../types/caseWorkspace";
import { CASE_TASK_STAGE_LABELS as stages, caseKnown, caseMoney, caseTime, observationLabel } from "../../lib/caseWorkspacePresentation";
import { CASE_NOTICE_PURPOSES, caseNoticeLabel } from "../../lib/caseWorkspaceEntries";

import { CaseReconciliationPanel } from "./CaseReconciliationPanel";
import { CasePaymentPanel } from "./CasePaymentPanel";
function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="rounded-2xl border border-zinc-200 bg-white p-4 sm:p-5"><h3 className="mb-3 text-sm font-semibold text-zinc-600">{title}</h3>{children}</section>;
}
export function CaseWorkspaceSections({ record, section,application=false,readOnly=false,onChanged=()=>{},selectedNotificationId }: {selectedNotificationId?:string; record: CaseWorkspaceRecord; section: CaseSection;application?:boolean;readOnly?:boolean;onChanged?:()=>void }) {
  const { model: m, display: d } = record;
  const quote = caseKnown(m.facts.quote), payment = caseKnown(d.payment), delivery = caseKnown(m.facts.delivery);
  const receipt = caseKnown(d.receipt), tasks = caseKnown(d.tasks), conversation = caseKnown(d.conversation);
  const roughs = caseKnown(m.facts.roughs);
  if (section === "consultation") return <div className="space-y-4">
    <Card title="相談">{conversation ? <><p className="font-semibold">最後に書いた人：{conversation.latestSender === "client" ? "お客さん" : "あなた"}</p>
      <p className="mt-2 text-sm text-zinc-600">{caseTime(conversation.latestAt)}</p></>
      : <p>{observationLabel(d.conversation)}</p>}</Card>
    {!application?<p className="rounded-xl bg-zinc-100 p-4 text-sm text-zinc-600">会話本文・返信の入力と送信は、この表示確認用画面には接続していません。</p>:null}
  </div>;
  if (section === "transaction") return <div className="space-y-4">
    <div className="grid gap-4 sm:grid-cols-2"><Card title="見積">{quote ? <><p className="font-semibold">第{quote.version}版 · {caseMoney(quote.money)}</p>
      <p className="mt-2 text-sm">{m.agreement === "accepted" ? `OKをもらった日時：${caseTime(quote.acceptance!.acceptedAt)}` : m.agreement === "needs_review" ? "要確認：見積とOKの内容が合っているか確認してください" : "まだOKをもらっていません"}</p></>
      : <p>{observationLabel(m.facts.quote, "見積はまだありません")}</p>}</Card>
      <Card title="入金">{payment ? <><p className="font-semibold">{caseMoney(payment.money)} · 入金済み</p><p className="mt-2 text-sm">{caseTime(payment.confirmedAt)}</p>
        <p className="mt-2 text-sm text-zinc-600">{payment.method === "manual" ? "手入力の入金" : payment.method === "stripe" ? "カード決済（Stripe）" : "旧方式の入金"}</p></>
        : <p>{observationLabel(m.facts.payment, "まだ入金はありません")}</p>}</Card></div>
    <Card title="支払いリンクとメール"><p>{caseKnown(m.facts.link) ? "支払いリンクは作成済みです。メールが届いたかは下で確認できます。" : observationLabel(m.facts.link,"支払いリンクはまだ作っていません")}</p>
      <div className="mt-4 border-t border-zinc-100 pt-4"><NotificationRows record={record} /></div></Card>
    {application&&!readOnly?<CaseReconciliationPanel selectedNotificationId={selectedNotificationId} key={`reconciliation-${record.id}`} projectId={record.id} onChanged={onChanged}/>:null}
    {application&&!readOnly?<CasePaymentPanel key={record.id} projectId={record.id} onChanged={onChanged}/>:<p className="rounded-xl bg-pink-50 p-4 text-sm text-pink-950">{readOnly?"照会のみの画面です。送信・発行・外部照合・解決の保存は停止しています。":"見積の発行・入金登録・支払案内の送信は未接続です。この画面で請求や送信は行われません。"}</p>}
  </div>;
  if (section === "production") return <div className="space-y-4">
    <Card title="制作の工程">{tasks ? <><p className="mb-3 text-sm text-zinc-600">{tasks.filter(t => t.done).length}/{tasks.length}工程 完了</p>
      <ul className="divide-y divide-zinc-100">{tasks.map(task => <li key={task.id} className="flex items-center justify-between gap-3 py-3"><span>{stages[task.stage]}</span><span className={task.done ? "text-emerald-800" : "text-zinc-600"}>{task.done ? "完了" : "まだ"}</span></li>)}</ul></>
      : <p>{observationLabel(d.tasks, "工程はまだ登録されていません")}</p>}</Card>
    <Card title="ラフの確認">{roughs?.length ? <ul className="space-y-3">{roughs.map((rough,index) => <li key={rough.id}>ラフ{index+1}：{rough.clientOkAt ? `お客さんOK · ${rough.acknowledgedAt ? "確認済み" : "まだ確認していません"}` : "お客さんの返事待ち"}</li>)}</ul>
      : <p>{observationLabel(m.facts.roughs, "ラフはまだ出していません")}</p>}</Card>
    <Card title="納品と受取">{delivery ? <><p className="font-semibold">納品済み</p><p className="mt-2 text-sm">納品ページの期限：{delivery.expiresAt ? caseTime(delivery.expiresAt) : "未確認"}</p>
      <p className="mt-2 text-sm text-zinc-600">{delivery.manifest === "verified" ? "納品ファイルの記録は確認済み（今もダウンロードできるかは未確認）" : "要確認：納品ファイルの確認情報が足りません"}</p></>
      : <p>{observationLabel(m.facts.delivery, "まだ納品していません")}</p>}
      <p className="mt-4 border-t border-zinc-100 pt-4">{receipt ? `受け取り：${caseTime(receipt.acceptedAt)}${receipt.correspondence === "unconfirmed" ? "（要確認：どの納品に対するものか未確認）" : ""}` : observationLabel(d.receipt,"お客さんはまだ受け取っていません")}</p></Card>
    {!application?<p className="text-sm text-zinc-600">タスク編集・ファイル取得・納品発行・期限延長は未接続です。</p>:null}
  </div>;
  if (section === "history") return <div className="space-y-4">
    <Card title="これまでの流れ"><ol className="space-y-4 border-l-2 border-pink-100 pl-4">
      {quote?.acceptance ? <li><p className="font-semibold">{m.agreement === "accepted" ? `見積（${quote.version}回目）にOK` : "OKの記録（要確認：見積との対応が未確認）"}</p><p className="text-sm text-zinc-600">{caseTime(quote.acceptance.acceptedAt)} · {caseMoney(quote.acceptance.money)}</p></li> : null}
      {payment ? <li><p className="font-semibold">入金</p><p className="text-sm text-zinc-600">{caseTime(payment.confirmedAt)} · {caseMoney(payment.money)}</p></li> : null}
      {delivery ? <li><p className="font-semibold">納品</p><p className="text-sm text-zinc-600">{caseTime(delivery.recordedAt)}</p></li> : null}
      {receipt ? <li><p className="font-semibold">受け取り</p><p className="text-sm text-zinc-600">{caseTime(receipt.acceptedAt)} · {receipt.correspondence === "matched" ? "納品と一致" : "要確認：どの納品に対するものか未確認"}</p></li> : null}
      {!quote?.acceptance && !payment && !delivery && !receipt ? <li>まだ見積のOK・入金・納品はありません。</li> : null}
    </ol></Card><Card title="送ったメール"><NotificationRows record={record} /></Card>
    <Card title="保存・送信の処理">{caseKnown(m.facts.operations)?.length ? <ul className="space-y-2">{caseKnown(m.facts.operations)!.map((operation,index) => <li key={operation.id}>処理{index+1}：{operation.state === "succeeded" ? "完了" : operation.state === "unknown" ? "要確認：結果が分かりません" : "要確認：結果を確認してください"}</li>)}</ul>
      : <p>{observationLabel(m.facts.operations,"途中の処理はありません")}</p>}</Card>
  </div>;
  return <div className="grid gap-4 sm:grid-cols-2">
    <Card title="決まったこと"><p className="font-semibold">{quote?.acceptance ? m.agreement === "accepted" ? `${caseMoney(quote.acceptance.money)}でOK（${quote.version}回目の見積）` : `${caseMoney(quote.acceptance.money)}でOK（要確認：見積との対応が未確認）` : "まだ見積のOKはもらっていません"}</p>
      <p className="mt-3 text-sm text-zinc-600">納期の目安：{record.registeredDueDate??"未登録"}{record.registeredDueDate?"（登録した日付です。お客さんと約束した日とは限りません）":""}</p></Card>
    <Card title="制作"><p className="font-semibold">{tasks ? `${tasks.length}工程中${tasks.filter(task=>task.done).length}工程 完了` : observationLabel(d.tasks, "工程はまだ登録されていません")}</p></Card>
        {readOnly||!application?<Card title="この画面でできること"><p className="text-sm leading-7">{readOnly?"いまは見るだけです。送信や状態を変える操作は止めています。":"返信、保存、見積・支払い案内・納品の発行は未接続です。"}</p></Card>:null}
  </div>;
}

function NotificationRows({ record }: { record: CaseWorkspaceRecord }) {
  const observation=record.model.facts.notifications, rows=caseKnown(observation);
  return rows?.length ? <ul className="space-y-3">{rows.map((row,index) => <li key={row.id} className="text-sm">
    <p className="font-semibold">案内{index+1} · {CASE_NOTICE_PURPOSES[row.purpose]} · {caseNoticeLabel(row)}</p>
    <p className="mt-1 text-zinc-600">{caseTime(row.recordedAt)} · {row.attemptNo > 1 ? `${row.attemptNo}回目 · ` : ""}{row.sentAt ? "送信済み" : ""}</p>
  </li>)}</ul> : <p className="text-sm text-zinc-600">{observationLabel(observation, "まだメールは送っていません")}</p>;
}
