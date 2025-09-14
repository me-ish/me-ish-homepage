// /src/components/cert/CoAInfoPanel.tsx
"use client";

import * as React from "react";

type EntryLike = {
  title?: string | null;
  artist_name?: string | null;

  // エディション情報（あるものだけで表示）
  edition_no?: number | null;
  edition_total?: number | null;

  // 日付・ID類（存在すれば拾う）
  created_at?: string | null;
  confirmed_at?: string | null;
  purchased_at?: string | null;
  cert_id?: string | number | null;
  id?: string | number | null;

  // NFT系（存在すれば表示）
  token_id?: string | number | null;
  txhash?: string | null;
  chain?: string | null;
  network?: string | null;
};

type Props = {
  entry: EntryLike;
  /** NFT なら true（チェーン情報ボックスを出す） */
  showOnchain?: boolean;
  /** 右下のQR/リンク用URL（省略可。与えればQR代わりのURLテキストを出す） */
  verifyUrl?: string;
  /** 発行者名（デフォルト: "me-ish"） */
  issuerName?: string;
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
  issuerName = "me-ish",
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
      className={[
        // プリントと画面の両方で美しく見えるように serif をベースに
        "text-[#111] bg-white rounded-[18px] shadow-sm",
        "print:shadow-none",
      ].join(" ")}
      // ここはA4台紙上で 700〜740px 程度で見る想定（親側で幅を制御）
    >
      {/* 飾り枠（ダブルボーダー） */}
      <div className="relative rounded-[16px] border border-[#e5e7eb]">
        <div className="pointer-events-none absolute inset-3 rounded-[12px] border border-[#e5e7eb]" />

        {/* ウォーターマーク（薄い “me-ish”） */}
        <div className="pointer-events-none absolute inset-0 grid place-items-center">
          <div className="select-none -rotate-12 text-[72px] font-semibold tracking-[0.08em] text-black/5 print:text-black/10">
            me-ish
          </div>
        </div>

        {/* 中身 */}
        <div className="relative p-8 md:p-10">
          {/* ヘッダ */}
          <header className="text-center">
            <div className="text-[13px] tracking-[0.38em] uppercase text-[#6b7280]">
              Certificate of
            </div>
            <h1 className="mt-1 font-serif text-3xl md:text-[34px] font-semibold tracking-wide">
              Authenticity
            </h1>
            <div className="mt-3 inline-block rounded-full bg-[#111] px-3 py-1 text-[11px] font-semibold tracking-wide text-white">
              {issuerName}
            </div>
          </header>

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
            {/* 左：署名欄 */}
            <div className="rounded-xl border border-[#eef2f5] p-4">
              <div className="text-[11px] tracking-wide text-[#6b7280]">
                Authorized Signature
              </div>
              <div className="mt-6 h-[42px] border-b border-dashed border-[#cbd5e1]" />
              <div className="mt-1 text-[11px] text-[#6b7280]">{issuerName}</div>
            </div>

            {/* 右：発行情報 */}
            <div className="rounded-xl border border-[#eef2f5] p-4">
              <InfoItem k="Certificate #" v={String(certNo || "—")} />
              <InfoItem k="Issued On" v={fmtDate(issuedAt) || "—"} />
              {verifyUrl ? <InfoItem k="Verify" v={verifyUrl} mono /> : null}
            </div>
          </section>

          {/* オンチェーン情報（NFTのみ） */}
          {showOnchain ? (
            <section className="mt-6 rounded-xl border border-[#fee2e2] bg-rose-50/40 p-4">
              <div className="text-[11px] font-semibold tracking-wide text-rose-700">
                On-chain Record
              </div>
              <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-3">
                <SmallKV k="Network" v={chain || "—"} />
                <SmallKV k="Token ID" v={tokenId || "—"} mono />
                <SmallKV k="Tx" v={shortHash(tx, 12) || "—"} mono />
              </div>
              <p className="mt-2 text-[11px] text-rose-700/80">
                The information above indicates the minted token recorded on the
                blockchain.
              </p>
            </section>
          ) : null}

          {/* シール（飾り） */}
          <div className="mt-8 flex items-center justify-end">
            <div className="relative h-16 w-16 rounded-full bg-gradient-to-br from-[#111] to-[#555] text-white">
              <div className="absolute inset-[2px] rounded-full bg-white" />
              <div className="relative grid h-full w-full place-items-center text-[10px] font-bold tracking-wider text-[#111]">
                CERTIFIED
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
      <div className="text-[10px] uppercase tracking-[0.18em] text-rose-700/80">
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
