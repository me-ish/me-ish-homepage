"use client";

// features/natori/components/quote/QuoteAcceptCard.tsx
// 見積もり承諾ページの本体。最終確認事項と規約確認を表示し、
// 「この内容で依頼を確定する」の POST で契約承諾を確定する。
import Link from "next/link";
import { useState } from "react";
import { formatYen } from "@/features/natori/lib/pricing";
import { legacyNatoriTransactionColors as c } from "@/features/natori/constants/portfolioContent";
import { CSRF_HEADERS } from "@/lib/auth/csrf";

type Props = {
  token: string;
  title: string;
  clientName: string;
  amount: number;
  acceptedAt: string | null;
  expiresAt: string;
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
  expiresAt,
}: Props) {
  const [status, setStatus] = useState<Status>(acceptedAt ? "accepted" : "idle");
  const [termsAccepted, setTermsAccepted] = useState(false);

  const handleAccept = async () => {
    if (status === "sending" || status === "accepted" || !termsAccepted) return;
    setStatus("sending");
    try {
      const res = await fetch("/api/natori/quote/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...CSRF_HEADERS },
        body: JSON.stringify({ token, termsAccepted: true }),
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

      <h2 className="mb-3 text-base font-black">お申込み内容の最終確認</h2>
      <div
        className="mb-6 rounded-xl border-2 p-4"
        style={{ borderColor: c.paperAlt }}
      >
        <dl className="space-y-3 text-sm">
          <div className="flex justify-between gap-4">
            <dt style={{ color: c.inkSoft }}>ご依頼内容</dt>
            <dd className="font-bold text-right">{title}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt style={{ color: c.inkSoft }}>役務の分量</dt>
            <dd className="font-bold text-right">上記内容のイラスト制作 1案件</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt style={{ color: c.inkSoft }}>お支払い総額</dt>
            <dd className="text-lg font-black" style={{ color: c.pinkDeep }}>
              {formatYen(amount)}
            </dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt style={{ color: c.inkSoft }}>お支払い方法</dt>
            <dd className="font-bold text-right">Stripeによるカード決済</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt style={{ color: c.inkSoft }}>お支払い期限</dt>
            <dd className="font-bold text-right">支払い案内メール送信日から7日以内</dd>
          </div>
          <div className="grid gap-1 sm:grid-cols-[7rem_1fr] sm:gap-4">
            <dt style={{ color: c.inkSoft }}>役務の提供時期</dt>
            <dd className="font-bold sm:text-right">
              入金確認後に制作を開始し、通常は約1か月で納品します。お見積もりに別の納期が記載されている場合は、その条件を優先します。
            </dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt style={{ color: c.inkSoft }}>申込期限</dt>
            <dd className="font-bold text-right">{formatDate(expiresAt)}まで</dd>
          </div>
          <div className="grid gap-1 sm:grid-cols-[7rem_1fr] sm:gap-4">
            <dt style={{ color: c.inkSoft }}>キャンセル</dt>
            <dd className="font-bold sm:text-right">
              契約成立後はメールでご連絡ください。入金後または制作開始後は、進行状況や実施済み作業等を確認し、返金の可否・精算額を個別にご案内します。実施済み作業相当の費用をご負担いただく場合があります。
            </dd>
          </div>
        </dl>
      </div>

      {status === "accepted" ? (
        <div className="text-center">
          <p className="mb-2 text-3xl" aria-hidden="true">🎉</p>
          <p className="mb-1 font-bold">ご依頼の確定ありがとうございます!</p>
          <p className="text-sm" style={{ color: c.inkSoft }}>
            {acceptedAt ? `${formatDate(acceptedAt)}にご承諾いただいています。` : ""}
            お支払いのご案内をメールでお送りしますので、今しばらくお待ちください。
          </p>
        </div>
      ) : (
        <>
          <div
            className="mb-4 rounded-xl px-4 py-3 text-xs leading-6"
            style={{ background: c.paperAlt, color: c.inkSoft }}
          >
            このページで依頼を確定するまでは契約は成立しません。内容の変更をご希望の場合は、確定前にお見積もりメールへご返信ください。
          </div>

          <label className="mb-4 flex cursor-pointer items-start gap-3 text-sm leading-6">
            <input
              type="checkbox"
              checked={termsAccepted}
              onChange={(event) => setTermsAccepted(event.target.checked)}
              className="mt-1 h-4 w-4 shrink-0"
            />
            <span>
              <Link
                href="/natori/legal/terms"
                target="_blank"
                rel="noopener noreferrer"
                className="font-bold underline underline-offset-4"
              >
                ご依頼規約
              </Link>
              、
              <Link
                href="/natori/legal/tokushoho"
                target="_blank"
                rel="noopener noreferrer"
                className="font-bold underline underline-offset-4"
              >
                特定商取引法に基づく表記
              </Link>
              および上記のお見積もり内容を確認しました。
            </span>
          </label>

          <button
            type="button"
            onClick={handleAccept}
            disabled={status === "sending" || !termsAccepted}
            className="w-full rounded-full py-3 font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
            style={{ background: c.pink }}
          >
            {status === "sending" ? "送信中…" : "この内容で依頼を確定する"}
          </button>
          <p className="mt-3 text-center text-xs" style={{ color: c.inkSoft }}>
            ボタンを押すとご依頼が確定し、お支払いのご案内メールをお送りします。
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
              お見積もりメールへご返信ください。
            </p>
          ) : null}
        </>
      )}
    </div>
  );
}
