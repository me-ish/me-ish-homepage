import "server-only";

// features/natori/server/portfolioContactService.ts
// /natori/portfolio のご依頼フォーム送信処理。
// Resend でナトリ宛にメール通知する（DB保存はしない）。
import { Resend } from "resend";
import { z } from "zod";

/* ---------- Env ---------- */
const RESEND_API_KEY = process.env.RESEND_API_KEY || "";
const FROM = process.env.RESEND_FROM ?? "me-ish Gallery <noreply@me-ish.art>";
/** 依頼メールの宛先（ナトリ先生）。テスト時は env NATORI_PORTFOLIO_CONTACT_TO で上書きする */
const TO = process.env.NATORI_PORTFOLIO_CONTACT_TO ?? "natori.o0716@gmail.com";
/** 依頼者向け自動返信の差出人（orderMailService と同じ env を共有） */
const AUTO_REPLY_FROM =
  process.env.NATORI_ORDER_MAIL_FROM ?? "ナトリ（me-ish） <noreply@me-ish.art>";

/* ---------- Validation ---------- */
export const portfolioContactSchema = z.object({
  name: z.string().trim().min(1, "お名前を入力してください").max(100),
  email: z.string().trim().email().max(254),
  requestType: z.string().trim().min(1).max(50),
  plan: z.string().trim().max(50).optional().default(""),
  options: z.array(z.string().trim().max(50)).max(20).optional().default([]),
  budget: z.string().trim().max(30).optional().default(""),
  deadline: z.string().trim().max(60).optional().default(""),
  refUrls: z.string().trim().max(2000).optional().default(""),
  /** キャラクター資料（フォームからアップロードした画像の公開URL） */
  refImages: z.array(z.string().trim().url().max(500)).max(5).optional().default([]),
  details: z.string().trim().min(1, "ご依頼の詳細を入力してください").max(4000),
  message: z.string().trim().max(2000).optional().default(""),
  /** 蜜壺（hidden）。ボットは埋めがち。ユーザーUIからは送らない想定 */
  website: z.string().optional(),
});

export type PortfolioContactInput = z.infer<typeof portfolioContactSchema>;

/* ---------- Utils ---------- */
function sanitizeSubjectFragment(s: string) {
  // CR/LF除去（ヘッダインジェクション予防）
  return s.replace(/[\r\n]+/g, " ").slice(0, 120);
}

function escapeHtml(s: string) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function isPortfolioContactConfigured() {
  return RESEND_API_KEY.length > 0;
}

