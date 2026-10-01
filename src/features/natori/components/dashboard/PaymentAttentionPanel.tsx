import {getPaymentAttention} from "@/features/natori/server/paymentReadModelService";

const reasons:Record<string,string>={amount_mismatch:"金額の照合",quote_mismatch:"見積りの版の照合",duplicate_payment:"重複入金の確認",
 terminal_project_payment:"終了案件への入金",legacy_transaction_review:"既存の入金記録の照合",currency_mismatch:"通貨の確認",
 quote_unrelated:"見積りとの対応確認",quote_not_accepted:"見積りの承諾確認",project_type_unconfirmed:"依頼種別の確認"};
export default async function PaymentAttentionPanel(){
 const attention=await getPaymentAttention();if(!attention)return null;
 if(!attention.available)return <p role="alert" className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm">入金の要確認一覧を読み込めませんでした。再読み込みして確認してください。</p>;
 if(!attention.items.length)return null;
 return <section className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-950">
  <h2 className="font-bold">入金の確認が必要な案件</h2>
  <p className="mt-1 text-sm">入金と制作の進行は別の記録です。Stripeの取引と案件の記録を照合してください。</p>
  <ul className="mt-3 space-y-2">{attention.items.map((item,index)=><li key={`${item.projectId}/${index}`} className="rounded-xl bg-white p-3 text-sm">
   <p className="break-words font-bold">{item.title}</p><p>{item.status==="processing"?"確認処理が中断した可能性があります。再配送または再確認が必要です。":reasons[item.reason??""]??"Stripeの取引との照合"}</p>
  </li>)}</ul>
 </section>;
}
