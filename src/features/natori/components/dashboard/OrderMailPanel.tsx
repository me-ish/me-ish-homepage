"use client";

// features/natori/components/dashboard/OrderMailPanel.tsx
// 依頼者へ見積もりメール / 支払い依頼メールを送るモーダル。
// 定型文を下書きとして生成し、編集してから /api/natori/admin/order-mail で送信する。
// 支払い依頼は送信時にサーバーで Stripe 支払いリンクが生成され、
// 本文の {支払いリンク} の位置に差し込まれる。
import { useMemo, useState } from "react";
import { AlertTriangle, Loader2, Mail, RotateCcw, X } from "lucide-react";
import { CSRF_HEADERS } from "@/lib/auth/csrf";
import { parseInquiryNote } from "@/features/natori/lib/inquiryNoteView";
import {
  PAYMENT_LINK_PLACEHOLDER,
  buildEstimateMailDraft,
  buildPaymentMailDraft,
  extractClientEmailFromNote,
  type NatoriOrderMailDraft,
} from "@/features/natori/lib/orderMail";
import { formatYen } from "@/features/natori/lib/pricing";
import type { NatoriProject } from "@/features/natori/types/projects";

export type OrderMailKind = "estimate" | "payment";

const KIND_META: Record<
  OrderMailKind,
  { title: string; hint: string; sendLabel: string }
> = {
  estimate: {
    title: "見積もりメールを送る",
    hint: "送信すると案件は「見積もり提示済み」に進みます。依頼者が返信すると、フォーム通知と同じアドレスに届きます。",
    sendLabel: "見積もりメールを送信",
  },
  payment: {
    title: "支払い依頼メールを送る",
    hint: `送信時に Stripe のカード決済リンクが自動生成され、本文の ${PAYMENT_LINK_PLACEHOLDER} の位置に差し込まれます。入金があると案件は自動で「ラフ」に進み、通知メールが届きます。`,
    sendLabel: "支払いリンクを作って送信",
  },
};

function buildDraft(
  kind: OrderMailKind,
  project: NatoriProject,
  amount: number,
  breakdownLines?: string[]
): NatoriOrderMailDraft {
  const input = { clientName: project.clientName, title: project.title, amount };
  return kind === "estimate"
    ? buildEstimateMailDraft({ ...input, breakdownLines })
    : buildPaymentMailDraft(input);
}

const inputClass =
  "w-full rounded-lg border border-pink-200 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-pink-300";
const labelClass = "mb-1 block text-xs font-bold text-pink-700";

type OrderMailPanelProps = {
  project: NatoriProject;
  kind: OrderMailKind;
  /** 見積もりツールなどから渡す初期金額（省略時は案件の金額） */
  initialAmount?: number;
  /** 見積もりツールから渡す内訳行。定型文の金額の下に入る（estimate のみ） */
  breakdownLines?: string[];
  onClose: () => void;
  /** 送信成功後に呼ばれる（案件一覧の再読み込み用） */
  onSent: () => void;
};

