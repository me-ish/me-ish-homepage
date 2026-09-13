import "server-only";

import { createHash } from "crypto";
import { Resend } from "resend";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const RESEND_API_KEY = process.env.RESEND_API_KEY || "";
const FROM = process.env.NATORI_ORDER_MAIL_FROM ?? "ナトリ（me-ish） <noreply@me-ish.art>";
const REPLY_TO = process.env.NATORI_PORTFOLIO_CONTACT_TO ?? "natori.o0716@gmail.com";
const BCC = process.env.NATORI_MAIL_BCC?.trim() || "";
const TOKEN_RE = /^[A-Za-z0-9_-]{20,64}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function buildDeliveryCompletionMail(input: {
  clientName: string;
  title: string;
  artistName?: string;
}) {
  const artist = input.artistName?.trim() || "ナトリ";
  return {
    subject: `【納品完了】ご依頼ありがとうございました（${artist}）`,
    body: [
      `${input.clientName} 様`,
      "",
      "納品データの受け取りを確認いたしました。",
      `これをもちまして、「${input.title}」のご依頼は納品完了となります。`,
      "",
      `この度は${artist}へご依頼いただき、本当にありがとうございました。`,
      "またお力になれる機会がございましたら、ぜひお気軽にご相談ください。",
      "",
      "※ご不明な点がありましたら、このメールにそのままご返信ください。",
      "",
      artist,
    ].join("\n"),
  };
}

/**
 * 納品受取の初回確定後に、依頼者へ完了の控えを送る。
 * 送信失敗は納品確定を巻き戻さないため、呼び出し側では best-effort 扱いにする。
 */
export async function sendNatoriDeliveryCompletionMail(token: string): Promise<boolean> {
  if (!RESEND_API_KEY || !TOKEN_RE.test(token)) return false;

  const { data, error } = await supabaseAdmin()
    .from("natori_projects")
    .select("title, client_name, client_email, delivery_accepted_at")
    .eq("delivery_token_hash", hashToken(token))
    .maybeSingle();

  if (error) {
    console.error("[natori-delivery-completion-mail] project fetch failed", error);
    return false;
  }
  if (!data?.delivery_accepted_at) {
    console.error("[natori-delivery-completion-mail] delivery is not accepted");
    return false;
  }

  const to = typeof data.client_email === "string" ? data.client_email.trim() : "";
  if (!EMAIL_RE.test(to)) {
    console.error("[natori-delivery-completion-mail] client email missing or invalid");
    return false;
  }

  const mail = buildDeliveryCompletionMail({
    clientName: String(data.client_name ?? ""),
    title: String(data.title ?? ""),
  });
  const resend = new Resend(RESEND_API_KEY);
  const { error: mailError } = await resend.emails.send({
    from: FROM,
    to: [to],
    ...(BCC ? { bcc: [BCC] } : {}),
    subject: mail.subject,
    text: mail.body,
    replyTo: REPLY_TO,
    headers: { "X-Meish-Template": "natori-delivery-completion" },
  });
  if (mailError) {
    console.error("[natori-delivery-completion-mail] send failed", mailError);
    return false;
  }
  return true;
}
