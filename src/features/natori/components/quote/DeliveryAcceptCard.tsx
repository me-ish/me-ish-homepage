"use client";

// features/natori/components/quote/DeliveryAcceptCard.tsx
// 納品ページの本体。納品ファイルのダウンロードと「受け取りました」ボタンを表示し、
// 押下で /api/natori/delivery/accept へ POST して検収を確定する。
// リンクを開いただけでは何も確定しない（確定は必ずこのボタンの POST）。
import { useState } from "react";
import { legacyNatoriTransactionColors as c } from "@/features/natori/constants/portfolioContent";
import { CSRF_HEADERS } from "@/lib/auth/csrf";

type DeliveryFileView = { fileName: string; sizeBytes: number; url: string };

type Props = {
  token: string;
  title: string;
  clientName: string;
  files: DeliveryFileView[];
  /** すでに受け取り確認済みならその日時（ISO）。ページ再訪時の表示用 */
  acceptedAt: string | null;
};

type Status = "idle" | "sending" | "accepted" | "error";

function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
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
}: Props) {
  const [status, setStatus] = useState<Status>(acceptedAt ? "accepted" : "idle");

  const handleAccept = async () => {
    if (status === "sending" || status === "accepted") return;
    setStatus("sending");
    try {
      const res = await fetch("/api/natori/delivery/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...CSRF_HEADERS },
        body: JSON.stringify({ token }),
      });
      if (!res.ok) throw new Error(`accept failed: ${res.status}`);
      setStatus("accepted");
    } catch (err) {
      console.error("[delivery-accept] failed", err);
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
              <li key={file.url}>
                <a
                  href={file.url}
                  className="flex items-center justify-between gap-3 rounded-lg border-2 px-3 py-2.5 text-sm font-bold transition hover:bg-white"
                  style={{ borderColor: c.paperAlt }}
                >
                  <span className="min-w-0 break-all">{file.fileName}</span>
                  <span
                    className="shrink-0 rounded-full px-2.5 py-1 text-xs font-bold text-white"
                    style={{ background: c.pink }}
                  >
                    保存 {file.sizeBytes > 0 ? `(${formatBytes(file.sizeBytes)})` : ""}
                  </span>
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>

      {status === "accepted" ? (
        <div
          className="rounded-xl p-4 text-center text-sm font-bold"
          style={{ background: "#E9F8F1", color: "#0F4E40" }}
        >
          受け取りを確認しました。ありがとうございました！
          {acceptedAt ? (
            <span className="mt-1 block text-xs font-normal">
              （{formatDate(acceptedAt)} に確認済み）
            </span>
          ) : null}
        </div>
      ) : (
        <>
          <button
            type="button"
            onClick={handleAccept}
            disabled={status === "sending"}
            className="w-full rounded-full py-3 font-bold text-white shadow-md hover:brightness-105 disabled:opacity-60"
            style={{ background: c.pink }}
          >
            {status === "sending" ? "確認中…" : "受け取りました"}
          </button>
          <p className="mt-3 text-center text-xs" style={{ color: c.inkSoft }}>
            ファイルをダウンロードして内容をご確認のうえ、ボタンを押してください。
            <br />
            ご不明な点は納品メールへの返信でお知らせください。
          </p>
          {status === "error" ? (
            <p className="mt-3 text-center text-xs font-bold" style={{ color: "#A03030" }}>
              確認の送信に失敗しました。時間をおいてもう一度お試しください。
            </p>
          ) : null}
        </>
      )}
    </div>
  );
}
