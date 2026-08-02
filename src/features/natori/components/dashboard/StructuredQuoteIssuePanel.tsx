"use client";

import { useMemo, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, Loader2, Mail } from "lucide-react";
import { CSRF_HEADERS } from "@/lib/auth/csrf";
import { buildEstimateMailDraft, resolveClientEmail } from "@/features/natori/lib/orderMail";
import { createNatoriEstimateSuggestionV1 } from "@/features/natori/lib/pricingSuggestion";
import { createStructuredSuggestionConfigFromLegacy } from "@/features/natori/lib/pricingSuggestionConfig";
import { readNatoriRequestData } from "@/features/natori/lib/requestSchema";
import { formatYen } from "@/features/natori/lib/pricing";
import type { NatoriPricingConfigWithStructured } from "@/features/natori/lib/pricingSuggestionConfig";
import type { NatoriProject } from "@/features/natori/types/projects";

const inputClass = "w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-pink-300";

type Props = {
  project: NatoriProject;
  pricingConfig: NatoriPricingConfigWithStructured;
  pricingPresetId: string | null;
  pricingPresetName: string;
  onIssued?: () => void;
};

export default function StructuredQuoteIssuePanel({
  project,
  pricingConfig,
  pricingPresetId,
  pricingPresetName,
  onIssued,
}: Props) {
  const calculated = useMemo(() => {
    const request = readNatoriRequestData(project.requestData);
    if (!request.success) return null;
    const suggestion = createNatoriEstimateSuggestionV1({
      projectType: project.type,
      requestData: request.data,
      pricingConfig: createStructuredSuggestionConfigFromLegacy(pricingConfig),
      deliveryPlan: project.deliveryPlan ?? "normal",
    });
    return { requestData: request.data, suggestion };
  }, [pricingConfig, project]);

  const defaultDraft = useMemo(() => {
    if (!calculated) return { subject: "", body: "" };
    return buildEstimateMailDraft({
      clientName: project.clientName,
      title: project.title,
      amount: calculated.suggestion.total,
      breakdownLines: calculated.suggestion.automaticItems.map(
        (item) => `${item.labelSnapshot}: ${formatYen(item.amount)}`,
      ),
    });
  }, [calculated, project.clientName, project.title]);

  const [to, setTo] = useState(resolveClientEmail(project) ?? "");
  const [subject, setSubject] = useState(defaultDraft.subject);
  const [body, setBody] = useState(defaultDraft.body);
  const [acknowledged, setAcknowledged] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [issued, setIssued] = useState<{ quoteId: string; version: number } | null>(null);
  const idempotencyKeyRef = useRef<string | null>(null);

  if (!calculated) {
    return (
      <section className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-900">
        原依頼snapshotを読み取れないため、正式見積は発行できません。
      </section>
    );
  }

  const { suggestion, requestData } = calculated;
  const needsAcknowledgement = suggestion.reviewItems.length > 0;
  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to.trim());
  const canSend =
    suggestion.canIssueQuote &&
    emailValid &&
    Boolean(subject.trim()) &&
    Boolean(body.trim()) &&
    (!needsAcknowledgement || acknowledged) &&
    !sending;

  const handleIssue = async () => {
    if (!canSend) return;
    setSending(true);
    setError(null);
    try {
      const now = new Date().toISOString();
      const idempotencyKey =
        idempotencyKeyRef.current ??
        `quote:${project.id}:${crypto.randomUUID()}`;
      idempotencyKeyRef.current = idempotencyKey;

      const reviewResolutions = suggestion.reviewItems.map((item) => ({
        code: item.code,
        ruleId: item.ruleId,
        resolution: "accepted" as const,
        note: "正式見積発行前に管理画面で確認済み",
        resolvedAt: now,
      }));

      const response = await fetch("/api/natori/admin/structured-quote", {
        method: "POST",
        headers: { ...CSRF_HEADERS, "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: project.id,
          toEmail: to.trim(),
          subject: subject.trim(),
          bodySnapshot: body,
          idempotencyKey,
          requestSnapshot: requestData,
          pricingSnapshot: {
            schemaVersion: 1,
            mappingVersion: suggestion.mappingVersion,
            pricingConfigVersion: suggestion.pricingConfigVersion,
            pricingPresetId,
            pricingPresetNameSnapshot: pricingPresetName,
            projectTypeSnapshot: project.type,
            items: suggestion.automaticItems.map((item) => ({
              id: item.id,
              presetItemId: item.presetItemId,
              kind: item.kind,
              labelSnapshot: item.labelSnapshot,
              quantity: item.quantity,
              unitAmount: item.unitAmount,
              amount: item.amount,
              automatic: true,
              sourceFields: item.sourceFields,
              ruleId: item.ruleId,
              note: item.note ?? null,
            })),
            reviewItems: suggestion.reviewItems,
            reviewResolutions,
            subtotalBeforePercentage: suggestion.subtotalBeforePercentage,
            total: suggestion.total,
            currency: "JPY",
            issuedAt: now,
          },
        }),
      });
      const json = (await response.json().catch(() => null)) as {
        ok?: boolean;
        error?: string;
        quoteId?: string;
        version?: number;
      } | null;
      if (!response.ok || !json?.ok || !json.quoteId || !json.version) {
        throw new Error(json?.error ?? `発行に失敗しました (${response.status})`);
      }
      setIssued({ quoteId: json.quoteId, version: json.version });
      onIssued?.();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setSending(false);
    }
  };

  if (issued) {
    return (
      <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
        <div className="flex gap-3">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" aria-hidden />
          <div>
            <h2 className="font-black text-emerald-950">正式見積を発行しました</h2>
            <p className="mt-1 text-sm text-emerald-800">
              version {issued.version} / quote ID {issued.quoteId}
            </p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-4 rounded-2xl border border-pink-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex items-center gap-2">
        <Mail className="h-5 w-5 text-pink-600" aria-hidden />
        <div>
          <h2 className="font-black text-gray-950">正式見積を発行する</h2>
          <p className="text-xs text-gray-600">snapshotを固定してからメールを送信します。</p>
        </div>
      </div>

      {!suggestion.canIssueQuote ? (
        <p className="flex gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-bold text-red-900">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          blockerが残っているため発行できません。
        </p>
      ) : null}

      <div>
        <label className="mb-1 block text-xs font-bold text-gray-700">宛先</label>
        <input className={inputClass} type="email" value={to} onChange={(event) => setTo(event.target.value)} />
      </div>
      <div>
        <label className="mb-1 block text-xs font-bold text-gray-700">件名</label>
        <input className={inputClass} value={subject} onChange={(event) => setSubject(event.target.value)} />
      </div>
      <div>
        <label className="mb-1 block text-xs font-bold text-gray-700">本文</label>
        <textarea className={`${inputClass} min-h-64 resize-y`} value={body} onChange={(event) => setBody(event.target.value)} />
      </div>

      {needsAcknowledgement ? (
        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-950">
          <input
            type="checkbox"
            className="mt-1"
            checked={acknowledged}
            onChange={(event) => setAcknowledged(event.target.checked)}
          />
          <span>
            確認項目 {suggestion.reviewItems.length}件を読み、正式見積へ反映する判断をしました。
          </span>
        </label>
      ) : null}

      {error ? <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p> : null}

      <div className="flex justify-end">
        <button
          type="button"
          disabled={!canSend}
          onClick={handleIssue}
          className="inline-flex h-11 items-center gap-2 rounded-full bg-pink-500 px-5 text-sm font-bold text-white hover:bg-pink-600 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {sending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Mail className="h-4 w-4" aria-hidden />}
          {sending ? "発行しています" : `正式見積 ${formatYen(suggestion.total)} を発行`}
        </button>
      </div>
    </section>
  );
}
