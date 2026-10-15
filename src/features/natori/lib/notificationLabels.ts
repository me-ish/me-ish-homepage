/** 管理画面の通知一覧で、通知の種類を人が読める名前にする。未知の種類は「通知」。 */
export const NOTIFICATION_PURPOSE_NAMES: Record<string, string> = {
  quote_accept_artist: "見積もり承諾のお知らせ",
  quote_issue_client: "見積もりのご案内（依頼者宛）",
  payment_link_client: "支払いのご案内（依頼者宛）",
  payment_received_artist: "入金のお知らせ",
  payment_received_client: "入金確認（依頼者宛）",
  payment_review_artist: "入金の要確認のお知らせ",
  rough_ok_artist: "ラフOKのお知らせ",
  delivery_issue_client: "納品のご案内",
  delivery_accept_artist: "受取完了のお知らせ",
  delivery_accept_client: "依頼者への受取控え",
  refund_confirmed_artist: "返金確認のお知らせ",
  refund_review_artist: "返金の要確認のお知らせ",
  intake_artist: "新しいご依頼のお知らせ",
  intake_client: "ご依頼の受付確認（依頼者宛）",
  consultation_staff: "依頼者からの相談メッセージのお知らせ",
  consultation_client: "相談への返信のお知らせ（依頼者宛）",
};

export const notificationPurposeName = (purpose: string): string => NOTIFICATION_PURPOSE_NAMES[purpose] ?? "通知";
