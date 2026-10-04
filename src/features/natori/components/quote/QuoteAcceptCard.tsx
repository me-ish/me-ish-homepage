"use client";

// features/natori/components/quote/QuoteAcceptCard.tsx
// 見積もり承諾ページの本体。最終確認事項と規約確認を表示し、
// 「この内容で依頼を確定する」の POST で契約承諾を確定する。
import Link from "next/link";
import type { NatoriPaymentOverview } from "@/features/natori/types/payment";
import { useState } from "react";
import { formatYen } from "@/features/natori/lib/pricing";
import { natoriClientUi as ui } from "@/features/natori/constants/clientUi";
import { CSRF_HEADERS } from "@/lib/auth/csrf";
import { formatQuoteDate, type NatoriQuoteTerms } from "@/features/natori/lib/quoteTerms";

type Props = {
  payment?: NatoriPaymentOverview;
  token: string;
  title: string;
  clientName: string;
  amount: number;
  acceptedAt: string | null;
  expiresAt: string;
  terms?: NatoriQuoteTerms | null;
  preview?: boolean;
  version?: number;
  items?: { label: string; quantity: number; amount: number }[];
};

type Status = "idle" | "sending" | "accepted" | "error";

const JAPAN_DATE_FORMATTER = new Intl.DateTimeFormat("ja-JP", {
  timeZone: "Asia/Tokyo",
  year: "numeric",
  month: "numeric",
  day: "numeric",
});

function formatDate(iso: string): string {
  const parts = JAPAN_DATE_FORMATTER.formatToParts(new Date(iso));
  const value = (type: "year" | "month" | "day") =>
    parts.find((part) => part.type === type)?.value ?? "";
  return `${value("year")}年${value("month")}月${value("day")}日`;
}

function formatPaymentDeadline(iso: string): string {
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return "期限を確認できません。担当者にお問い合わせください。";
  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo", dateStyle: "medium", timeStyle: "short",
  }).format(date) + "（日本時間）";
}

// Each condition stays one <div><dt/><dd/></div> so a label always finds its own value.
const row = "grid gap-1 py-3 sm:grid-cols-[11rem_1fr] sm:gap-4";
const value = "min-w-0 whitespace-pre-wrap break-words text-[15px] leading-7";

