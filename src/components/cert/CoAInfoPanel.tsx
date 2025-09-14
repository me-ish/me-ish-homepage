"use client";

import * as React from "react";

type EntryLike = {
  title?: string | null;
  artist_name?: string | null;
  edition_no?: number | null;
  edition_total?: number | null;
  created_at?: string | null;
  confirmed_at?: string | null;
  purchased_at?: string | null;
  cert_id?: string | number | null;
  id?: string | number | null;
  token_id?: string | number | null;
  txhash?: string | null;
  chain?: string | null;
  network?: string | null;
};

type Props = {
  entry: EntryLike;
  showOnchain?: boolean;
  verifyUrl?: string;
  /** 左上ロゴ（SVG/PNG）。例: "/brand/me-ish.svg" */
  logoUrl?: string;
  /** 右下シールに使う画像（透過PNG推奨・任意） */
  sealUrl?: string;
  /** アクセントカラー（ブランド色） */
  accent?: string; // default "#00a1e9"
  /** 発行者表記 */
  issuerName?: string; // default "me-ish"
  /** 透かしロゴの不透明度（0.0-1.0） */
  watermarkOpacity?: number; // default 0.06
};

function fmtDate(d?: string | null) {
  if (!d) return "";
  try {
    return new Date(d).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "2-digit",
    });
  } catch {
    return "";
  }
}

function shortHash(h?: string | null, len = 10) {
  if (!h) return "";
  const s = h.replace(/^0x/i, "");
  return s.length > len ? `0x${s.slice(0, len)}…` : `0x${s}`;
}

