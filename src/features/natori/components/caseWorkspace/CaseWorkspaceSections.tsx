"use client";
import type { ReactNode } from "react";
import type { CaseOverviewPart, CaseSection, CaseWorkspaceRecord } from "../../types/caseWorkspace";
import { caseUsesExternalSteps, type CaseStepKey } from "../../lib/caseSteps";
import { CASE_TASK_STAGE_LABELS as stages, caseDate, caseKnown, caseMoney, caseQuoteDraftOnly, caseTime, observationLabel } from "../../lib/caseWorkspacePresentation";
import { CASE_NOTICE_PURPOSES, caseNoticeLabel } from "../../lib/caseWorkspaceEntries";

import { CaseReconciliationPanel } from "./CaseReconciliationPanel";
import { CasePaymentPanel } from "./CasePaymentPanel";
import { workspaceLook as look } from "../../constants/workspaceLook";
import { CaseNeedsCheck } from "./CaseNeedsCheck";
/** A block with a title. Inside 「…の記録」 it is a grey block (white holds grey, grey holds lines). */
function Card({ title, children, nested = false }: { title: string; children: React.ReactNode; nested?: boolean }) {
  return <section className={`${nested ? look.recordBlock : look.panel} ${look.body}`}><h3 className={`mb-2 ${look.sectionTitle}`}>{title}</h3>{children}</section>;
}
/** Label/value lines at the top of the open step, as in the step-view mock. */
function Rows({ rows }: { rows: [string, ReactNode][] }) {
  return <dl className="mb-5">{rows.map(([label, value]) => <div key={label} className={look.fieldRow}>
    <dt className={look.fieldLabel}>{label}</dt><dd className={look.fieldValue}>{value}</dd></div>)}</dl>;
}
function Records({ title, children }: { title: string; children: ReactNode }) {
  return <details className={look.records}><summary className={look.recordsSummary}>{title}<span aria-hidden="true" className={look.disclosure}>›</span></summary><div className="space-y-3 p-3 pt-0">{children}</div></details>;
}
export function CaseWorkspaceSections({ record, section,step=null,application=false,readOnly=false,onChanged=()=>{},selectedNotificationId,overviewPart=null }: {selectedNotificationId?:string; record: CaseWorkspaceRecord; section: CaseSection;step?:CaseStepKey|null;application?:boolean;readOnly?:boolean;onChanged?:()=>void;overviewPart?:CaseOverviewPart|null }) {
  const { model: m, display: d } = record;
  const quote = caseKnown(m.facts.quote), payment = caseKnown(d.payment), delivery = caseKnown(m.facts.delivery);
  const receipt = caseKnown(d.receipt), tasks = caseKnown(d.tasks), conversation = caseKnown(d.conversation);
  const roughs = caseKnown(m.facts.roughs);
  // Orders taken outside the site (つなぐ, SNS, mail) do not use the site's talk or mail/Stripe checks unless something was recorded.
  const external = caseKnown(m.facts.project)?.origin === "external";
  const externalSteps = caseUsesExternalSteps(record);
  if (section === "consultation") return <div className="space-y-4">
    {external && !conversation ? null : <Card title="相談">{conversation ? <><p className="font-semibold">最後に書いた人：{conversation.latestSender === "client" ? "お客さん" : "あなた"}</p>
      <p className={`mt-1 ${look.meta}`}>{caseTime(conversation.latestAt)}</p></>
      : <p>{observationLabel(d.conversation)}</p>}</Card>}
    {!application?<p className="rounded-xl bg-zinc-100 p-4 text-sm text-zinc-600">見本の画面なので、返信は送れません。</p>:null}
  </div>;
  const agreed = quote?.acceptance && m.agreement === "accepted" ? quote.acceptance : null;
  const quoteReply = m.agreement === "accepted" ? `OK · ${caseTime(quote!.acceptance!.acceptedAt)}` : m.agreement === "needs_review" ? <CaseNeedsCheck>OKの内容を見てください</CaseNeedsCheck> : "まだ";
  if (section === "transaction") return <div className="space-y-4">
    {/* In the app the 金額と入金 card below shows the same thing, so the summary rows are only for the read-only views. */}
    {externalSteps && step === "quote" ? application && !readOnly ? null : <><Rows rows={[["金額", caseKnown(m.facts.project)?.administrativeAmount ? caseMoney(caseKnown(m.facts.project)!.administrativeAmount) : "まだ決めていません"],
        ["入金", payment ? `入金済み · ${caseTime(payment.confirmedAt)}` : "まだ記録していません"]]} />
</>
    : step === "quote" ? <Rows rows={[["見積", quote ? `第${quote.version}版` : caseQuoteDraftOnly(m.facts.quote) ? "下書き（まだ送っていません）" : observationLabel(m.facts.quote, "まだありません")], ["金額", quote ? caseMoney(quote.money) : "—"], ["お客さんの返事", quote ? quoteReply : "—"]]} />
      : <Rows rows={[["金額", agreed ? caseMoney(agreed.money) : quote ? `${caseMoney(quote.money)}（OK前）` : payment ? `${caseMoney(payment.money)}（入金額）` : "—"], ["宛先", `${record.clientLabel}さん（登録メール）`],
        // 入金が済んでいれば、支払いリンクが読めない・無いことは困りごとではない（「この形式は表示できません」と出さない）。
        ["入金", payment ? `入金済み · ${caseTime(payment.confirmedAt)}` : "まだ"], ["支払いリンク", caseKnown(m.facts.link) ? "作成済み" : payment ? "使っていません" : observationLabel(m.facts.link, "まだ")]]} />}
    {step !== "quote" && caseKnown(m.facts.payment) && caseKnown(m.facts.link)?.source === "legacy_projection" && caseKnown(m.facts.link)?.providerState === "unverified"
      ? <p className={look.body}>入金が済んだので、Stripe の管理画面でこの支払いリンクが「無効」になっているか見てください。有効のままなら、そこで無効にしてください。</p> : null}
    {application&&!readOnly&&!(external&&(m.facts.operations.state==="absent"||(m.facts.operations.state==="ready"&&m.facts.operations.value.length===0)))?<CaseReconciliationPanel selectedNotificationId={selectedNotificationId} key={`reconciliation-${record.id}`} projectId={record.id} onChanged={onChanged}/>:null}
    {external&&m.facts.link.state==="absent"?null:application&&!readOnly?<CasePaymentPanel key={record.id} projectId={record.id} onChanged={onChanged}/>:<p className="rounded-xl bg-pink-50 p-4 text-sm text-pink-950">{readOnly?"いまは見るだけなので、支払いリンクは送れません。":"見本の画面なので、見積や支払いリンクは送れません。"}</p>}
    {externalSteps ? null : <Records title="見積・入金・メールの記録">
    <div className="grid gap-3 sm:grid-cols-2"><Card nested title="見積">{quote ? <><p className="font-semibold">第{quote.version}版 · {caseMoney(quote.money)}</p>
      {m.agreement === "needs_review" ? <CaseNeedsCheck className="mt-2">OKの内容がこの見積と合っているか見てください</CaseNeedsCheck> : <p className="mt-2">{m.agreement === "accepted" ? `OKをもらった日時：${caseTime(quote.acceptance!.acceptedAt)}` : "まだOKをもらっていません"}</p>}</>
      : <p>{caseQuoteDraftOnly(m.facts.quote) ? "下書きがあります（まだ送っていません）" : observationLabel(m.facts.quote, "見積はまだありません")}</p>}</Card>
      <Card nested title="入金">{payment ? <><p className="font-semibold">{caseMoney(payment.money)} · 入金済み</p><p className="mt-2">{caseTime(payment.confirmedAt)}</p>
        <p className={`mt-1 ${look.meta}`}>{payment.method === "manual" ? "あなたが記録した入金" : payment.method === "stripe" ? "カード決済（Stripe）" : "以前の方法での入金"}</p></>
        : <p>{observationLabel(m.facts.payment, "まだ入金はありません")}</p>}</Card></div>
    <Card nested title="支払いリンクとメール"><p>{caseKnown(m.facts.link) ? "支払いリンクは作ってあります。送ったメールは下にあります。" : observationLabel(m.facts.link,"支払いリンクはまだ作っていません")}</p>
      <div className={`mt-4 pt-4 ${look.recordDivider}`}><NotificationRows record={record} /></div></Card>
    </Records>}
  </div>;
  const deliveryRows: [string, ReactNode][] = [["納品", delivery ? `納品済み · ${caseTime(delivery.recordedAt)}` : observationLabel(m.facts.delivery, "まだ")],
    ["納品ページの期限", delivery?.expiresAt ? caseTime(delivery.expiresAt) : "—"], ["受け取り", receipt ? caseTime(receipt.acceptedAt) : observationLabel(d.receipt, "まだ")]];
  if (section === "production") return <div className="space-y-4">
    {step === "delivery" || step === "receipt" ? <Rows rows={deliveryRows} /> : <>
      {roughs?.length ? <Rows rows={roughs.map((rough, index): [string, ReactNode] => [`ラフ${index + 1}`, rough.clientOkAt ? `お客さんOK · ${caseTime(rough.clientOkAt)}${rough.acknowledgedAt ? "（確認済み）" : ""}` : "お客さんの返事待ち"])} />
        : <p className={`mb-4 ${look.body}`}>{observationLabel(m.facts.roughs, "トークで送ったラフはまだありません")}</p>}
      <div className="mb-2"><p className={`mb-2 ${look.sectionTitle}`}>工程{tasks?.length ? <span className={`ml-2 font-normal ${look.meta}`}>{tasks.filter(t => t.done).length}/{tasks.length} 完了</span> : null}</p>
        {/* In the live workspace the 工程を進める buttons below are the one place to see and press the tasks. */}
        {tasks?.length && application && !readOnly ? null : tasks?.length ? <ul aria-label="制作の工程" className="flex flex-wrap gap-2">{tasks.map(task => <li key={task.id} className={`rounded-full border px-3 py-1.5 text-sm font-semibold ${task.done ? "border-[#BE185D] bg-[#BE185D] text-white" : "border-black/10 bg-white text-[#3C3C43]"}`}>{task.done ? "✓ " : ""}{stages[task.stage]}<span className="sr-only">{task.done ? "（完了）" : "（まだ）"}</span></li>)}</ul>
          : <p className={look.body}>{observationLabel(d.tasks, "工程はまだ登録されていません")}</p>}</div>
    </>}
    <Records title="ラフ・納品・受取の記録">
    <Card nested title="ラフ">{roughs?.length ? <ul className="space-y-2">{roughs.map((rough,index) => <li key={rough.id}>ラフ{index+1}：{rough.clientOkAt ? `お客さんOK · ${rough.acknowledgedAt ? "確認済み" : "まだ確認していません"}` : "お客さんの返事待ち"}</li>)}</ul>
      : <p>{observationLabel(m.facts.roughs, "トークで送ったラフはまだありません")}</p>}</Card>
    <Card nested title="納品と受取">{delivery ? <><p className="font-semibold">納品済み</p><p className="mt-1">納品ページの期限：{delivery.expiresAt ? caseTime(delivery.expiresAt) : "—"}</p>
      {delivery.manifest === "verified" ? <p className={`mt-1 ${look.meta}`}>納品ファイルはそろっています</p> : <CaseNeedsCheck className="mt-2">納品ファイルの記録が足りません</CaseNeedsCheck>}</>
      : <p>{observationLabel(m.facts.delivery, "まだ納品していません")}</p>}
      <div className={`mt-4 pt-4 ${look.recordDivider}`}><p>{receipt ? `受け取り：${caseTime(receipt.acceptedAt)}` : observationLabel(d.receipt,"お客さんはまだ受け取っていません")}</p>
        {receipt?.correspondence === "unconfirmed" ? <CaseNeedsCheck className="mt-2">どの納品の受け取りか分かりません</CaseNeedsCheck> : null}</div></Card>
    </Records>
    {!application?<p className={look.meta}>見本の画面なので、工程の変更や納品はできません。</p>:null}
  </div>;
  if (section === "history") return <div className="space-y-4">
    <Card title="これまでの流れ"><ol className="space-y-4 border-l-2 border-pink-100 pl-4">
      {quote?.acceptance ? <li><p className="font-semibold">{m.agreement === "accepted" ? `見積（${quote.version}回目）にOK` : "OKの記録"}</p>{m.agreement === "accepted" ? null : <CaseNeedsCheck className="my-1">どの見積へのOKか分かりません</CaseNeedsCheck>}<p className={look.meta}>{caseTime(quote.acceptance.acceptedAt)} · {caseMoney(quote.acceptance.money)}</p></li> : null}
      {payment ? <li><p className="font-semibold">入金</p><p className={look.meta}>{caseTime(payment.confirmedAt)} · {caseMoney(payment.money)}</p></li> : null}
      {delivery ? <li><p className="font-semibold">納品</p><p className={look.meta}>{caseTime(delivery.recordedAt)}</p></li> : null}
      {receipt ? <li><p className="font-semibold">受け取り</p><p className={look.meta}>{caseTime(receipt.acceptedAt)}{receipt.correspondence === "matched" ? " · 納品と一致" : null}</p>{receipt.correspondence === "matched" ? null : <CaseNeedsCheck className="mt-1">どの納品の受け取りか分かりません</CaseNeedsCheck>}</li> : null}
      {!quote?.acceptance && !payment && !delivery && !receipt ? <li>まだ記録はありません。</li> : null}
    </ol></Card>
    {/* Mails and processing records stay one tap away so the history opens on the timeline alone. */}
    <Records title="メールと処理の記録"><Card nested title="送ったメール"><NotificationRows record={record} /></Card>
    <Card nested title="送信や保存の処理">{caseKnown(m.facts.operations)?.length ? <ul className="space-y-2">{caseKnown(m.facts.operations)!.map((operation,index) => <li key={operation.id}>処理{index+1}：{operation.state === "succeeded" ? "完了" : <CaseNeedsCheck>{operation.state === "unknown" ? "結果が分かりません" : "うまくいかなかったかもしれません"}</CaseNeedsCheck>}</li>)}</ul>
      : <p>{observationLabel(m.facts.operations,"途中の処理はありません")}</p>}</Card></Records>
  </div>;
  if (overviewPart !== "decided") return null;
  return <div className="grid gap-4 sm:grid-cols-2">
    <Card title="決まったこと"><p className="font-semibold">{quote?.acceptance ? m.agreement === "accepted" ? `${caseMoney(quote.acceptance.money)}でOK（${quote.version}回目の見積）` : <>{caseMoney(quote.acceptance.money)}でOK<CaseNeedsCheck className="mt-1 flex w-fit">どの見積へのOKか分かりません</CaseNeedsCheck></> : "まだ見積のOKはもらっていません"}</p>
      <p className="mt-3">納期の目安：{record.registeredDueDate?<>{caseDate(record.registeredDueDate)}<span className={`block ${look.meta}`}>登録した日付です。お客さんと約束した日は見積で確かめてください。</span></>:"なし"}</p></Card>
    <Card title="制作"><p className="font-semibold">{tasks ? `${tasks.length}工程中${tasks.filter(task=>task.done).length}工程 完了` : observationLabel(d.tasks, "工程はまだ登録されていません")}</p></Card>
        {!application?<Card title="この画面でできること"><p>見本の画面なので、送信や保存はできません。</p></Card>:null}
  </div>;
}

function NotificationRows({ record }: { record: CaseWorkspaceRecord }) {
  const observation=record.model.facts.notifications, rows=caseKnown(observation);
  return rows?.length ? <ul className="space-y-3">{rows.map((row,index) => <li key={row.id}>
    <p className="font-semibold">案内{index+1} · {CASE_NOTICE_PURPOSES[row.purpose]} · {caseNoticeLabel(row)}</p>
    <p className={look.meta}>{caseTime(row.recordedAt)} · {row.attemptNo > 1 ? `${row.attemptNo}回目 · ` : ""}{row.sentAt ? "送信済み" : ""}</p>
  </li>)}</ul> : <p>{observationLabel(observation, "まだメールは送っていません")}</p>;
}
