import "server-only";

// features/natori/server/quoteAcceptService.ts
// 見積もりのワンクリック承諾。見積もりメール内の承諾ページURL（トークン付き）
// から呼ばれる公開フロー。
//
// - トークンは orderMailService が見積もり送信時に発行し、SHA-256 ハッシュのみ
//   DB に保存されている。ここでは受け取ったトークンをハッシュ化して照合する。
// - 承諾の確定は「quote_accepted_at IS NULL」を条件に含めた条件付き UPDATE で
//   原子的に行う（二度押し・二重タブでも記録は1回だけ）。
// - GET（ページ表示）では状態を読むだけで何も書かない。メールセキュリティの
//   リンク自動スキャンで承諾が確定してしまう事故を防ぐため、確定は必ず POST。
import { createHash } from "crypto";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { formatYen } from "@/features/natori/lib/pricing";
import { sendNatoriNoticeMail } from "@/features/natori/server/orderMailService";

/** base64url 32バイト（43文字）を想定。形式外は照合せず弾く */
const TOKEN_RE = /^[A-Za-z0-9_-]{20,64}$/;

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export type NatoriQuoteView = {
  projectId: string;
  title: string;
  clientName: string;
  amount: number;
  acceptedAt: string | null;
};

export type GetNatoriQuoteResult =
  | { kind: "ok"; quote: NatoriQuoteView }
  | { kind: "expired" }
  | { kind: "not-found" };

type QuoteRow = {
  id: string;
  title: string;
  client_name: string;
  amount: number;
  note: string | null;
  quote_accepted_at: string | null;
  quote_token_expires_at: string | null;
};

async function fetchQuoteRow(token: string): Promise<QuoteRow | null> {
  if (!TOKEN_RE.test(token)) return null;
  const admin = supabaseAdmin();
  const { data, error } = await admin
    .from("natori_projects")
    .select("id, title, client_name, amount, note, quote_accepted_at, quote_token_expires_at")
    .eq("quote_accept_token_hash", hashToken(token))
    .maybeSingle();
  if (error) {
    console.error("[natori-quote] quote fetch failed", error);
    return null;
  }
  return (data as QuoteRow | null) ?? null;
}

function isExpired(row: QuoteRow): boolean {
  // 承諾済みの見積もりは期限切れ後も「承諾済み」として表示し続ける
  if (row.quote_accepted_at) return false;
  if (!row.quote_token_expires_at) return false;
  return new Date(row.quote_token_expires_at).getTime() < Date.now();
}

function toView(row: QuoteRow): NatoriQuoteView {
  return {
    projectId: row.id,
    title: row.title,
    clientName: row.client_name,
    amount: row.amount,
    acceptedAt: row.quote_accepted_at,
  };
}

/** 承諾ページ（GET）用。読むだけで何も書かない */
export async function getNatoriQuoteByToken(token: string): Promise<GetNatoriQuoteResult> {
  const row = await fetchQuoteRow(token);
  if (!row) return { kind: "not-found" };
  if (isExpired(row)) return { kind: "expired" };
  return { kind: "ok", quote: toView(row) };
}

export type AcceptNatoriQuoteResult =
  | { kind: "ok"; quote: NatoriQuoteView }
  | { kind: "already-accepted"; quote: NatoriQuoteView }
  | { kind: "expired" }
  | { kind: "not-found" }
  | { kind: "db-error" };

/** 承諾ボタン（POST）からの確定処理 */
export async function acceptNatoriQuote(token: string): Promise<AcceptNatoriQuoteResult> {
  const row = await fetchQuoteRow(token);
  if (!row) return { kind: "not-found" };
  if (isExpired(row)) return { kind: "expired" };
  if (row.quote_accepted_at) return { kind: "already-accepted", quote: toView(row) };

  const today = new Date().toISOString().slice(0, 10);
  const acceptedAt = new Date().toISOString();
  const logEntry = `【見積もり承諾 ${today}】${formatYen(row.amount)}（承諾ページより）`;
  const note = row.note ? `${row.note}\n\n${logEntry}` : logEntry;

  const admin = supabaseAdmin();
  const { data: updated, error } = await admin
    .from("natori_projects")
    .update({
      quote_accepted_at: acceptedAt,
      quote_accepted_amount: row.amount,
      next_action: "承諾済み・お支払いのご案内を送る",
      note,
    })
    .eq("id", row.id)
    .eq("quote_accept_token_hash", hashToken(token))
    .is("quote_accepted_at", null)
    .select("id");
  if (error) {
    console.error("[natori-quote] accept update failed", error);
    return { kind: "db-error" };
  }
  if (!updated || updated.length === 0) {
    // 二度押し・二重タブで別リクエストが先に確定した
    return { kind: "already-accepted", quote: { ...toView(row), acceptedAt } };
  }

  // ナトリへの通知（ベストエフォート。失敗しても承諾自体は成立）
  const noticeBody = [
    "見積もりが承諾されました。お支払いのご案内を送ってください。",
    "",
    `■ 案件: ${row.title}`,
    `■ 依頼者: ${row.client_name} 様`,
    `■ 承諾金額: ${formatYen(row.amount)}`,
    "",
    "案件管理 → 該当案件 → 「支払い依頼メール」から送信できます",
    "（宛先・金額は自動で入ります）。",
    "ダッシュボード: https://www.me-ish.art/natori/projects",
  ].join("\n");
  const sent = await sendNatoriNoticeMail(
    `【承諾】${row.client_name} 様 / ${row.title}`,
    noticeBody
  );
  if (!sent) {
    console.error("[natori-quote] accept notice mail failed (ignored)");
  }

  return { kind: "ok", quote: { ...toView(row), acceptedAt } };
}
