/** Reception wording: a reply is promised, the quote follows clarification. */
export const NATORI_INTAKE_COPY = {
  reply: "内容を確認のうえ、2〜3日以内にお返事します。",
  next: "ご相談で内容が決まったら、金額・納期とご依頼確定のページをご案内します。",
  notConfirmed: "フォームの送信だけでご依頼は確定しません。",
  /** Shown next to the contact fields: what is (and is not) collected. */
  noAccount: "アカウント登録は不要です。",
} as const;

/** 送信後に出す「このあとの流れ」。ポートフォリオの「ご依頼の流れ」と同じ順番・内容にそろえる。 */
export const NATORI_INTAKE_NEXT_STEPS = [
  { title: "お返事", body: "2〜3日以内にメールでお返事します。" },
  { title: "お見積もり", body: "内容が決まったら、金額と納期をお送りします。" },
  { title: "お支払い", body: "ご承諾いただいたら、カード決済のリンクをお送りします。" },
  { title: "制作・納品", body: "ご入金を確認してから描きはじめ、ラフの確認をはさんで納品します。" },
] as const;