/* ---------- Send ---------- */
export async function sendPortfolioContactEmail(
  input: PortfolioContactInput,
  ip: string | null
): Promise<{ mailed: boolean }> {
  const rows: Array<[string, string]> = [
    ["お名前", input.name],
    ["メール", input.email],
    ["ご依頼の種類", input.requestType],
    ["サイズ / プラン", input.plan || "-"],
    ["追加オプション", input.options.length ? input.options.join(" / ") : "なし"],
    ["ご予算", input.budget || "-"],
    ["希望納期", input.deadline || "-"],
    ["IP", ip ?? "-"],
  ];

  const subject = `【コミッション依頼】${sanitizeSubjectFragment(input.name)} 様より`;

  const refLines = [
    ...input.refImages.map((url, index) => `添付画像${index + 1}: ${url}`),
    ...(input.refUrls ? [input.refUrls] : []),
  ];

  const text = [
    ...rows.map(([label, value]) => `${label}: ${value}`),
    "",
    "--- キャラクター資料 ---",
    refLines.length ? refLines.join("\n") : "-",
    "",
    "--- ご依頼の詳細 ---",
    input.details,
    "",
    "--- その他・ご質問 ---",
    input.message || "-",
  ].join("\n");

  const html = `
    <div style="font:14px/1.7 -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Noto Sans JP', 'Hiragino Kaku Gothic ProN', 'Yu Gothic', Meiryo, Arial, sans-serif;">
      <table style="border-collapse:collapse">
        ${rows
          .map(
            ([label, value]) =>
              `<tr><td style="padding:2px 12px 2px 0;color:#6b7280;white-space:nowrap;vertical-align:top"><b>${escapeHtml(label)}</b></td><td style="padding:2px 0">${escapeHtml(value)}</td></tr>`
          )
          .join("")}
      </table>
      <hr style="border:none;border-top:1px solid #e5e7eb;margin:12px 0"/>
      <p style="margin:0 0 4px"><b>キャラクター資料</b></p>
      ${
        input.refImages.length
          ? `<div style="margin:0 0 8px">${input.refImages
              .map(
                (url) =>
                  `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer" style="display:inline-block;margin:0 8px 8px 0"><img src="${escapeHtml(url)}" alt="添付画像" width="120" style="max-width:120px;height:auto;border-radius:8px;border:1px solid #e5e7eb"/></a>`
              )
              .join("")}</div>`
          : ""
      }
      <pre style="white-space:pre-wrap;font:inherit;margin:0 0 12px">${escapeHtml(
        [...input.refImages, ...(input.refUrls ? [input.refUrls] : [])].join("\n") || "-"
      )}</pre>
      <p style="margin:0 0 4px"><b>ご依頼の詳細</b></p>
      <pre style="white-space:pre-wrap;font:inherit;margin:0 0 12px">${escapeHtml(input.details)}</pre>
      <p style="margin:0 0 4px"><b>その他・ご質問</b></p>
      <pre style="white-space:pre-wrap;font:inherit;margin:0">${escapeHtml(input.message || "-")}</pre>
    </div>
  `;

  const resend = new Resend(RESEND_API_KEY);
  const { error } = await resend.emails.send({
    from: FROM,
    to: [TO],
    subject,
    text,
    html,
    replyTo: input.email, // 依頼者へ直接返信しやすく
    headers: {
      "X-Meish-Template": "natori-portfolio-contact",
    },
  });
  if (error) {
    console.error("[natori-portfolio-contact] mail send failed:", error);
    return { mailed: false };
  }
  return { mailed: true };
}

/**
 * 依頼者向けの受付確認メール（自動返信）。
 * 送信内容の控えを添えて「2〜3日以内に返信する」旨を伝える。
 * 失敗しても依頼の受付自体には影響させない（呼び出し側で best-effort 扱い）。
 */
export async function sendPortfolioContactAutoReply(
  input: PortfolioContactInput
): Promise<{ mailed: boolean }> {
  const summaryRows: Array<[string, string]> = [
    ["ご依頼の種類", input.requestType || "-"],
    ["サイズ / プラン", input.plan || "-"],
    ["追加オプション", input.options.length ? input.options.join(" / ") : "なし"],
    ["ご予算", input.budget || "-"],
    ["希望納期", input.deadline || "-"],
    ["添付画像", input.refImages.length ? `${input.refImages.length}枚` : "なし"],
  ];

  const text = [
    `${input.name} 様`,
    "",
    "この度はご依頼のお問い合わせをいただき、ありがとうございます。",
    "イラストレーターのナトリです。",
    "",
    "以下の内容でご依頼を受け付けました。",
    "内容を確認のうえ、2〜3日以内にお見積もりをご連絡いたします。",
    "",
    "──────────────",
    ...summaryRows.map(([label, value]) => `■ ${label}: ${value}`),
    "──────────────",
    "",
    "--- ご依頼の詳細 ---",
    input.details,
    ...(input.message ? ["", "--- その他・ご質問 ---", input.message] : []),
    "",
    "※このメールは自動送信です。追加のご連絡がある場合は、",
    "　このメールにそのままご返信ください。",
    "",
    "ナトリ",
  ].join("\n");

  const resend = new Resend(RESEND_API_KEY);
  const { error } = await resend.emails.send({
    from: AUTO_REPLY_FROM,
    to: [input.email],
    subject: `【受付確認】ご依頼ありがとうございます（ナトリ）`,
    text,
    replyTo: TO, // 依頼者が返信するとナトリに届く
    headers: {
      "X-Meish-Template": "natori-portfolio-contact-auto-reply",
    },
  });
  if (error) {
    console.error("[natori-portfolio-contact] auto-reply send failed:", error);
    return { mailed: false };
  }
  return { mailed: true };
}