export default function OrderMailPanel({
  project,
  kind,
  initialAmount,
  breakdownLines,
  onClose,
  onSent,
}: OrderMailPanelProps) {
  const meta = KIND_META[kind];
  const startAmount = initialAmount ?? project.amount;
  const [to, setTo] = useState(extractClientEmailFromNote(project.note) ?? "");
  const [amount, setAmount] = useState<number>(startAmount);
  const [draft, setDraft] = useState<NatoriOrderMailDraft>(() =>
    buildDraft(kind, project, startAmount, breakdownLines)
  );
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sentLinkUrl, setSentLinkUrl] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  // 同種メールの送信履歴（案件メモの送信ログから）。二重送信の気づき用
  const lastSent = useMemo(() => {
    const label = kind === "estimate" ? "見積もりメール送信" : "支払い依頼メール送信";
    const logs = parseInquiryNote(project.note).logs.filter((log) => log.label === label);
    return logs.length > 0 ? logs[logs.length - 1] : null;
  }, [project.note, kind]);

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to.trim());
  const amountValid = Number.isFinite(amount) && amount >= (kind === "payment" ? 50 : 0);
  const canSend =
    emailValid && amountValid && draft.subject.trim() && draft.body.trim() && !sending;

  const regenerate = () => {
    setDraft(buildDraft(kind, project, Number.isFinite(amount) ? amount : 0, breakdownLines));
  };

  const handleSend = async () => {
    if (!canSend) return;
    setSending(true);
    setError(null);
    try {
      const res = await fetch("/api/natori/admin/order-mail", {
        method: "POST",
        headers: { ...CSRF_HEADERS, "Content-Type": "application/json" },
        body: JSON.stringify({
          kind,
          projectId: project.id,
          to: to.trim(),
          subject: draft.subject.trim(),
          body: draft.body,
          amount: Math.round(amount),
        }),
      });
      const json = (await res.json().catch(() => null)) as {
        ok?: boolean;
        error?: string;
        paymentLinkUrl?: string | null;
      } | null;
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error ?? `send failed: ${res.status}`);
      }
      setSentLinkUrl(json.paymentLinkUrl ?? null);
      setSent(true);
      onSent();
    } catch (err) {
      console.error("[OrderMailPanel] send failed", err);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSending(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-gray-900/60 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={meta.title}
    >
      <div className="w-full max-w-2xl rounded-2xl border border-pink-100 bg-white p-4 shadow-xl sm:p-5">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="flex items-center gap-2 text-base font-black text-gray-900">
              <Mail className="h-4 w-4 text-pink-500" aria-hidden />
              {meta.title}
            </h2>
            <p className="mt-0.5 break-words text-xs text-gray-600">
              {project.clientName}｜{project.title}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-gray-200 bg-white text-gray-500 hover:bg-gray-50"
            aria-label="閉じる"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>

        {sent ? (
          <div className="space-y-3">
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">
              送信しました。{kind === "estimate" ? "案件は「見積もり提示済み」に進みました。" : "案件は「入金待ち」に進みました。入金があると自動で「ラフ」になります。"}
            </div>
            {sentLinkUrl ? (
              <div className="rounded-xl border border-pink-100 bg-pink-50/50 px-4 py-3 text-xs">
                <p className="font-bold text-pink-700">発行した支払いリンク</p>
                <a
                  href={sentLinkUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 block break-all text-pink-600 underline"
                >
                  {sentLinkUrl}
                </a>
                <p className="mt-1 text-gray-500">案件メモにも記録済みです。</p>
              </div>
            ) : null}
            <div className="flex justify-end">
              <button
                type="button"
                onClick={onClose}
                className="inline-flex h-10 items-center rounded-full bg-pink-500 px-5 text-sm font-bold text-white hover:bg-pink-600"
              >
                閉じる
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {lastSent ? (
              <p className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-bold leading-5 text-amber-900">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                <span>
                  この案件には {lastSent.dateISO.replace(/-/g, "/")} に
                  {kind === "estimate" ? "見積もりメール" : "支払い依頼メール"}
                  を送信済みです。再送する場合はそのまま続けてください。
                </span>
              </p>
            ) : null}
            <p className="rounded-xl border border-sky-100 bg-sky-50 px-3 py-2 text-xs leading-5 text-sky-900">
              {meta.hint}
            </p>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor="om-to" className={labelClass}>
                  宛先（依頼者のメール）
                </label>
                <input
                  id="om-to"
                  type="email"
                  value={to}
                  onChange={(event) => setTo(event.target.value)}
                  placeholder="client@example.com"
                  className={inputClass}
                />
                {!to ? (
                  <p className="mt-1 text-[11px] text-gray-500">
                    案件メモから自動で拾えなかった場合は手入力してください。
                  </p>
                ) : null}
              </div>
              <div>
                <label htmlFor="om-amount" className={labelClass}>
                  金額（円・案件にも保存されます）
                </label>
                <div className="flex items-center gap-2">
                  <input
                    id="om-amount"
                    type="number"
                    min={0}
                    value={Number.isFinite(amount) ? amount : 0}
                    onChange={(event) => setAmount(Number(event.target.value))}
                    className={`${inputClass} text-right`}
                  />
                  <button
                    type="button"
                    onClick={regenerate}
                    className="inline-flex h-9 shrink-0 items-center gap-1 rounded-full border border-pink-200 bg-white px-3 text-xs font-bold text-pink-700 hover:bg-pink-50"
                    title="この金額で件名・本文を作り直します（編集内容は上書きされます）"
                  >
                    <RotateCcw className="h-3.5 w-3.5" aria-hidden />
                    定型文を再生成
                  </button>
                </div>
                {kind === "payment" && Number.isFinite(amount) && amount < 50 ? (
                  <p className="mt-1 text-[11px] font-bold text-red-600">
                    カード決済は50円以上から利用できます。
                  </p>
                ) : null}
              </div>
            </div>

            <div>
              <label htmlFor="om-subject" className={labelClass}>
                件名
              </label>
              <input
                id="om-subject"
                type="text"
                value={draft.subject}
                maxLength={200}
                onChange={(event) => setDraft((cur) => ({ ...cur, subject: event.target.value }))}
                className={inputClass}
              />
            </div>

            <div>
              <label htmlFor="om-body" className={labelClass}>
                本文
              </label>
              <textarea
                id="om-body"
                value={draft.body}
                rows={14}
                maxLength={8000}
                onChange={(event) => setDraft((cur) => ({ ...cur, body: event.target.value }))}
                className={`${inputClass} leading-6`}
              />
              {kind === "payment" && !draft.body.includes(PAYMENT_LINK_PLACEHOLDER) ? (
                <p className="mt-1 text-[11px] font-bold text-amber-600">
                  本文に {PAYMENT_LINK_PLACEHOLDER} がありません。この場合、支払いリンクは本文の末尾に追記されます。
                </p>
              ) : null}
            </div>

            {error ? (
              <p
                className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold text-red-700"
                role="alert"
              >
                送信に失敗しました: {error}
              </p>
            ) : null}

            <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
              <p className="mr-auto text-[11px] text-gray-500">
                送信金額: {formatYen(Number.isFinite(amount) ? Math.round(amount) : 0)}
              </p>
              <button
                type="button"
                onClick={onClose}
                disabled={sending}
                className="inline-flex h-10 items-center rounded-full border border-gray-300 bg-white px-4 text-sm font-bold text-gray-700 hover:bg-gray-50 disabled:opacity-60"
              >
                キャンセル
              </button>
              <button
                type="button"
                onClick={handleSend}
                disabled={!canSend}
                className="inline-flex h-10 items-center gap-2 rounded-full bg-pink-500 px-5 text-sm font-bold text-white hover:bg-pink-600 disabled:opacity-50"
              >
                {sending ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                ) : (
                  <Mail className="h-4 w-4" aria-hidden />
                )}
                {sending ? "送信中…" : meta.sendLabel}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
