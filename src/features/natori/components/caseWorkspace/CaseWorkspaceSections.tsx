"use client";
import type { ReactNode } from "react";
import type { CaseSection, CaseWorkspaceRecord } from "../../types/caseWorkspace";
import type { CaseStepKey } from "../../lib/caseSteps";
import { CASE_TASK_STAGE_LABELS as stages, caseDate, caseKnown, caseMoney, caseTime, observationLabel } from "../../lib/caseWorkspacePresentation";
import { CASE_NOTICE_PURPOSES, caseNoticeLabel } from "../../lib/caseWorkspaceEntries";

import { CaseReconciliationPanel } from "./CaseReconciliationPanel";
import { CasePaymentPanel } from "./CasePaymentPanel";
function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="rounded-2xl border border-zinc-200 bg-white p-4 sm:p-5"><h3 className="mb-3 text-sm font-semibold text-zinc-600">{title}</h3>{children}</section>;
}
/** Label/value lines at the top of the open step, as in the step-view mock. */
function Rows({ rows }: { rows: [string, ReactNode][] }) {
  return <dl className="mb-4">{rows.map(([label, value]) => <div key={label} className="flex items-baseline justify-between gap-3 border-b border-dashed border-zinc-200 py-2.5 text-sm">
    <dt className="shrink-0 text-zinc-600">{label}</dt><dd className="min-w-0 text-right font-semibold">{value}</dd></div>)}</dl>;
}
function Records({ title, children }: { title: string; children: ReactNode }) {
  return <details className="rounded-2xl border border-zinc-200 bg-zinc-50"><summary className="cursor-pointer rounded-2xl px-4 py-3 text-sm font-semibold text-zinc-700">{title}</summary><div className="space-y-4 p-3 pt-0">{children}</div></details>;
}
export function CaseWorkspaceSections({ record, section,step=null,application=false,readOnly=false,onChanged=()=>{},selectedNotificationId }: {selectedNotificationId?:string; record: CaseWorkspaceRecord; section: CaseSection;step?:CaseStepKey|null;application?:boolean;readOnly?:boolean;onChanged?:()=>void }) {
  const { model: m, display: d } = record;
  const quote = caseKnown(m.facts.quote), payment = caseKnown(d.payment), delivery = caseKnown(m.facts.delivery);
  const receipt = caseKnown(d.receipt), tasks = caseKnown(d.tasks), conversation = caseKnown(d.conversation);
  const roughs = caseKnown(m.facts.roughs);
  if (section === "consultation") return <div className="space-y-4">
    <Card title="相談">{conversation ? <><p className="font-semibold">最後に書いた人：{conversation.latestSender === "client" ? "お客さん" : "あなた"}</p>
      <p className="mt-2 text-sm text-zinc-600">{caseTime(conversation.latestAt)}</p></>
      : <p>{observationLabel(d.conversation)}</p>}</Card>
    {!application?<p className="rounded-xl bg-zinc-100 p-4 text-sm text-zinc-600">見本の画面なので、返信は送れません。</p>:null}
  </div>;
  const agreed = quote?.acceptance && m.agreement === "accepted" ? quote.acceptance : null;
  const quoteReply = m.agreement === "accepted" ? `OK · ${caseTime(quote!.acceptance!.acceptedAt)}` : m.agreement === "needs_review" ? "要確認" : "まだ";
  if (section === "transaction") return <div className="space-y-4">
    {step === "quote" ? <Rows rows={[["見積", quote ? `第${quote.version}版` : observationLabel(m.facts.quote, "まだありません")], ["金額", quote ? caseMoney(quote.money) : "—"], ["お客さんの返事", quote ? quoteReply : "—"]]} />
      : <Rows rows={[["金額", agreed ? caseMoney(agreed.money) : quote ? `${caseMoney(quote.money)}（OK前）` : "—"], ["宛先", `${record.clientLabel}さん（登録メール）`],
        ["入金", payment ? `入金済み · ${caseTime(payment.confirmedAt)}` : "まだ"], ["支払いリンク", caseKnown(m.facts.link) ? "作成済み" : observationLabel(m.facts.link, "まだ")]]} />}
    {application&&!readOnly?<CaseReconciliationPanel selectedNotificationId={selectedNotificationId} key={`reconciliation-${record.id}`} projectId={record.id} onChanged={onChanged}/>:null}
    {application&&!readOnly?<CasePaymentPanel key={record.id} projectId={record.id} onChanged={onChanged}/>:<p className="rounded-xl bg-pink-50 p-4 text-sm text-pink-950">{readOnly?"いまは見るだけなので、支払いリンクは送れません。":"見本の画面なので、見積や支払いリンクは送れません。"}</p>}
    <Records title="見積・入金・メールの記録">
    <div className="grid gap-4 sm:grid-cols-2"><Card title="見積">{quote ? <><p className="font-semibold">第{quote.version}版 · {caseMoney(quote.money)}</p>
      <p className="mt-2 text-sm">{m.agreement === "accepted" ? `OKをもらった日時：${caseTime(quote.acceptance!.acceptedAt)}` : m.agreement === "needs_review" ? "要確認：OKの内容がこの見積と合っているか見てください" : "まだOKをもらっていません"}</p></>
      : <p>{observationLabel(m.facts.quote, "見積はまだありません")}</p>}</Card>
      <Card title="入金">{payment ? <><p className="font-semibold">{caseMoney(payment.money)} · 入金済み</p><p className="mt-2 text-sm">{caseTime(payment.confirmedAt)}</p>
        <p className="mt-2 text-sm text-zinc-600">{payment.method === "manual" ? "あなたが記録した入金" : payment.method === "stripe" ? "カード決済（Stripe）" : "以前の方法での入金"}</p></>
        : <p>{observationLabel(m.facts.payment, "まだ入金はありません")}</p>}</Card></div>
    <Card title="支払いリンクとメール"><p>{caseKnown(m.facts.link) ? "支払いリンクは作ってあります。送ったメールは下にあります。" : observationLabel(m.facts.link,"支払いリンクはまだ作っていません")}</p>
      <div className="mt-4 border-t border-zinc-100 pt-4"><NotificationRows record={record} /></div></Card>
    </Records>
  </div>;
  const deliveryRows: [string, ReactNode][] = [["納品", delivery ? `納品済み · ${caseTime(delivery.recordedAt)}` : observationLabel(m.facts.delivery, "まだ")],
    ["納品ページの期限", delivery?.expiresAt ? caseTime(delivery.expiresAt) : "—"], ["受け取り", receipt ? caseTime(receipt.acceptedAt) : observationLabel(d.receipt, "まだ")]];
  if (section === "production") return <div className="space-y-4">
    {step === "delivery" || step === "receipt" ? <Rows rows={deliveryRows} /> : <>
      {roughs?.length ? <Rows rows={roughs.map((rough, index): [string, ReactNode] => [`ラフ${index + 1}`, rough.clientOkAt ? `お客さんOK · ${caseTime(rough.clientOkAt)}${rough.acknowledgedAt ? "（確認済み）" : ""}` : "お客さんの返事待ち"])} />
        : <p className="mb-4 text-sm text-zinc-600">{observationLabel(m.facts.roughs, "ラフはまだ出していません")}</p>}
      <div className="mb-2"><p className="mb-2 text-sm font-semibold">工程{tasks?.length ? <span className="ml-2 font-normal text-zinc-500">{tasks.filter(t => t.done).length}/{tasks.length} 完了</span> : null}</p>
        {tasks?.length ? <ul aria-label="制作の工程" className="flex flex-wrap gap-2">{tasks.map(task => <li key={task.id} className={`rounded-xl border px-3 py-2 text-sm ${task.done ? "border-zinc-900 bg-zinc-900 text-white" : "border-zinc-200 bg-white text-zinc-700"}`}>{task.done ? "✓ " : ""}{stages[task.stage]}<span className="sr-only">{task.done ? "（完了）" : "（まだ）"}</span></li>)}</ul>
          : <p className="text-sm text-zinc-600">{observationLabel(d.tasks, "工程はまだ登録されていません")}</p>}</div>
    </>}
    <Records title="ラフ・納品・受取の記録">
    <Card title="ラフ">{roughs?.length ? <ul className="space-y-3">{roughs.map((rough,index) => <li key={rough.id}>ラフ{index+1}：{rough.clientOkAt ? `お客さんOK · ${rough.acknowledgedAt ? "確認済み" : "まだ確認していません"}` : "お客さんの返事待ち"}</li>)}</ul>
      : <p>{observationLabel(m.facts.roughs, "ラフはまだ出していません")}</p>}</Card>
    <Card title="納品と受取">{delivery ? <><p className="font-semibold">納品済み</p><p className="mt-2 text-sm">納品ページの期限：{delivery.expiresAt ? caseTime(delivery.expiresAt) : "—"}</p>
      <p className="mt-2 text-sm text-zinc-600">{delivery.manifest === "verified" ? "納品ファイルはそろっています" : "要確認：納品ファイルの記録が足りません"}</p></>
      : <p>{observationLabel(m.facts.delivery, "まだ納品していません")}</p>}
      <p className="mt-4 border-t border-zinc-100 pt-4">{receipt ? `受け取り：${caseTime(receipt.acceptedAt)}${receipt.correspondence === "unconfirmed" ? "（要確認：どの納品の受け取りか分かりません）" : ""}` : observationLabel(d.receipt,"お客さんはまだ受け取っていません")}</p></Card>
    </Records>
    {!application?<p className="text-sm text-zinc-600">見本の画面なので、工程の変更や納品はできません。</p>:null}
  </div>;
  if (section === "history") return <div className="space-y-4">
    <Card title="これまでの流れ"><ol className="space-y-4 border-l-2 border-pink-100 pl-4">
      {quote?.acceptance ? <li><p className="font-semibold">{m.agreement === "accepted" ? `見積（${quote.version}回目）にOK` : "OKの記録（要確認：どの見積へのOKか分かりません）"}</p><p className="text-sm text-zinc-600">{caseTime(quote.acceptance.acceptedAt)} · {caseMoney(quote.acceptance.money)}</p></li> : null}
      {payment ? <li><p className="font-semibold">入金</p><p className="text-sm text-zinc-600">{caseTime(payment.confirmedAt)} · {caseMoney(payment.money)}</p></li> : null}
      {delivery ? <li><p className="font-semibold">納品</p><p className="text-sm text-zinc-600">{caseTime(delivery.recordedAt)}</p></li> : null}
      {receipt ? <li><p className="font-semibold">受け取り</p><p className="text-sm text-zinc-600">{caseTime(receipt.acceptedAt)} · {receipt.correspondence === "matched" ? "納品と一致" : "要確認：どの納品の受け取りか分かりません"}</p></li> : null}
      {!quote?.acceptance && !payment && !delivery && !receipt ? <li>まだ記録はありません。</li> : null}
    </ol></Card><Card title="送ったメール"><NotificationRows record={record} /></Card>
    <Card title="送信や保存の処理">{caseKnown(m.facts.operations)?.length ? <ul className="space-y-2">{caseKnown(m.facts.operations)!.map((operation,index) => <li key={operation.id}>処理{index+1}：{operation.state === "succeeded" ? "完了" : operation.state === "unknown" ? "要確認：結果が分かりません" : "要確認：うまくいかなかったかもしれません"}</li>)}</ul>
      : <p>{observationLabel(m.facts.operations,"途中の処理はありません")}</p>}</Card>
  </div>;
  return <div className="grid gap-4 sm:grid-cols-2">
    <Card title="決まったこと"><p className="font-semibold">{quote?.acceptance ? m.agreement === "accepted" ? `${caseMoney(quote.acceptance.money)}でOK（${quote.version}回目の見積）` : `${caseMoney(quote.acceptance.money)}でOK（要確認：どの見積へのOKか分かりません）` : "まだ見積のOKはもらっていません"}</p>
      <p className="mt-3 text-sm text-zinc-600">納期：{record.registeredDueDate?caseDate(record.registeredDueDate):"なし"}</p></Card>
    <Card title="制作"><p className="font-semibold">{tasks ? `${tasks.length}工程中${tasks.filter(task=>task.done).length}工程 完了` : observationLabel(d.tasks, "工程はまだ登録されていません")}</p></Card>
        {!application?<Card title="この画面でできること"><p className="text-sm leading-7">見本の画面なので、送信や保存はできません。</p></Card>:null}
  </div>;
}

function NotificationRows({ record }: { record: CaseWorkspaceRecord }) {
  const observation=record.model.facts.notifications, rows=caseKnown(observation);
  return rows?.length ? <ul className="space-y-3">{rows.map((row,index) => <li key={row.id} className="text-sm">
    <p className="font-semibold">案内{index+1} · {CASE_NOTICE_PURPOSES[row.purpose]} · {caseNoticeLabel(row)}</p>
    <p className="mt-1 text-zinc-600">{caseTime(row.recordedAt)} · {row.attemptNo > 1 ? `${row.attemptNo}回目 · ` : ""}{row.sentAt ? "送信済み" : ""}</p>
  </li>)}</ul> : <p className="text-sm text-zinc-600">{observationLabel(observation, "まだメールは送っていません")}</p>;
}
