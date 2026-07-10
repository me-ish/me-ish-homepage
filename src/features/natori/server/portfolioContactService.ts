import "server-only";

// features/natori/server/portfolioContactService.ts
// /natori/portfolio のご依頼フォーム送信処理。
// Resend でナトリ宛にメール通知する（DB保存はしない）。
import { Resend } from "resend";
import { z } from "zod";

/* ---------- Env ---------- */
const RESEND_API_KEY = process.env.RESEND_API_KEY || "";
const FROM = process.env.RESEND_FROM ?? "me-ish Gallery <noreply@me-ish.art>";
/** 依頼メールの宛先。env で上書き可能 */
const TO = process.env.NATORI_PORTFOLIO_CONTACT_TO ?? "natori.o0716@gmail.com";

/* ---------- Validation ---------- */
export const portfolioContactSchema = z.object({
  name: z.string().trim().min(1, "お名前を入力してください").max(100),
  email: z.string().trim().email().max(254),
  requestType: z.string().trim().min(1).max(50),
  plan: z.string().trim().max(50).optional().default(""),
  options: z.array(z.string().trim().max(50)).max(20).optional().default([]),
  commercial: z.string().trim().max(50).optional().default(""),
  budget: z.string().trim().max(30).optional().default(""),
  deadline: z.string().trim().max(60).optional().default(""),
  refUrls: z.string().trim().max(2000).optional().default(""),
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
    ["商用利用", input.commercial || "-"],
    ["ご予算", input.budget || "-"],
    ["希望納期", input.deadline || "-"],
    ["IP", ip ?? "-"],
  ];

  const subject = `【コミッション依頼】${sanitizeSubjectFragment(input.name)} 様より`;

  const text = [
    ...rows.map(([label, value]) => `${label}: ${value}`),
    "",
    "--- キャラクター資料・参考URL ---",
    input.refUrls || "-",
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
      <p style="margin:0 0 4px"><b>キャラクター資料・参考URL</b></p>
      <pre style="white-space:pre-wrap;font:inherit;margin:0 0 12px">${escapeHtml(input.refUrls || "-")}</pre>
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
