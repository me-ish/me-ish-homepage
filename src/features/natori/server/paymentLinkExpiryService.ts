import "server-only";
import {assertCaseSystemAdmission} from "./caseSystemHold";
import {caseAcceptanceConfigured} from "@/lib/caseAcceptanceEnvironment";
import {paymentLinkIntegrityEnabled,stopDuePaymentLinks} from "./paymentLinkService";
import {currentFlowManaged,currentFlowRpc} from "./caseCurrentFlow";
import {randomUUID} from "node:crypto";

import Stripe from "stripe";
import { PAYMENT_DUE_DAYS } from "@/features/natori/lib/orderMail";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const INACTIVE_MESSAGE =
  "お支払い期限が切れています。再度お支払いをご希望の場合は、ナトリからのお見積もりメールへご返信ください。";

type PaymentLinkCandidate = {
  id: string;
  user_id?:string;
  payment_link_id: string | null;
  payment_link_url: string | null;
};

type PaymentMailLog = {
  sent_at: string | null;
};

export type ExpireNatoriPaymentLinksResult =
  | {
      kind: "ok";
      scanned: number;
      expired: number;
      skipped: number;
      failed: number;
    }
  | { kind: "not-configured" }
  | { kind: "db-error" };

function isStripeResourceMissing(error: unknown): boolean {
  return (error as { code?: string } | null)?.code === "resource_missing";
}

/**
 * 最後に正常送信された支払い案内メールから PAYMENT_DUE_DAYS が経過した
 * 未入金の Stripe Payment Link を無効化する。
 *
 * 同じリンクを再送した場合は最新の sent_at を基準にするため、再送時点から
 * 支払い期限が再び7日間になる。
 */
export async function expireNatoriPaymentLinks(
  now: Date = new Date()
): Promise<ExpireNatoriPaymentLinksResult> {
  if(paymentLinkIntegrityEnabled())return stopDuePaymentLinks();
  if(caseAcceptanceConfigured())return {kind:"not-configured"};
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) return { kind: "not-configured" };

  const admin = supabaseAdmin();
  const { data, error } = await admin
    .from("natori_projects")
    .select("id, user_id, payment_link_id, payment_link_url")
    .eq("payment_link_status", "sent")
    .is("payment_confirmed_at", null)
    .not("payment_link_id", "is", null)
    .not("payment_link_url", "is", null);

  if (error) {
    console.error("[natori-payment-expiry] candidate fetch failed", error);
    return { kind: "db-error" };
  }

  const candidates = (data ?? []) as PaymentLinkCandidate[];
  const stripe = new Stripe(secretKey);
  const dueMs = PAYMENT_DUE_DAYS * 24 * 60 * 60 * 1000;
  const nowMs = now.getTime();

  let expired = 0;
  let skipped = 0;
  let failed = 0;

  for (const project of candidates) {
    if (!project.payment_link_id || !project.payment_link_url) {
      skipped += 1;
      continue;
    }

    const { data: latestLog, error: logError } = await admin
      .from("natori_order_mail_logs")
      .select("sent_at")
      .eq("project_id", project.id)
      .eq("kind", "payment")
      .eq("status", "sent")
      .eq("link_url", project.payment_link_url)
      .not("sent_at", "is", null)
      .order("sent_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (logError) {
      failed += 1;
      console.error("[natori-payment-expiry] mail log fetch failed", project.id, logError);
      continue;
    }

    const sentAt = (latestLog as PaymentMailLog | null)?.sent_at;
    if (!sentAt) {
      skipped += 1;
      continue;
    }

    const sentAtMs = new Date(sentAt).getTime();
    if (!Number.isFinite(sentAtMs) || sentAtMs + dueMs > nowMs) {
      skipped += 1;
      continue;
    }

    const operation=randomUUID();
    const expiryArgs={p_owner:project.user_id,p_project:project.id,p_id:operation,p_link:project.payment_link_id,p_sent_at:sentAt,p_now:now.toISOString()};
    try {
      if(currentFlowManaged()){
        if(!project.user_id||await currentFlowRpc("natori_case_current_expiry_v1",{...expiryArgs,p_action:"claim"})!==true){skipped+=1;continue;}
      }else await assertCaseSystemAdmission("legacy-sender");
      await stripe.paymentLinks.update(project.payment_link_id, {
        active: false,
        inactive_message: INACTIVE_MESSAGE,
      });
    } catch (stripeError) {
      if (!isStripeResourceMissing(stripeError)) {
        failed += 1;
        console.error(
          "[natori-payment-expiry] Stripe deactivation failed",
          project.id,
          stripeError
        );
        continue;
      }
    }

    if(currentFlowManaged()){
      try{if(await currentFlowRpc("natori_case_current_expiry_v1",{...expiryArgs,p_action:"record"})===true)expired+=1;else failed+=1;}
      catch{failed+=1;}
      continue;
    }

    const { data: voided, error: updateError } = await admin
      .from("natori_projects")
      .update({ payment_link_status: "void" })
      .eq("id", project.id)
      .eq("payment_link_id", project.payment_link_id)
      .eq("payment_link_status", "sent")
      .is("payment_confirmed_at", null)
      .select("id")
      .maybeSingle();

    if (updateError) {
      failed += 1;
      console.error("[natori-payment-expiry] project update failed", project.id, updateError);
      continue;
    }

    if (voided) expired += 1;
    else skipped += 1;
  }

  return {
    kind: "ok",
    scanned: candidates.length,
    expired,
    skipped,
    failed,
  };
}
