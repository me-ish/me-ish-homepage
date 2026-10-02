"use client";

// features/natori/components/quote/DeliveryAcceptCard.tsx
// 納品ページの本体。納品ファイルのダウンロードと「受け取りました」ボタンを表示し、
// 押下で /api/natori/delivery/accept へ POST して検収を確定する。
// リンクを開いただけでは何も確定しない（確定は必ずこのボタンの POST）。
import { natoriPrimaryActionClassName } from "@/features/natori/constants/natoriPrimaryAction";
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { legacyNatoriTransactionColors as c } from "@/features/natori/constants/portfolioContent";
import { CSRF_HEADERS } from "@/lib/auth/csrf";

type DeliveryFileView = { id?: string; fileName: string; sizeBytes: number; url: string | null; available?: boolean };

type Props = {
  token: string;
  title: string;
  clientName: string;
  files: DeliveryFileView[];
  /** すでに受け取り確認済みならその日時（ISO）。ページ再訪時の表示用 */
  acceptedAt: string | null;
  canAccept?: boolean;
  expiresAt?: string;
  blockedReason?: string | null;
};

type Status = "idle" | "sending" | "accepted" | "error";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("ja-JP", { timeZone: "Asia/Tokyo" });
}

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)}KB`;
  return `${bytes}B`;
}

export default function DeliveryAcceptCard({
  token,
  title,
  clientName,
  files,
  acceptedAt,
  canAccept,
  expiresAt,
  blockedReason,
}: Props) {
  const [status, setStatus] = useState<Status>(acceptedAt ? "accepted" : "idle");
  const [confirmedAt, setConfirmedAt] = useState(acceptedAt);
  const [message, setMessage] = useState("");
  const resultRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const [refreshing, startRefresh] = useTransition();
  useEffect(() => { if (acceptedAt) { setConfirmedAt(acceptedAt); setStatus("accepted"); } }, [acceptedAt]);
  useEffect(() => { if (status === "accepted" || status === "error") resultRef.current?.focus(); }, [status]);

  const handleAccept = async () => {
    if (status === "sending" || status === "accepted" || canAccept === false) return;
    setStatus("sending");
    try {
      const res = await fetch("/api/natori/delivery/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...CSRF_HEADERS },
        body: JSON.stringify({ token }),
      });
      const json = await res.json().catch(() => null) as { acceptedAt?: string; error?: string } | null;
      if (!res.ok) {
        setMessage(json?.error === "delivery_files_unavailable" ? "ファイルを取得できないため、受取は完了していません。再取得をお試しいただくか、納品メールにご返信ください。"
          : "受取結果を確認できませんでした。「ファイルと受取状況を更新」で確認してください。");
        setStatus("error"); return;
      }
      if (json?.acceptedAt) setConfirmedAt(json.acceptedAt);
      setStatus("accepted");
    } catch (err) {
      console.error("[delivery-accept] result_unconfirmed");
      setMessage("受取結果を確認できませんでした。「ファイルと受取状況を更新」で確認してください。");
      setStatus("error");
    }
  };

  return (
    <div
      className="rounded-2xl p-6 md:p-8"
      style={{ background: c.card, boxShadow: "0 10px 22px rgba(45,42,61,0.10)" }}
    >
      <p className="mb-1 text-sm" style={{ color: c.inkSoft }}>
        {clientName} 様
      </p>
      <p className="mb-5 font-bold">「{title}」の完成データをお届けします。</p>

      {/* 納品ファイル */}
      <div className="mb-6 rounded-xl border-2 p-4" style={{ borderColor: c.paperAlt }}>
        <p className="mb-3 text-xs font-bold" style={{ color: c.inkSoft }}>
          納品ファイル
        </p>
        {files.length === 0 ? (
          <p className="text-sm" style={{ color: c.inkSoft }}>
            ダウンロードできるファイルが見つかりません。お手数ですが、納品メールに
            ご返信ください。
          </p>
        ) : (
          <ul className="space-y-2">
            {files.map((file) => (
              <li key={file.id ?? file.fileName}>
                {file.url ? <a
                  href={file.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between gap-3 rounded-lg border-2 px-3 py-2.5 text-sm font-bold transition hover:bg-white"
                  style={{ borderColor: c.paperAlt }}
                >
                  <span className="min-w-0 break-all">{file.fileName}</span>
                  <span
                    className={`${natoriPrimaryActionClassName} shrink-0 rounded-full px-2.5 py-1 text-xs font-bold`}
                  >
                    保存 {file.sizeBytes > 0 ? `(${formatBytes(file.sizeBytes)})` : ""}
                  </span>
                </a> : <div className="rounded-lg border-2 px-3 py-2.5 text-sm" style={{ borderColor: c.paperAlt }}>
                  <span className="break-all font-bold">{file.fileName}</span>
                  <p className="mt-1 text-xs text-red-700">このファイルを取得できません。</p>
                </div>}
              </li>
            ))}
          </ul>
        )}
      </div>
      {expiresAt && <p className="mb-3 text-sm" style={{ color: c.inkSoft }}>保存期限：{formatDate(expiresAt)}まで。リンクはこのページを更新すると再取得できます。期限までにお手元へ保存してください。</p>}
      {canAccept !== undefined && <button type="button" disabled={refreshing || status === "sending"}
        className="mb-5 w-full rounded-lg border px-3 py-3 text-sm font-bold disabled:opacity-50"
        onClick={() => startRefresh(() => router.refresh())}>{refreshing ? "更新中…" : "ファイルと受取状況を更新"}</button>}

      {status === "accepted" ? (
        <div
          ref={resultRef}
          role="status"
          tabIndex={-1}
          className="rounded-xl p-4 text-center text-sm font-bold"
          style={{ background: "#E9F8F1", color: "#0F4E40" }}
        >
          受け取りを確認しました。ありがとうございました！
          {confirmedAt ? (
            <span className="mt-1 block text-xs font-normal">
              （{formatDate(confirmedAt)} に確認済み）
            </span>
          ) : null}
        </div>
      ) : (
        <>
          <button
            type="button"
            onClick={handleAccept}
            disabled={status === "sending" || canAccept === false}
            className={`${natoriPrimaryActionClassName} w-full rounded-full py-3 font-bold shadow-md`}
          >
            {status === "sending" ? "確認中…" : canAccept === undefined ? "受け取りました" : "内容を確認し、受け取りを完了する"}
          </button>
          {canAccept === false && <p role="alert" className="mt-3 text-sm text-red-700">{blockedReason ?? "ファイルの取得を確認できないため、受取を完了できません。"}</p>}
          <p className="mt-3 text-center text-xs" style={{ color: c.inkSoft }}>
            ファイルをダウンロードして内容をご確認のうえ、ボタンを押してください。
            <br />
            ご不明な点は納品メールへの返信でお知らせください。
          </p>
          {status === "error" ? (
            <div ref={resultRef} role="alert" tabIndex={-1} className="mt-3 text-center text-xs font-bold" style={{ color: "#A03030" }}>{message}</div>
          ) : null}
        </>
      )}
    </div>
  );
}
