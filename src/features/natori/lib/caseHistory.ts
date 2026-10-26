import { z } from "zod";
import { isPaymentTimestamp } from "./clientPayment";
export const CASE_HISTORY_SOURCES = {
  activity:"既存の対応履歴台帳",quote:"見積の保存版",payment:"入金台帳",refund:"返金台帳",
  notice:"通知ジョブの試行", "legacy-mail":"旧メール送信記録",link:"支払リンク世代",
  "link-operation":"支払リンク処理", "link-stop":"リンク停止処理", "quote-operation":"見積発行処理",
  "work-record":"担当の制作・外部記録", "admin-operation":"管理操作の保存結果", message:"相談メッセージの登録",
  "consultation-operation":"相談の保存処理",rough:"ラフの登録", "rough-ok":"依頼者のラフOK", "rough-ack":"担当のラフOK確認",
  release:"納品発行・受取の記録", "delivery-operation":"納品の保存処理",extension:"納品期限の延長記録",
  "reconciliation-job":"照合ジョブ",resolution:"照合の解決保存",evidence:"照合の証拠保存", "stripe-inbox":"決済通知の受信処理",
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