export default function QuoteAcceptCard({
  token,
  title,
  clientName,
  amount,
  acceptedAt,
  expiresAt,
  terms,
  preview = false,
  items = [],
  version,
  payment,
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
    <div className={ui.card}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className={`${ui.small} ${ui.muted}`}>
          {clientName} 様
        </p>
        {version ? <p className={ui.badge}>正式見積り 第{version}版</p> : null}
      </div>

      <h2 className={`mt-3 ${ui.heading}`}>
        {terms ? "ご依頼内容をご確認ください" : "お申込み内容の最終確認"}
      </h2>

      {/* 金額・納品日・期限を最初にまとめて見せる */}
      <dl className={`mt-4 grid gap-4 p-4 sm:grid-cols-2 sm:p-5 ${ui.panel}`}>
        <div className="border-b border-[#F2D9E0] pb-4 sm:col-span-2">
          <dt className={ui.label}>{terms ? "お支払い金額" : "お支払い総額"}</dt>
          <dd className="mt-0.5 text-[30px] font-bold leading-tight tracking-tight text-[#BE185D] tabular-nums">
            {formatYen(amount)}
          </dd>
        </div>
        {terms ? (
          <div>
            <dt className={ui.label}>納品日</dt>
            <dd className="mt-0.5 text-[16px] font-bold leading-7">{formatQuoteDate(terms.dueDate)}まで</dd>
          </div>
        ) : null}
        <div>
          <dt className={ui.label}>{terms ? "このお見積もりの期限" : "申込期限"}</dt>
          <dd className="mt-0.5 text-[16px] font-bold leading-7">{formatDate(expiresAt)}まで</dd>
        </div>
      </dl>

      <dl className={`mt-2 ${ui.divider}`}>
        <div className={row}>
          <dt className={ui.label}>ご依頼内容</dt>
          <dd className={`${value} font-bold`}>{title}</dd>
        </div>
        <div className={row}>
          <dt className={ui.label}>{terms ? "制作するもの" : "役務の分量"}</dt>
          <dd className={value}>
            {terms?.deliverables ?? "上記内容のイラスト制作 1案件"}
          </dd>
        </div>
        {terms ? ([
          ["制作範囲", terms.scope], ["用途", terms.usage],
          ["商用利用", terms.commercialUse], ["実績公開", terms.publication],
        ] as const).filter(([, text]) => text).map(([label, text]) => (
          <div key={label} className={row}>
            <dt className={ui.label}>{label}</dt>
            <dd className={value}>{text}</dd>
          </div>
        )) : null}
        {items.length > 0 ? <div className={row}>
          <dt className={ui.label}>金額の内訳</dt>
          <dd className="min-w-0 text-[15px] leading-7"><ul className="space-y-1">{items.map((item, index) => (
            <li key={`${index}-${item.label}`} className="flex items-baseline justify-between gap-4">
              {/* No-break spaces keep "× 数量" with its label when the line wraps. */}
              <span className={`min-w-0 ${ui.phrase}`}>{item.label}{" × "}{item.quantity}</span>
              <span className="shrink-0 tabular-nums">{formatYen(item.amount)}</span>
            </li>
          ))}</ul></dd>
        </div> : null}
        <div className={row}>
          <dt className={ui.label}>お支払い方法</dt>
          <dd className={value}>
            {terms ? "クレジットカード決済" : "Stripeによるカード決済"}
          </dd>
        </div>
        <div className={row}>
          <dt className={ui.label}>{payment?.linkState ? status === "accepted" ? "承諾時のお支払条件" : "お見積りの支払条件" : "お支払い期限"}</dt>
          <dd className={value}>
            {terms ? "お支払いのご案内メールをお送りしてから7日以内" : "支払い案内メール送信日から7日以内"}
          </dd>
        </div>
        {payment?.linkState ? (
          <div className={row}>
            <dt className={ui.label}>現在の支払期限</dt>
            <dd className={`${value} font-bold`}>
              {payment.linkDeadline ? formatPaymentDeadline(payment.linkDeadline) : "お支払案内の発行後に確定します"}
              <span className={`mt-1 block font-normal ${ui.small} ${ui.muted}`}>
                上記はお見積り発行時の条件です。現在の期限はこの欄でご確認ください。
                再通知では期限は延長されません。担当者が期限を延長した場合は、この欄に反映します。
              </span>
            </dd>
          </div>
        ) : null}
        <div className={row}>
          <dt className={ui.label}>{terms ? "制作・納品について" : "役務の提供時期"}</dt>
          <dd className={value}>
            {terms
              ? "ご入金を確認してから制作を開始し、上記の納品日までに納品します。"
              : "入金確認後に制作を開始し、通常は約1か月で納品します。お見積もりに別の納期が記載されている場合は、その条件を優先します。"}
          </dd>
        </div>
        <div className={row}>
          <dt className={ui.label}>{terms ? "キャンセル・返金について" : "キャンセル"}</dt>
          <dd className={value}>
            {terms
              ? "ご依頼確定後のキャンセルは、メールでご連絡ください。ご入金後や制作開始後は、進み具合と完了した作業を確認したうえで、返金できるかどうかと金額をご案内します。完了した作業に応じた費用をお願いする場合があります。"
              : "契約成立後はメールでご連絡ください。入金後または制作開始後は、進行状況や実施済み作業等を確認し、返金の可否・精算額を個別にご案内します。実施済み作業相当の費用をご負担いただく場合があります。"}
          </dd>
        </div>
      </dl>

      {preview ? (
        <p className="mt-4 rounded-2xl bg-[#F6F4F5] px-4 py-3 text-[14px] font-bold leading-6 text-[#6B6470]">
          これは送信前のプレビューです。依頼者には承諾ボタンも表示されます。
        </p>
      ) : status === "accepted" ? (
        <div className={`mt-4 px-5 py-6 text-center ${ui.panel}`}>
          <p className="mb-2 text-3xl" aria-hidden="true">🎉</p>
          <p className="mb-2 text-[17px] font-bold leading-7">ご依頼の確定ありがとうございます!</p>
          <p className={`${ui.phrase} ${ui.small} ${ui.muted}`}>
            {acceptedAt ? `${formatDate(acceptedAt)}にご承諾いただいています。` : ""}
            {payment?.available === false ? "入金状況を確認できませんでした。再読み込みするか、担当者へメールでお問い合わせください。"
              : payment?.confirmedAt ? "入金確認済みです。支払案内をお待ちいただく必要はありません。次の確認事項は担当者からご案内します。"
              : payment?.requiresReview ? "お支払いの記録を担当者が照合しています。追加のお支払いはせず、メールでお問い合わせください。"
              : payment?.linkState === "terminal" ? "この案件は終了しています。新しいお支払いはせず、元のメールへの返信で担当者にお問い合わせください。"
              : ["inactive","stop_required","deactivating"].includes(payment?.linkState ?? "") ? "お支払いリンクは停止済み、または停止確認中です。新しいご案内が必要な場合は元のメールへご返信ください。"
              : payment?.linkState === "active" ? "お支払い案内をご確認ください。再通知で支払期限は延長されません。すでにお支払い済みの場合は追加のお支払いをせず、担当者へお問い合わせください。"
              : payment?.linkState === "creating" ? "お支払い案内の発行結果を確認中です。案内が届くまでお待ちください。お問い合わせは元のメールへの返信でご連絡ください。"
              : payment?.processing ? "入金の確認処理中です。追加のお支払いはせず、再読み込みして状況をご確認ください。"
              : "お支払いのご案内をメールでお送りしますので、今しばらくお待ちください。"}
            {payment?.confirmedAt && payment.requiresReview ? <span className="mt-2 block font-bold text-[#8A4800]">お支払いの記録に確認が必要な項目があります。追加のお支払いはせず、担当者へメールでお問い合わせください。</span> : null}
          </p>
        </div>
      ) : (
        <div className={`mt-4 space-y-4 p-4 sm:p-5 ${ui.panel}`}>
          <p className={`${ui.small} ${ui.muted}`}>
            {terms
              ? "内容を変更したい場合は、依頼を確定する前にお見積もりメールへご返信ください。"
              : "このページで依頼を確定するまでは契約は成立しません。内容の変更をご希望の場合は、確定前にお見積もりメールへご返信ください。"}
          </p>

          <label className="flex cursor-pointer items-start gap-3 rounded-xl bg-white p-3 text-[14px] leading-6 ring-1 ring-inset ring-[#F2D9E0]">
            <input
              type="checkbox"
              checked={termsAccepted}
              onChange={(event) => setTermsAccepted(event.target.checked)}
              className="mt-0.5 h-5 w-5 shrink-0 accent-[#BE185D]"
            />
            <span>
              <Link
                href="/natori/legal/terms"
                target="_blank"
                rel="noopener noreferrer"
                className={ui.link}
              >
                ご依頼規約
              </Link>
              、
              <Link
                href="/natori/legal/tokushoho"
                target="_blank"
                rel="noopener noreferrer"
                className={ui.link}
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
            className={ui.btnPrimary}
          >
            {status === "sending" ? "送信中…" : "この内容で依頼を確定する"}
          </button>
          <p className={`text-center ${ui.phrase} ${ui.small} ${ui.muted}`}>
            ボタンを押すとご依頼が確定し、お支払いのご案内メールをお送りします。
            <br />
            内容のご調整をご希望の場合は、お見積もりメールにご返信ください。
          </p>
          {status === "error" ? (
            <p
              className={`text-center ${ui.alertError}`}
              role="alert"
            >
              送信に失敗しました。時間をおいて再度お試しいただくか、
              お見積もりメールへご返信ください。
            </p>
          ) : null}
        </div>
      )}
    </div>
  );
}
