"use client";

// features/natori/components/quote/QuoteAcceptCard.tsx
// 見積もり承諾ページの本体。内容の要約と「この内容でお願いする」ボタンを表示し、
// 押下で /api/natori/quote/accept へ POST して承諾を確定する。
// リンクを開いただけでは何も確定しない（確定は必ずこのボタンの POST）。
import { useState } from "react";
import { formatYen } from "@/features/natori/lib/pricing";
import { portfolioColors as c } from "@/features/natori/constants/portfolioContent";
import { CSRF_HEADERS } from "@/lib/auth/csrf";

type Props = {
  token: string;
  title: string;
  clientName: string;
  amount: number;
  /** すでに承諾済みならその日時（ISO）。ページ再訪時の表示用 */
  acceptedAt: string | null;
};

type Status = "idle" | "sending" | "accepted" | "error";

function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
}

export default function QuoteAcceptCard({
  token,
  title,
  clientName,
  amount,
  acceptedAt,
}: Props) {
  const [status, setStatus] = useState<Status>(acceptedAt ? "accepted" : "idle");

  const handleAccept = async () => {
    if (status === "sending" || status === "accepted") return;
    setStatus("sending");
    try {
      const res = await fetch("/api/natori/quote/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...CSRF_HEADERS },
        body: JSON.stringify({ token }),
      });
      if (!res.ok) throw new Error(`accept failed: ${res.status}`);
      setStatus("accepted");
    } catch (err) {
      console.error("[quote-accept] failed", err);
      setStatus("error");
    }
  };

  return (
    <div
      className="rounded-2xl p-6 md:p-8"
      style={{ background: c.card, boxShadow: "0 10px 22px rgba(45,42,61,0.10)" }}
    >
      <p className="mb-4 text-sm" style={{ color: c.inkSoft }}>
        {clientName} 様
      </p>

      <div
        className="mb-6 rounded-xl border-2 p-4"
        style={{ borderColor: c.paperAlt }}
      >
        <dl className="space-y-2 text-sm">
          <div className="flex justify-between gap-4">
            <dt style={{ color: c.inkSoft }}>ご依頼内容</dt>
            <dd className="font-bold text-right">{title}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt style={{ color: c.inkSoft }}>お見積もり金額</dt>
            <dd className="text-lg font-black" style={{ color: c.pinkDeep }}>
              {formatYen(amount)}
            </dd>
          </div>
        </dl>
      </div>

      {status === "accepted" ? (
        <div className="text-center">
          <p className="mb-2 text-3xl" aria-hidden="true">
            🎉
          </p>
          <p className="mb-1 font-bold">ご承諾ありがとうございます!</p>
          <p className="text-sm" style={{ color: c.inkSoft }}>
            {acceptedAt ? `${formatDate(acceptedAt)}にご承諾いただいています。` : ""}
            お支払いのご案内をメールでお送りしますので、今しばらくお待ちください。
          </p>
        </div>
      ) : (
        <>
          <button
            type="button"
            onClick={handleAccept}
            disabled={status === "sending"}
            className="w-full rounded-full py-3 font-bold text-white disabled:opacity-50"
            style={{ background: c.pink }}
          >
            {status === "sending" ? "送信中…" : "この内容でお願いする"}
          </button>
          <p className="mt-3 text-center text-xs" style={{ color: c.inkSoft }}>
            ボタンを押すと承諾が確定し、お支払いのご案内メールをお送りします。
            <br />
            内容のご調整をご希望の場合は、お見積もりメールにご返信ください。
          </p>
          {status === "error" ? (
            <p
              className="mt-3 rounded-lg border-2 p-3 text-center text-sm font-bold"
              style={{ borderColor: c.peach, color: c.pinkDeep, background: "#FFF5F0" }}
              role="alert"
            >
              送信に失敗しました。時間をおいて再度お試しいただくか、
              お見積もりメールへの返信でご承諾ください。
            </p>
          ) : null}
        </>
      )}
    </div>
  );
}
