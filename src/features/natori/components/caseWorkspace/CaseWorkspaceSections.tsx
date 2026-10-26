"use client";
import type { CaseSection, CaseWorkspaceRecord } from "../../types/caseWorkspace";
import { caseKnown, caseMoney, caseTime, observationLabel } from "../../lib/caseWorkspacePresentation";
import { CASE_NOTICE_PURPOSES, caseNoticeLabel } from "../../lib/caseWorkspaceEntries";

import { CaseReconciliationPanel } from "./CaseReconciliationPanel";
import { CasePaymentPanel } from "./CasePaymentPanel";
const stages = { material: "資料", rough: "ラフ", lineart: "線画", coloring: "着彩", finish: "仕上げ", delivery: "納品" };
function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="rounded-2xl border border-zinc-200 bg-white p-4 sm:p-5"><h3 className="mb-3 text-sm font-semibold text-zinc-600">{title}</h3>{children}</section>;
}
export function CaseWorkspaceSections({ record, section,application=false,readOnly=false,onChanged=()=>{},selectedNotificationId }: {selectedNotificationId?:string; record: CaseWorkspaceRecord; section: CaseSection;application?:boolean;readOnly?:boolean;onChanged?:()=>void }) {
  const { model: m, display: d } = record;
  const quote = caseKnown(m.facts.quote), payment = caseKnown(d.payment), delivery = caseKnown(m.facts.delivery);
  const receipt = caseKnown(d.receipt), tasks = caseKnown(d.tasks), conversation = caseKnown(d.conversation);
  const roughs = caseKnown(m.facts.roughs);
  if (section === "consultation") return <div className="space-y-4">
    <Card title="相談の最新の記録">{conversation ? <><p className="font-semibold">最後の発言：{conversation.latestSender === "client" ? "依頼者" : "担当者"}</p>
      <p className="mt-2 text-sm text-zinc-600">{caseTime(conversation.latestAt)}</p><p className="mt-3 text-sm text-zinc-600">既読や返信要否は、この記録からは判断していません。</p></>
      : <p>{observationLabel(d.conversation)}</p>}</Card>
    {!application?<p className="rounded-xl bg-zinc-100 p-4 text-sm text-zinc-600">会話本文・返信の入力と送信は、この表示確認用画面には接続していません。</p>:null}
  </div>;
  if (section === "transaction") return <div className="space-y-4">
    <div className="grid gap-4 sm:grid-cols-2"><Card title="内部見積">{quote ? <><p className="font-semibold">第{quote.version}版 · {caseMoney(quote.money)}</p>
      <p className="mt-2 text-sm">{m.agreement === "accepted" ? `承諾記録：${caseTime(quote.acceptance!.acceptedAt)}` : m.agreement === "needs_review" ? "条件と承諾の対応を確認する必要があります" : "承諾の記録なし"}</p></>
      : <p>{observationLabel(m.facts.quote, "内部見積の記録なし（取得済み）")}</p>}</Card>
      <Card title="入金の記録">{payment ? <><p className="font-semibold">{caseMoney(payment.money)} · 記録あり</p><p className="mt-2 text-sm">{caseTime(payment.confirmedAt)}</p>
        <p className="mt-2 text-sm text-zinc-600">{payment.method === "manual" ? "手動入金記録" : payment.method === "stripe" ? "入金台帳" : "旧方式の確定記録"}</p></>
        : <p>{observationLabel(m.facts.payment)}</p>}</Card></div>
    <Card title="支払リンクとメール案内"><p>{caseKnown(m.facts.link) ? "支払リンクの状態記録あり。メール案内とは別に確認します。" : observationLabel(m.facts.link,"内部リンクの記録なし（取得済み）")}</p>
      <div className="mt-4 border-t border-zinc-100 pt-4"><NotificationRows record={record} /></div></Card>
    {application&&!readOnly?<CaseReconciliationPanel selectedNotificationId={selectedNotificationId} key={`reconciliation-${record.id}`} projectId={record.id} onChanged={onChanged}/>:null}
    {application&&!readOnly?<CasePaymentPanel key={record.id} projectId={record.id} onChanged={onChanged}/>:<p className="rounded-xl bg-pink-50 p-4 text-sm text-pink-950">{readOnly?"照会のみの画面です。送信・発行・外部照合・解決の保存は停止しています。":"見積の発行・入金登録・支払案内の送信は未接続です。この画面で請求や送信は行われません。"}</p>}
  </div>;
  if (section === "production") return <div className="space-y-4">
    <Card title="制作タスクの現在の記録">{tasks ? <><p className="mb-3 text-sm text-zinc-600">{tasks.filter(t => t.done).length}/{tasks.length}件完了 · 実着手・完了時刻は未記録</p>
      <ul className="divide-y divide-zinc-100">{tasks.map(task => <li key={task.id} className="flex items-center justify-between gap-3 py-3"><span>{stages[task.stage]}</span><span className={task.done ? "text-emerald-800" : "text-zinc-600"}>{task.done ? "完了" : "未完"}</span></li>)}</ul></>
      : <p>{observationLabel(d.tasks)}</p>}</Card>
    <Card title="ラフの確認">{roughs?.length ? <ul className="space-y-3">{roughs.map((rough,index) => <li key={rough.id}>ラフ{index+1}：{rough.clientOkAt ? `依頼者のOK記録あり · ${rough.acknowledgedAt ? "担当確認済み" : "担当確認の記録なし"}` : "依頼者のOK記録なし"}</li>)}</ul>
      : <p>{observationLabel(m.facts.roughs)}</p>}</Card>
    <Card title="納品と受取">{delivery ? <><p className="font-semibold">納品発行の記録あり</p><p className="mt-2 text-sm">保存期限：{delivery.expiresAt ? caseTime(delivery.expiresAt) : "未確認"}</p>
      <p className="mt-2 text-sm text-zinc-600">{delivery.manifest === "verified" ? "保存されたファイル検証記録あり（現在の到達性は未確認）" : "公開の記録は保持しています。ファイルの確認情報は不足しています。"}</p></>
      : <p>{observationLabel(m.facts.delivery)}</p>}
      <p className="mt-4 border-t border-zinc-100 pt-4">{receipt ? `受取の記録：${caseTime(receipt.acceptedAt)}${receipt.correspondence === "unconfirmed" ? "（納品データとの対応は未確認）" : ""}` : observationLabel(d.receipt,"受取の記録なし（取得済み）")}</p></Card>
    {!application?<p className="text-sm text-zinc-600">タスク編集・ファイル取得・納品発行・期限延長は未接続です。</p>:null}
  </div>;
  if (section === "history") return <div className="space-y-4">
    <Card title="確認できた取引の記録"><ol className="space-y-4 border-l-2 border-pink-100 pl-4">
      {quote?.acceptance ? <li><p className="font-semibold">{m.agreement === "accepted" ? `見積 第${quote.version}版の承諾` : "承諾の記録（見積との対応未確認）"}</p><p className="text-sm text-zinc-600">{caseTime(quote.acceptance.acceptedAt)} · {caseMoney(quote.acceptance.money)}</p></li> : null}
      {payment ? <li><p className="font-semibold">入金記録あり</p><p className="text-sm text-zinc-600">{caseTime(payment.confirmedAt)} · {caseMoney(payment.money)}</p></li> : null}
      {delivery ? <li><p className="font-semibold">納品発行の記録</p><p className="text-sm text-zinc-600">{caseTime(delivery.recordedAt)}</p></li> : null}
      {receipt ? <li><p className="font-semibold">受取の記録あり</p><p className="text-sm text-zinc-600">{caseTime(receipt.acceptedAt)} · {receipt.correspondence === "matched" ? "納品との対応確認済み" : "projectの既存記録・納品との対応未確認"}</p></li> : null}
      {!quote?.acceptance && !payment && !delivery && !receipt ? <li>この表示で確定した取引の記録はありません。取得できない領域は下に分けて表示します。</li> : null}
    </ol></Card><Card title="メール案内の記録"><NotificationRows record={record} /></Card>
    <Card title="処理の結果">{caseKnown(m.facts.operations)?.length ? <ul className="space-y-2">{caseKnown(m.facts.operations)!.map((operation,index) => <li key={operation.id}>処理{index+1}：{operation.state === "succeeded" ? "保存結果の記録あり" : operation.state === "unknown" ? "結果を確認できていません" : "処理結果の確認が必要"}</li>)}</ul>
      : <p>{observationLabel(m.facts.operations,"未解決の処理記録なし（取得済み）")}</p>}</Card>
  </div>;
  return <div className="grid gap-4 sm:grid-cols-2">
    <Card title="この案件の約束"><p className="font-semibold">{quote?.acceptance ? m.agreement === "accepted" ? `第${quote.version}版 · ${caseMoney(quote.acceptance.money)}の承諾記録あり` : `承諾の記録あり · ${caseMoney(quote.acceptance.money)}（見積との対応未確認）` : "内部見積の承諾は未確認"}</p>
      <p className="mt-3 text-sm text-zinc-600">登録納期：{record.registeredDueDate??"未登録"}（根拠は未確認）</p></Card>
    <Card title="制作の現在の記録"><p className="font-semibold">{tasks ? `${tasks.length}タスク中${tasks.filter(task=>task.done).length}件完了` : observationLabel(d.tasks)}</p>
      <p className="mt-3 text-sm text-zinc-600">入金記録やタスクの完了を、実着手・納品・受取に置き換えていません。</p></Card>
    <Card title="この表示でできること"><p className="text-sm leading-7">同じ案件の概要・相談・取引・制作・納品・履歴を確認できます。上の案内から該当領域へ移動できます。</p></Card>
    <Card title="実行操作との接続"><p className="text-sm leading-7">{readOnly?"現在は照会のみです。送信や状態を変える操作は表示していません。未確認の処理・確定した事実は保持しています。":application?"取引の領域で支払案内の準備・送信前確認・結果照会を行えます（専用設定が必要）。相談・制作・納品の操作も同じ案件内で確認できます。見積編集は未接続です。":"返信、保存、見積・支払案内・納品の発行は未接続です。"}</p></Card>
  </div>;
}

function NotificationRows({ record }: { record: CaseWorkspaceRecord }) {
  const observation=record.model.facts.notifications, rows=caseKnown(observation);
  return rows?.length ? <ul className="space-y-3">{rows.map((row,index) => <li key={row.id} className="text-sm">
    <p className="font-semibold">案内{index+1} · {CASE_NOTICE_PURPOSES[row.purpose]} · {caseNoticeLabel(row)}</p>
    <p className="mt-1 text-zinc-600">{caseTime(row.recordedAt)} · 試行{row.attemptNo}{row.sentAt ? " · 送信受付の記録（到達・既読は別に確認）" : ""}</p>
  </li>)}</ul> : <p className="text-sm text-zinc-600">{observationLabel(observation, "内部メール案内の記録なし（取得済み）")}</p>;
}
