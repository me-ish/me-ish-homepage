"use client";

import * as React from "react";
import Image from "next/image";
import { Shield, CheckCircle2 } from "lucide-react";

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
  logoUrl?: string;
  sealUrl?: string;
  accent?: string;
  issuerName?: string;
  watermarkOpacity?: number;
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
  watermarkOpacity = 0.04,
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
    <div className="relative bg-white rounded-3xl overflow-hidden">
      {/* Top accent bar */}
      <div
        className="h-1.5 w-full"
        style={{ background: `linear-gradient(90deg, ${accent} 0%, ${accent}88 100%)` }}
      />

      {/* Main content */}
      <div className="relative p-8 md:p-12">
        {/* Watermark */}
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden">
          {logoUrl ? (
            <Image
              src={logoUrl}
              alt=""
              width={380}
              height={380}
              className="select-none -rotate-12 scale-150"
              style={{ opacity: watermarkOpacity }}
            />
          ) : (
            <div
              className="select-none -rotate-12 font-bold tracking-[0.1em]"
              style={{ fontSize: 96, color: `${accent}08` }}
            >
              me-ish
            </div>
          )}
        </div>

        {/* Header */}
        <header className="relative flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            {logoUrl ? (
              <Image src={logoUrl} alt={issuerName} width={100} height={28} className="h-7 w-auto" />
            ) : (
              <span className="font-bold text-xl" style={{ color: accent }}>
                {issuerName}
              </span>
            )}
            <span
              className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold tracking-wide text-white"
              style={{ backgroundColor: accent }}
            >
              <Shield className="w-3 h-3" />
              Verified
            </span>
          </div>

          <div className="text-right">
            <p className="text-[11px] font-medium tracking-[0.25em] uppercase text-gray-400">
              Certificate of
            </p>
            <h1 className="font-serif text-2xl md:text-3xl font-semibold tracking-wide text-gray-900 -mt-0.5">
              Authenticity
            </h1>
          </div>
        </header>

        {/* Divider */}
        <div className="relative mt-8 mb-10">
          <div className="h-px bg-gray-100" />
          <div
            className="absolute left-0 top-0 h-px w-24"
            style={{ backgroundColor: accent }}
          />
        </div>

        {/* Artwork Info */}
        <section className="relative space-y-6">
          <InfoRow label="Title" value={title} large />
          <InfoRow label="Artist" value={artist} />
          <InfoRow label="Edition" value={editionText} mono />
        </section>

        {/* Grid: Signature + Details */}
        <div className="relative mt-10 grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Signature */}
          <div className="rounded-2xl border border-gray-100 bg-gray-50/50 p-5">
            <p className="text-[10px] font-medium tracking-[0.2em] uppercase text-gray-400">
              Authorized Signature
            </p>
            <div className="mt-8 border-b border-dashed border-gray-300" />
            <p className="mt-2 text-xs text-gray-500">{issuerName}</p>
          </div>

          {/* Certificate Details */}
          <div className="rounded-2xl border border-gray-100 bg-gray-50/50 p-5 space-y-4">
            <DetailItem label="Certificate #" value={String(certNo || "—")} mono />
            <DetailItem label="Issued On" value={fmtDate(issuedAt) || "—"} />
            {verifyUrl && <DetailItem label="Verify URL" value={verifyUrl} mono small />}
          </div>
        </div>

        {/* On-chain Record */}
        {showOnchain && (
          <section
            className="relative mt-8 rounded-2xl p-5"
            style={{ backgroundColor: `${accent}08`, border: `1px solid ${accent}20` }}
          >
            <div className="flex items-center gap-2 mb-4">
              <div
                className="w-6 h-6 rounded-full flex items-center justify-center"
                style={{ backgroundColor: `${accent}15` }}
              >
                <CheckCircle2 className="w-3.5 h-3.5" style={{ color: accent }} />
              </div>
              <span
                className="text-[11px] font-semibold tracking-wide uppercase"
                style={{ color: accent }}
              >
                On-chain Record
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <OnchainItem label="Network" value={chain || "—"} accent={accent} />
              <OnchainItem label="Token ID" value={tokenId || "—"} accent={accent} mono />
              <OnchainItem label="Transaction" value={shortHash(tx, 12) || "—"} accent={accent} mono />
            </div>
          </section>
        )}

        {/* Seal */}
        <div className="relative mt-10 flex items-center justify-end">
          <div className="relative">
            {/* Outer ring */}
            <div
              className="w-20 h-20 rounded-full p-[3px]"
              style={{
                background: `conic-gradient(from 180deg, ${accent}, ${accent}40, ${accent})`,
              }}
            >
              {/* Inner white circle */}
              <div className="w-full h-full rounded-full bg-white flex items-center justify-center">
                {sealUrl ? (
                  <Image src={sealUrl} alt="seal" width={40} height={40} className="opacity-90" />
                ) : (
                  <div className="text-center">
                    <div
                      className="text-[9px] font-bold tracking-[0.15em] uppercase"
                      style={{ color: accent }}
                    >
                      Certified
                    </div>
                    <div className="text-[7px] font-medium text-gray-400 mt-0.5">
                      {issuerName}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Footer note */}
        <p className="relative mt-8 text-[10px] text-gray-400 text-center leading-relaxed">
          This certificate verifies the authenticity of the artwork described above.
          <br />
          Issued by {issuerName} — Digital Art Gallery
        </p>
      </div>
    </div>
  );
}

/* ---------- Sub Components ---------- */

function InfoRow({
  label,
  value,
  large = false,
  mono = false,
}: {
  label: string;
  value: React.ReactNode;
  large?: boolean;
  mono?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[10px] font-medium tracking-[0.2em] uppercase text-gray-400">
        {label}
      </span>
      <span
        className={[
          large ? "text-xl md:text-2xl font-semibold" : "text-base md:text-lg font-medium",
          mono ? "font-mono tabular-nums" : "",
          "text-gray-900",
        ].join(" ")}
      >
        {value}
      </span>
    </div>
  );
}

function DetailItem({
  label,
  value,
  mono = false,
  small = false,
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
  small?: boolean;
}) {
  return (
    <div>
      <p className="text-[9px] font-medium tracking-[0.2em] uppercase text-gray-400">
        {label}
      </p>
      <p
        className={[
          "mt-0.5",
          small ? "text-[11px]" : "text-sm",
          mono ? "font-mono tabular-nums tracking-wide" : "font-medium",
          "text-gray-700",
        ].join(" ")}
      >
        {value}
      </p>
    </div>
  );
}

function OnchainItem({
  label,
  value,
  accent,
  mono = false,
}: {
  label: string;
  value: React.ReactNode;
  accent: string;
  mono?: boolean;
}) {
  return (
    <div>
      <p className="text-[9px] font-medium tracking-[0.18em] uppercase" style={{ color: `${accent}99` }}>
        {label}
      </p>
      <p
        className={[
          "mt-0.5 text-[12px]",
          mono ? "font-mono tabular-nums tracking-wide" : "font-medium",
        ].join(" ")}
        style={{ color: accent }}
      >
        {value}
      </p>
    </div>
  );
}
