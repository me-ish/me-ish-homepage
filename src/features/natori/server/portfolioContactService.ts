import "server-only";

// features/natori/server/portfolioContactService.ts
// /natori/portfolio のご依頼フォーム送信処理。
// Resend でナトリ宛にメール通知する（DB保存はしない）。
import { Resend } from "resend";
import { z } from "zod";
import {
  NATORI_COMMERCIAL_USE_LABELS_V1,
  NATORI_INQUIRY_MODE_LABELS_V1,
  NATORI_PUBLICATION_POLICY_LABELS_V1,
  describeNatoriBudget,
  describeNatoriCommissionScope,
  describeNatoriDeadline,
  describeNatoriRequestType,
  describeNatoriSelectedOptions,
  describeNatoriUsageTypes,
} from "@/features/natori/lib/requestPresentation";
import type { NatoriRequestDataV1 } from "@/features/natori/types/request";

/* ---------- Env ---------- */
const RESEND_API_KEY = process.env.RESEND_API_KEY || "";
const FROM = process.env.RESEND_FROM ?? "me-ish Gallery <noreply@me-ish.art>";
/** 依頼メールの宛先（ナトリ先生）。テスト時は env NATORI_PORTFOLIO_CONTACT_TO で上書きする */
const TO = process.env.NATORI_PORTFOLIO_CONTACT_TO ?? "natori.o0716@gmail.com";
/** 依頼者向け自動返信の差出人（orderMailService と同じ env を共有） */
const AUTO_REPLY_FROM =
  process.env.NATORI_ORDER_MAIL_FROM ?? "ナトリ（me-ish） <noreply@me-ish.art>";
/** 全 natori メールの BCC（me-ish 側で控えを残す用）。未設定なら BCC なし */
const BCC = process.env.NATORI_MAIL_BCC?.trim() || "";

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
    ...(BCC ? { bcc: [BCC] } : {}),
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
    ...(BCC ? { bcc: [BCC] } : {}),
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

/* ---------- Structured (RequestData V1) mail ---------- */

/**
 * structured 受付の通知メール入力。
 * request_data の raw JSON、署名URL、Storage path、project/owner UUID は
 * 意図的に含めない。管理画面 (P1-07) が資料の唯一の閲覧経路になる。
 */
export type StructuredPortfolioContactInput = {
  clientName: string;
  clientEmail: string;
  requestData: NatoriRequestDataV1;
  referenceImageCount: number;
  /** server 側で normalize 済みの外部参照 URL。表示は escape 済み text のみ。 */
  referenceLinkUrls: string[];
};

function structuredSummaryRows(
  input: StructuredPortfolioContactInput
): Array<[string, string]> {
  const request = input.requestData;
  return [
    ["受付区分", NATORI_INQUIRY_MODE_LABELS_V1[request.inquiryMode]],
    ["ご依頼の種類", describeNatoriRequestType(request)],
    ["制作範囲", describeNatoriCommissionScope(request)],
    ["追加オプション", describeNatoriSelectedOptions(request)],
    ["使用目的", describeNatoriUsageTypes(request)],
    ["商用利用", NATORI_COMMERCIAL_USE_LABELS_V1[request.commercialUse]],
    ["公開可否", NATORI_PUBLICATION_POLICY_LABELS_V1[request.publicationPolicy]],
    ["ご予算", describeNatoriBudget(request.budget)],
    ["希望納期", describeNatoriDeadline(request.deadline)],
    ["添付画像", `${input.referenceImageCount}件`],
    ["参考URL", `${input.referenceLinkUrls.length}件`],
  ];
}

function structuredDetailRows(request: NatoriRequestDataV1): Array<[string, string]> {
  return (
    [
      ["キャラクターの特徴", request.characterFeatures],
      ["表情・雰囲気", request.expressionMood],
      ["構図", request.composition],
      ["色のイメージ", request.colorDirection],
      ["資料の補足", request.referenceNotes],
      ["ご相談・ご質問", request.message],
    ] as Array<[string, string]>
  ).filter(([, value]) => value.length > 0);
}

function renderRowsHtml(rows: Array<[string, string]>): string {
  return rows
    .map(
      ([label, value]) =>
        `<tr><td style="padding:2px 12px 2px 0;color:#6b7280;white-space:nowrap;vertical-align:top"><b>${escapeHtml(label)}</b></td><td style="padding:2px 0">${escapeHtml(value)}</td></tr>`
    )
    .join("");
}

/**
 * 管理者向けの structured 受付通知。
 * 依頼者が入力した外部URLは、既存契約どおり escape 済みの平文としてだけ載せ、
 * <img src> や自動リンクにはしない。
 */
