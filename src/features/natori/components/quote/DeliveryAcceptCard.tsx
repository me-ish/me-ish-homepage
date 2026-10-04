"use client";

// features/natori/components/quote/DeliveryAcceptCard.tsx
// 納品ページの本体。納品ファイルのダウンロードと「受け取りました」ボタンを表示し、
// 押下で /api/natori/delivery/accept へ POST して検収を確定する。
// リンクを開いただけでは何も確定しない（確定は必ずこのボタンの POST）。
import { natoriPrimaryActionClassName } from "@/features/natori/constants/natoriPrimaryAction";
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CircleCheck, Download, FileImage, FileX, RefreshCw } from "lucide-react";
import { natoriClientUi as ui } from "@/features/natori/constants/clientUi";
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
    <div className={ui.card}>
      <p className={`${ui.small} ${ui.muted}`}>
        {clientName} 様
      </p>
      <p className={`mt-1 text-[18px] font-bold leading-8 text-balance sm:text-[20px] ${ui.phrase}`}>「{title}」の完成データをお届けします。</p>

      {/* 納品ファイル */}
      <div className="mt-6">
        <p className={ui.label}>
          納品ファイル
        </p>
        {files.length === 0 ? (
          <p className={`mt-2 rounded-2xl bg-[#FFF8FA] px-4 py-3 ${ui.body} ${ui.muted}`}>
            ダウンロードできるファイルが見つかりません。お手数ですが、納品メールに
            ご返信ください。
          </p>
        ) : (
          <ul className="mt-2 space-y-2">
            {files.map((file) => (
              <li key={file.id ?? file.fileName}>
                {file.url ? <a
                  href={file.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`flex items-center gap-3 rounded-2xl border border-[#F2D9E0] bg-white p-3 transition-colors hover:border-[#EC4899]/40 hover:bg-[#FFF8FA] ${ui.focus}`}
                >
                  <span aria-hidden="true" className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#FFF0F6] text-[#BE185D]">
                    <FileImage className="h-5 w-5" />
                  </span>
                  <span className="min-w-0 flex-1 break-all text-[15px] font-bold leading-6">{file.fileName}</span>
                  <span
                    className={`${natoriPrimaryActionClassName} inline-flex shrink-0 items-center gap-1 rounded-full px-3 py-1.5 text-[13px] font-bold leading-5`}
                  >
                    <Download className="h-3.5 w-3.5" aria-hidden="true" />
                    保存 {file.sizeBytes > 0 ? `(${formatBytes(file.sizeBytes)})` : ""}
                  </span>
                </a> : <div className="flex items-center gap-3 rounded-2xl border border-dashed border-[#F7C9C4] bg-[#FEF3F2] p-3">
                  <span aria-hidden="true" className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white text-[#B42318]">
                    <FileX className="h-5 w-5" />
                  </span>
                  <div className="min-w-0">
                    <span className="break-all text-[15px] font-bold leading-6">{file.fileName}</span>
                    <p className="mt-0.5 text-[13px] font-bold leading-5 text-[#B42318]">このファイルを取得できません。</p>
                  </div>
                </div>}
              </li>
            ))}
          </ul>
        )}
      </div>
      {expiresAt && <p className={`mt-3 ${ui.small} ${ui.muted}`}>保存期限：{formatDate(expiresAt)}まで。リンクはこのページを更新すると再取得できます。期限までにお手元へ保存してください。</p>}
      {canAccept !== undefined && <button type="button" disabled={refreshing || status === "sending"}
        className={`mt-4 w-full ${ui.btnSecondary}`}
        onClick={() => startRefresh(() => router.refresh())}><RefreshCw className={`h-4 w-4 ${refreshing ? "motion-safe:animate-spin" : ""}`} aria-hidden="true" />{refreshing ? "更新中…" : "ファイルと受取状況を更新"}</button>}

      <div className="mt-6 border-t border-[#F6E3E9] pt-6">
        {status === "accepted" ? (
          <div
            ref={resultRef}
            role="status"
            tabIndex={-1}
            className={`${ui.alertSuccess} text-center focus:outline-none`}
          >
            <CircleCheck className="mx-auto mb-2 h-8 w-8" aria-hidden="true" />
            受け取りを確認しました。ありがとうございました！
            {confirmedAt ? (
              <span className="mt-1 block text-[13px] font-normal">
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
              className={ui.btnPrimary}
            >
              {status === "sending" ? "確認中…" : canAccept === undefined ? "受け取りました" : "内容を確認し、受け取りを完了する"}
            </button>
            {canAccept === false && <p role="alert" className={`mt-3 ${ui.alertError}`}>{blockedReason ?? "ファイルの取得を確認できないため、受取を完了できません。"}</p>}
            <p className={`mt-3 text-center ${ui.phrase} ${ui.small} ${ui.muted}`}>
              ファイルをダウンロードして内容をご確認のうえ、ボタンを押してください。
              <br />
              ご不明な点は納品メールへの返信でお知らせください。
            </p>
            {status === "error" ? (
              <div ref={resultRef} role="alert" tabIndex={-1} className={`mt-3 text-center focus:outline-none ${ui.alertError}`}>{message}</div>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
