import { z } from "zod";
import { isPaymentTimestamp } from "./clientPayment";
export const CASE_HISTORY_SOURCES = {
  activity:"対応の記録",quote:"見積",payment:"入金",refund:"返金",
  notice:"メール", "legacy-mail":"以前のメール",link:"支払いリンク",
  "link-operation":"支払いリンクの処理", "link-stop":"支払いリンクの停止", "quote-operation":"見積の送信",
  "work-record":"あなたが書いた記録", "admin-operation":"案件の設定の変更", message:"相談のメッセージ",
  "consultation-operation":"相談の保存",rough:"ラフ", "rough-ok":"お客さんのラフOK", "rough-ack":"ラフOKを見た",
  release:"納品と受け取り", "delivery-operation":"納品の処理",extension:"納品ページの期限延長",
  "reconciliation-job":"結果の問い合わせ",resolution:"問い合わせ結果の記録",evidence:"問い合わせの結果", "stripe-inbox":"カード決済の知らせ",
} as const;
const time=z.string().refine(isPaymentTimestamp), text=z.string().max(500).nullable();
export const caseHistoryRow=z.object({
 id:z.string().min(1).max(600),source:z.enum(Object.keys(CASE_HISTORY_SOURCES) as [keyof typeof CASE_HISTORY_SOURCES,...(keyof typeof CASE_HISTORY_SOURCES)[]]),
 recordId:z.string().min(1).max(256),occurredAt:time.nullable(),state:text,kind:text,
 quoteId:z.uuid().nullable(),quoteVersion:z.number().int().positive().nullable(),quoteMatched:z.boolean().nullable(),
 amount:z.number().int().nonnegative().safe().nullable(),currency:text,relatedId:text,operatorKind:text,origin:text,legacy:z.boolean().nullable(),
 acceptedAt:time.nullable(),sentAt:time.nullable(),receivedAt:time.nullable(),confirmedAt:time.nullable(),expiresAt:time.nullable(),retentionState:text,reason:text,
}).strict();
export const caseHistoryPage=z.object({
 projectId:z.uuid(),revision:z.string().regex(/^[a-f0-9]{32}$/),total:z.number().int().nonnegative().safe(),offset:z.number().int().nonnegative(),
 next:z.number().int().nonnegative().nullable(),changed:z.boolean(),observedAt:time,rows:z.array(caseHistoryRow).max(50),
 counts:z.record(z.string(),z.number().int().nonnegative().safe()),
});
export type CaseHistoryPage=z.infer<typeof caseHistoryPage>;
export type CaseHistoryRow=z.infer<typeof caseHistoryRow>;
export type CaseFinancialDisplay={
 gross:number|null;legacyRecordedAmount:number|null;method:string|null;confirmedAt:string|null;refunded:number|null;net:number|null;
 pendingCount:number|null;reviewCount:number|null;state:"verified"|"unverified";
};
export const caseHistoryView=caseHistoryPage.extend({financial:z.object({legacyRecordedAmount:z.number().int().nonnegative().safe().nullable(),gross:z.number().int().nonnegative().safe().nullable(),method:text,confirmedAt:time.nullable(),refunded:z.number().int().nonnegative().safe().nullable(),net:z.number().int().nonnegative().safe().nullable(),pendingCount:z.number().int().nonnegative().safe().nullable(),reviewCount:z.number().int().nonnegative().safe().nullable(),state:z.enum(["verified","unverified"])}).nullable(),legacyLogs:z.array(z.object({dateISO:z.string().regex(/^\d{4}-\d{2}-\d{2}$/),label:z.string().max(100)}).strict())});
export type CaseHistoryView=z.infer<typeof caseHistoryView>;
/** Per-page validity; changing or partial data can never claim a complete collection. */
export function assertHistoryPage(page:CaseHistoryPage,projectId:string,offset:number,revision:string|null){
 if(page.projectId!==projectId||page.offset!==offset||page.changed||(revision!==null&&page.revision!==revision)||offset>page.total
  ||page.rows.length!==Math.min(50,page.total-offset)||page.next!==(offset+page.rows.length<page.total?offset+page.rows.length:null)
  ||new Set(page.rows.map(row=>row.id)).size!==page.rows.length||Object.values(page.counts).reduce((a,b)=>a+b,0)!==page.total
  ||Object.keys(page.counts).some(key=>!(key in CASE_HISTORY_SOURCES)))throw Error("history_incomplete");
}