export async function sendStructuredPortfolioContactEmail(
  input: StructuredPortfolioContactInput
): Promise<{ mailed: boolean }> {
  const request = input.requestData;
  const modeLabel = NATORI_INQUIRY_MODE_LABELS_V1[request.inquiryMode];
  const rows: Array<[string, string]> = [
    ["お名前", input.clientName],
    ["メール", input.clientEmail],
    ...structuredSummaryRows(input),
  ];
  const details = structuredDetailRows(request);
  const linkLines =
    input.referenceLinkUrls.length > 0 ? input.referenceLinkUrls : ["なし"];

  const subject = `【コミッション依頼・${sanitizeSubjectFragment(modeLabel)}】${sanitizeSubjectFragment(input.clientName)} 様より`;

  const text = [
    ...rows.map(([label, value]) => `${label}: ${value}`),
    "",
    "--- 参考URL（リンクを開く前に内容をご確認ください） ---",
    ...linkLines,
    "",
    "--- ご依頼の詳細 ---",
    ...(details.length > 0
      ? details.map(([label, value]) => `【${label}】\n${value}`)
      : ["（詳細の記入はありません）"]),
    "",
    "添付画像は管理画面からご確認ください。",
  ].join("\n");

  const html = `
    <div style="font:14px/1.7 -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Noto Sans JP', 'Hiragino Kaku Gothic ProN', 'Yu Gothic', Meiryo, Arial, sans-serif;">
      <table style="border-collapse:collapse">${renderRowsHtml(rows)}</table>
      <hr style="border:none;border-top:1px solid #e5e7eb;margin:12px 0"/>
      <p style="margin:0 0 4px"><b>参考URL</b>（リンクを開く前に内容をご確認ください）</p>
      <pre style="white-space:pre-wrap;font:inherit;margin:0 0 12px">${escapeHtml(linkLines.join("\n"))}</pre>
      <p style="margin:0 0 4px"><b>ご依頼の詳細</b></p>
      ${
        details.length > 0
          ? `<table style="border-collapse:collapse">${renderRowsHtml(details)}</table>`
          : `<p style="margin:0">（詳細の記入はありません）</p>`
      }
      <hr style="border:none;border-top:1px solid #e5e7eb;margin:12px 0"/>
      <p style="margin:0">添付画像は管理画面からご確認ください。</p>
    </div>
  `;

  const resend = new Resend(RESEND_API_KEY);
  const { error } = await resend.emails.send({
    from: FROM,
    to: [TO],
    ...(BCC ? { bcc: [BCC] } : {}),
    subject,
    text,
    html,
    replyTo: input.clientEmail,
    headers: {
      "X-Meish-Template": "natori-portfolio-contact-v2",
    },
  });
  if (error) {
    console.error("[natori-portfolio-contact] structured mail send failed");
    return { mailed: false };
  }
  return { mailed: true };
}

/** 依頼者向けの structured 受付確認。失敗しても受付自体は取り消さない。 */
export async function sendStructuredPortfolioContactAutoReply(
  input: StructuredPortfolioContactInput
): Promise<{ mailed: boolean }> {
  const request = input.requestData;
  const details = structuredDetailRows(request);
  const nextStep =
    request.inquiryMode === "quote"
      ? "内容を確認のうえ、2〜3日以内にお見積もりをご連絡いたします。"
      : "内容を確認のうえ、2〜3日以内にご相談のお返事をいたします。";

  const text = [
    `${input.clientName} 様`,
    "",
    "この度はご依頼のお問い合わせをいただき、ありがとうございます。",
    "イラストレーターのナトリです。",
    "",
    "以下の内容で受け付けました。",
    nextStep,
    "",
    "──────────────",
    ...structuredSummaryRows(input).map(([label, value]) => `■ ${label}: ${value}`),
    "──────────────",
    ...(details.length > 0
      ? ["", "--- ご入力の詳細 ---", ...details.map(([label, value]) => `【${label}】\n${value}`)]
      : []),
    "",
    "※このメールは自動送信です。追加のご連絡がある場合は、",
    "　このメールにそのままご返信ください。",
    "",
    "ナトリ",
  ].join("\n");

  const resend = new Resend(RESEND_API_KEY);
  const { error } = await resend.emails.send({
    from: AUTO_REPLY_FROM,
    to: [input.clientEmail],
    ...(BCC ? { bcc: [BCC] } : {}),
    subject: `【受付確認】ご依頼ありがとうございます（ナトリ）`,
    text,
    replyTo: TO,
    headers: {
      "X-Meish-Template": "natori-portfolio-contact-v2-auto-reply",
    },
  });
  if (error) {
    console.error("[natori-portfolio-contact] structured auto-reply send failed");
    return { mailed: false };
  }
  return { mailed: true };
}
