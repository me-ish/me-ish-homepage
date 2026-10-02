import {getPaymentAttention} from "@/features/natori/server/paymentReadModelService";

const reasons:Record<string,string>={refund_history_unverified:"過去の入金と返金履歴が未確認です。返金額・純入金額は確定していません。",
 original_payment_unmatched:"返金と元の入金が未照合です。金額には含めていません。",
 refund_pending:"返金は処理中です。確定返金額には含めていません。",refund_requires_action:"Stripe側で返金の確認が必要です。",
 refund_failed:"返金は失敗しています。確定返金額には含めていません。",refund_canceled:"返金はキャンセルされています。",
 refund_project_mismatch:"返金と案件の対応が一致しません。",refund_currency_mismatch:"返金と元の入金の通貨を確認してください。",
 refund_amount_mismatch:"返金額と元の入金を確認してください。",refund_total_exceeds_original:"返金の合計が元の入金を超えています。",
 refund_identity_conflict:"同じ返金IDの記録が一致しません。元の記録を保持して要確認にしています。",
 refund_state_order_uncertain:"返金の状態の順序を確定できません。Stripeの現在の記録を確認してください。",
 refund_snapshot_incomplete:"返金の一覧が未取得です。Stripe側の全件と照合してください。",refund_snapshot_missing:"返金明細が未取得です。",
 refund_status_unknown:"返金状態が未確認です。",amount_mismatch:"金額の照合",quote_mismatch:"見積りの版の照合",duplicate_payment:"重複入金の確認",
 terminal_project_payment:"終了案件への入金",legacy_transaction_review:"既存の入金記録の照合",currency_mismatch:"通貨の確認",
 quote_unrelated:"見積りとの対応確認",quote_not_accepted:"見積りの承諾確認",project_type_unconfirmed:"依頼種別の確認"};
export default async function PaymentAttentionPanel(){
 const attention=await getPaymentAttention();if(!attention)return null;
 if(!attention.available)return <p role="alert" className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm">入金の要確認一覧を読み込めませんでした。再読み込みして確認してください。</p>;
 if(!attention.items.length)return null;
 return <section className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-950">
  <h2 className="font-bold">入金の確認が必要な案件</h2>
  <p className="mt-1 text-sm">入金と制作の進行は別の記録です。Stripeの取引と案件の記録を照合してください。</p>
  <p className="mt-1 text-sm">返金の未確定・未照合・要確認は、確定返金額に含めません。案件の進行状態は保持されます。</p>
  <ul className="mt-3 space-y-2">{attention.items.map((item,index)=><li key={`${item.projectId}/${index}`} className="rounded-xl bg-white p-3 text-sm">
   <p className="break-words font-bold">{item.title}</p><p>{item.status==="processing"?"確認処理が中断した可能性があります。再配送または再確認が必要です。":reasons[item.reason??""]??"Stripeの取引との照合"}</p>
  </li>)}</ul>
 </section>;
}