export default function CoAInfoPanel({
  entry,
  showOnchain = false,
  verifyUrl,
  logoUrl,
  sealUrl,
  accent = "#00a1e9",
  issuerName = "me-ish",
  watermarkOpacity = 0.06,
}: Props) {
  const title = entry.title ?? "(Untitled)";
  const artist = entry.artist_name ?? "Unknown Artist";
  const editionNo =
    typeof entry.edition_no === "number" ? entry.edition_no : undefined;
  const editionTotal =
    typeof entry.edition_total === "number" ? entry.edition_total : undefined;
  const editionText =
    editionNo && editionTotal
      ? `${editionNo} / ${editionTotal}`
      : editionNo
      ? String(editionNo)
      : editionTotal
      ? `of ${editionTotal}`
      : "—";
  const issuedAt =
    entry.purchased_at ?? entry.confirmed_at ?? entry.created_at ?? null;
  const certNo = entry.cert_id ?? entry.id ?? "";
  const chain =
    (entry.chain || entry.network || "").toString().trim() || undefined;
  const tokenId =
    typeof entry.token_id === "number" || typeof entry.token_id === "string"
      ? String(entry.token_id)
      : undefined;
  const tx = entry.txhash ?? undefined;

  return (
    <div
      className="text-[#111] bg-white rounded-[18px] shadow-sm print:shadow-none"
      style={{ borderTop: `6px solid ${accent}` }}
    >
      {/* 二重枠 */}
      <div className="relative rounded-[16px] border border-[#e5e7eb]">
        <div className="pointer-events-none absolute inset-3 rounded-[12px] border border-[#e5e7eb]" />

        {/* 透かし（ロゴがあればロゴ、なければ文字） */}
        <div className="pointer-events-none absolute inset-0 grid place-items-center">
          {logoUrl ? (
            <img
              src={logoUrl}
              alt="me-ish watermark"
              className="select-none -rotate-12"
              style={{ width: 420, opacity: watermarkOpacity }}
            />
          ) : (
            <div
              className="select-none -rotate-12 font-semibold tracking-[0.08em] text-black/5 print:text-black/10"
              style={{ fontSize: 72 }}
            >
              me-ish
            </div>
          )}
        </div>

        <div className="relative p-8 md:p-10">
          {/* ブランドヘッダ */}
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              {logoUrl ? (
                <img
                  src={logoUrl}
                  alt="me-ish"
                  className="h-8 w-auto print:opacity-90"
                />
              ) : (
                <div
                  className="font-bold leading-none"
                  style={{ color: accent }}
                >
                  me-ish
                </div>
              )}
              <span
                className="rounded-full px-2 py-1 text-[10px] font-semibold tracking-wide"
                style={{ backgroundColor: accent, color: "#fff" }}
              >
                Official
              </span>
            </div>
            <div className="text-right">
              <div className="text-[13px] tracking-[0.38em] uppercase text-[#6b7280]">
                Certificate of
              </div>
              <h1 className="font-serif text-3xl md:text-[34px] font-semibold tracking-wide">
                Authenticity
              </h1>
            </div>
          </div>

          {/* 細いアクセントライン */}
          <div
            className="mt-6 h-[2px] w-full rounded-full"
            style={{ backgroundColor: accent }}
          />

          {/* 作品情報 */}
          <section className="mt-8 rounded-xl border border-[#eef2f5]">
            <Row label="Title" right={title} />
            <Divider />
            <Row label="Artist" right={artist} />
            <Divider />
            <Row label="Edition" right={editionText} />
          </section>

          {/* 署名 / 発行情報 */}
          <section className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-2">
            <div className="rounded-xl border border-[#eef2f5] p-4">
              <div className="text-[11px] tracking-wide text-[#6b7280]">
                Authorized Signature
              </div>
              <div className="mt-6 h-[42px] border-b border-dashed border-[#cbd5e1]" />
              <div className="mt-1 text-[11px] text-[#6b7280]">{issuerName}</div>
            </div>

            <div className="rounded-xl border border-[#eef2f5] p-4">
              <InfoItem k="Certificate #" v={String(certNo || "—")} />
              <InfoItem k="Issued On" v={fmtDate(issuedAt) || "—"} />
              {verifyUrl ? <InfoItem k="Verify" v={verifyUrl} mono /> : null}
            </div>
          </section>

          {/* オンチェーン情報 */}
          {showOnchain ? (
            <section
              className="mt-6 rounded-xl p-4"
              style={{ backgroundColor: "#f0fbff", border: `1px solid ${accent}33` }}
            >
              <div
                className="text-[11px] font-semibold tracking-wide"
                style={{ color: accent }}
              >
                On-chain Record
              </div>
              <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-3">
                <SmallKV k="Network" v={chain || "—"} />
                <SmallKV k="Token ID" v={tokenId || "—"} mono />
                <SmallKV k="Tx" v={shortHash(tx, 12) || "—"} mono />
              </div>
              <p className="mt-2 text-[11px] text-[#0b5d7a]">
                The information above indicates the minted token recorded on the
                blockchain.
              </p>
            </section>
          ) : null}

          {/* 認証シール */}
          <div className="mt-8 flex items-center justify-end">
            <div
              className="relative h-16 w-16 rounded-full shadow-sm"
              style={{
                background:
                  `conic-gradient(from 180deg at 50% 50%, ${accent} 0deg, #0a4254 320deg)`,
              }}
            >
              <div className="absolute inset-[2px] rounded-full bg-white" />
              <div className="relative grid h-full w-full place-items-center">
                {sealUrl ? (
                  <img
                    src={sealUrl}
                    alt="seal"
                    className="h-8 w-8 opacity-90"
                  />
                ) : (
                  <span
                    className="text-[10px] font-bold tracking-wider"
                    style={{ color: accent }}
                  >
                    CERT
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------- sub components ---------- */

function Divider() {
  return <div className="h-px w-full bg-[#f1f5f9]" />;
}

function Row({ label, right }: { label: string; right: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[140px_1fr] items-center gap-3 px-5 py-4 text-sm md:text-[15px]">
      <div className="text-[11px] tracking-wide text-[#6b7280]">{label}</div>
      <div className="flex items-baseline justify-between gap-3">
        <div className="font-medium">{right}</div>
      </div>
    </div>
  );
}

function InfoItem({
  k,
  v,
  mono = false,
}: {
  k: string;
  v: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="mt-2 first:mt-0">
      <div className="text-[10px] uppercase tracking-[0.18em] text-[#6b7280]">
        {k}
      </div>
      <div
        className={[
          "mt-1 text-[13px]",
          mono ? "font-mono tabular-nums tracking-wide" : "font-medium",
        ].join(" ")}
      >
        {v}
      </div>
    </div>
  );
}

function SmallKV({
  k,
  v,
  mono = false,
}: {
  k: string;
  v: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-[0.18em] text-[#0b5d7a]">
        {k}
      </div>
      <div
        className={[
          "mt-1 text-[12px]",
          mono ? "font-mono tabular-nums tracking-wide" : "font-medium",
        ].join(" ")}
      >
        {v}
      </div>
    </div>
  );
}
