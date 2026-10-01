import "server-only";
import { getQuotePaymentOverview } from "./paymentReadModelService";
import type { NatoriPaymentOverview } from "../types/payment";

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
import { readNatoriQuoteTerms, type NatoriQuoteTerms } from "@/features/natori/lib/quoteTerms";
import { quoteIntegrityEnabled } from "./structuredQuoteService";
import { acceptanceOutboxEnabled } from "./acceptanceNotifications";

const TOKEN_RE = /^[A-Za-z0-9_-]{20,64}$/;

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export type NatoriQuoteView = {
  payment?: NatoriPaymentOverview;
  projectId: string;
  title: string;
  clientName: string;
  amount: number;
  acceptedAt: string | null;
  expiresAt: string;
  terms: NatoriQuoteTerms | null;
  version?: number;
  items: { label: string; quantity: number; amount: number }[];
};

export type GetNatoriQuoteResult =
  | { kind: "ok"; quote: NatoriQuoteView }
  | { kind: "expired" }
  | { kind: "not-found" };

type QuoteRow = {
  id: string;
  version?: number;
  project_id: string;
  title: string;
  client_name: string;
  amount: number;
  accepted_at: string | null;
  expires_at: string;
  superseded_at: string | null;
  quote_terms: unknown;
  pricing_snapshot: unknown;
};

async function fetchQuoteRow(token: string): Promise<QuoteRow | null> {
  if (!TOKEN_RE.test(token)) return null;
  const admin = supabaseAdmin();
  let { data, error } = await admin
    .from("natori_quotes")
    .select("id, version, project_id, title, client_name, amount, accepted_at, expires_at, superseded_at, quote_terms, pricing_snapshot")
    .eq("token_hash", hashToken(token))
    .maybeSingle();
  if (error) {
    console.error("[natori-quote] quote fetch failed", error);
    return null;
  }
  if (!data) {
    const access = await admin.from("natori_quote_access").select("quote_id, expires_at").eq("token_hash",hashToken(token)).maybeSingle();
    if (access.error || !access.data || Date.parse(access.data.expires_at)<=Date.now()) return null;
    const result = await admin.from("natori_quotes")
      .select("id, version, project_id, title, client_name, amount, accepted_at, expires_at, superseded_at, quote_terms, pricing_snapshot")
      .eq("id",access.data.quote_id).maybeSingle();
    data=result.data; error=result.error;
    if (error) return null;
  }
  return (data as QuoteRow | null) ?? null;
}

function isExpired(row: QuoteRow): boolean {
  if (row.accepted_at) return false;
  return new Date(row.expires_at).getTime() < Date.now();
}

function toView(row: QuoteRow): NatoriQuoteView {
  const pricing = row.pricing_snapshot && typeof row.pricing_snapshot === "object" && !Array.isArray(row.pricing_snapshot)
    ? row.pricing_snapshot as Record<string, unknown> : null;
  const items = Array.isArray(pricing?.items) ? pricing.items.flatMap((value: unknown) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) return [];
    const item = value as Record<string, unknown>;
    return typeof item.labelSnapshot === "string" && item.labelSnapshot.length <= 200
      && typeof item.amount === "number" && Number.isSafeInteger(item.amount) && item.amount >= 0
      && typeof item.quantity === "number" && Number.isSafeInteger(item.quantity) && item.quantity >= 1 && item.quantity <= 100
      ? [{ label: item.labelSnapshot, quantity: item.quantity, amount: item.amount }] : [];
  }).slice(0, 30) : [];
  return {
    projectId: row.project_id,
    version: row.version,
    title: row.title,
    clientName: row.client_name,
    amount: row.amount,
    acceptedAt: row.accepted_at,
    expiresAt: row.expires_at,
    terms: readNatoriQuoteTerms(row.quote_terms),
    items,
  };
}

export async function getNatoriQuoteByToken(token: string): Promise<GetNatoriQuoteResult> {
  const row = await fetchQuoteRow(token);
  if (!row) return { kind: "not-found" };
  if (row.superseded_at) return { kind: "not-found" };
  if (isExpired(row)) return { kind: "expired" };
  if (quoteIntegrityEnabled() && !row.accepted_at) {
    const project=await supabaseAdmin().from("natori_projects").select("status, deleted_at, active_quote_id").eq("id",row.project_id).maybeSingle();
    if (project.error || !project.data || project.data.status === "closed" || project.data.deleted_at
      || project.data.active_quote_id !== row.id) return { kind: "not-found" };
  }
  return { kind: "ok", quote: { ...toView(row), payment: await getQuotePaymentOverview(row.project_id) } };
}

export type AcceptNatoriQuoteResult =
  | { kind: "ok"; quote: NatoriQuoteView; notificationIds?: string[] }
  | { kind: "already-accepted"; quote: NatoriQuoteView; notificationIds?: string[] }
  | { kind: "expired" }
  | { kind: "not-found" }
  | { kind: "db-error" };

export async function acceptNatoriQuote(token: string): Promise<AcceptNatoriQuoteResult> {
  const row = await fetchQuoteRow(token);
  if (!row) return { kind: "not-found" };
  if (row.superseded_at) return { kind: "not-found" };
  if (isExpired(row)) return { kind: "expired" };
  const outbox = acceptanceOutboxEnabled();
  if (row.accepted_at && !outbox) return { kind: "already-accepted", quote: toView(row) };

  const admin = supabaseAdmin();
  const { data, error } = await admin.rpc(outbox ? "natori_accept_quote_with_notifications_v1" : "natori_accept_quote", {
    p_token_hash: hashToken(token),
  }).then(result => result, () => ({ data: null, error: { code: "transport" } }));
  if (error) {
    // The transaction may have committed before its response was lost. Confirm the fact;
    // never fabricate an acceptance timestamp or fall back to the old sender.
    if (outbox) {
      const confirmed = await fetchQuoteRow(token);
      if (confirmed?.accepted_at) {
        return { kind: "already-accepted", quote: toView(confirmed), notificationIds: [] };
      }
    }
    console.error("[natori-quote] accept update unconfirmed");
    return { kind: "db-error" };
  }
  const outcome = (Array.isArray(data) ? data[0] : data) as
    | { result?: string; accepted_at?: string | null; notification_ids?: string[] }
    | null;
  if (!outcome || outcome.result === "not-found" || outcome.result === "superseded") {
    return { kind: "not-found" };
  }
  if (outcome.result === "expired") return { kind: "expired" };
  const acceptedAt = outcome.accepted_at;
  if (!acceptedAt) return { kind: "db-error" };
  const notification = outbox ? { notificationIds: outcome.notification_ids ?? [] } : {};
  if (outcome.result === "already-accepted") {
    return { kind: "already-accepted", quote: { ...toView(row), acceptedAt }, ...notification };
  }

  if (outcome.result !== "ok") {
    console.error("[natori-quote] unexpected accept outcome", outcome.result);
    return { kind: "db-error" };
  }
  if (outbox) return { kind: "ok", quote: { ...toView(row), acceptedAt }, ...notification };

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
  ).catch(() => false);
  if (!sent) {
    console.error("[natori-quote] accept notice mail failed (ignored)");
  }

  return { kind: "ok", quote: { ...toView(row), acceptedAt } };
}
