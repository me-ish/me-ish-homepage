import "server-only";

// features/natori/server/quoteAcceptService.ts
// 見積もりのワンクリック承諾。見積もりメール内の承諾ページURL（トークン付き）
// から呼ばれる公開フロー。
//
// - トークンは orderMailService が見積もり送信時に発行し、版付きの
//   natori_quotes に SHA-256 ハッシュだけを保存する。
// - 表示・承諾する内容は発行時スナップショットから読み、案件の現在値を参照しない。
// - 承諾は DB 関数内で quote と project を同一トランザクションで更新する。
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
  project_id: string;
  title: string;
  client_name: string;
  amount: number;
  accepted_at: string | null;
  expires_at: string;
  superseded_at: string | null;
};

async function fetchQuoteRow(token: string): Promise<QuoteRow | null> {
  if (!TOKEN_RE.test(token)) return null;
  const admin = supabaseAdmin();
  const { data, error } = await admin
    .from("natori_quotes")
    .select("id, project_id, title, client_name, amount, accepted_at, expires_at, superseded_at")
    .eq("token_hash", hashToken(token))
    .maybeSingle();
  if (error) {
    console.error("[natori-quote] quote fetch failed", error);
    return null;
  }
  return (data as QuoteRow | null) ?? null;
}

function isExpired(row: QuoteRow): boolean {
  // 承諾済みの見積もりは期限切れ後も「承諾済み」として表示し続ける
  if (row.accepted_at) return false;
  return new Date(row.expires_at).getTime() < Date.now();
}

function toView(row: QuoteRow): NatoriQuoteView {
  return {
    projectId: row.project_id,
    title: row.title,
    clientName: row.client_name,
    amount: row.amount,
    acceptedAt: row.accepted_at,
  };
}

/** 承諾ページ（GET）用。読むだけで何も書かない */
export async function getNatoriQuoteByToken(token: string): Promise<GetNatoriQuoteResult> {
  const row = await fetchQuoteRow(token);
  if (!row) return { kind: "not-found" };
  if (row.superseded_at) return { kind: "not-found" };
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
  if (row.superseded_at) return { kind: "not-found" };
  if (isExpired(row)) return { kind: "expired" };
  if (row.accepted_at) return { kind: "already-accepted", quote: toView(row) };

  const admin = supabaseAdmin();
  const { data, error } = await admin.rpc("natori_accept_quote", {
    p_token_hash: hashToken(token),
  });
  if (error) {
    console.error("[natori-quote] accept update failed", error);
    return { kind: "db-error" };
  }
  const outcome = (Array.isArray(data) ? data[0] : data) as
    | { result?: string; accepted_at?: string | null }
    | null;
  if (!outcome || outcome.result === "not-found" || outcome.result === "superseded") {
    return { kind: "not-found" };
  }
  if (outcome.result === "expired") return { kind: "expired" };
  const acceptedAt = outcome.accepted_at ?? new Date().toISOString();
  if (outcome.result === "already-accepted") {
    return { kind: "already-accepted", quote: { ...toView(row), acceptedAt } };
  }
  if (outcome.result !== "ok") {
    console.error("[natori-quote] unexpected accept outcome", outcome.result);
    return { kind: "db-error" };
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
