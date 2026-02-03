export type PlanPaymentRequestArgs = {
  name: string;
  title?: string;
  displayPlan: string;
  amountYen: number;
  paymentUrl: string;
  manageUrl?: string;
};

const yen = (n: number) => new Intl.NumberFormat("ja-JP").format(n);

function esc(s: string) {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function generatePlanPaymentRequestEmail(a: PlanPaymentRequestArgs) {
  const title = a.title?.trim() || "作品";
  const manage = a.manageUrl?.trim();
  const amount = `¥${yen(Math.max(0, Math.floor(a.amountYen || 0)))}`;

  const subject = "【me-ish】表示保証プランのお支払いのご案内";

  const html = `
    <div style="font-family: Arial, 'Hiragino Kaku Gothic ProN', 'Yu Gothic', sans-serif; color:#1f2937; line-height:1.7;">
      <p>${esc(a.name)} 様</p>
      <p>作品「${esc(title)}」の審査が完了しました。展示準備のため、表示保証プラン料金のお支払いをお願いします。</p>
      <ul>
        <li>プラン: ${esc(a.displayPlan)}</li>
        <li>料金: ${amount}</li>
      </ul>
      <p>
        <a href="${esc(a.paymentUrl)}" style="display:inline-block;padding:10px 14px;background:#00a1e9;color:#fff;text-decoration:none;border-radius:8px;">
          支払いへ進む
        </a>
      </p>
      <p>ボタンが使えない場合: ${esc(a.paymentUrl)}</p>
      ${manage ? `<p>マイページ: ${esc(manage)}</p>` : ""}
      <p>※ お支払い確認後に展示設定が有効になります。</p>
    </div>
  `;

  const text = `${a.name} 様

作品「${title}」の審査が完了しました。展示準備のため、表示保証プラン料金のお支払いをお願いします。

- プラン: ${a.displayPlan}
- 料金: ${amount}

支払いURL:
${a.paymentUrl}

${manage ? `マイページ: ${manage}\n` : ""}※ お支払い確認後に展示設定が有効になります。`;

  return { subject, html, text };
}

