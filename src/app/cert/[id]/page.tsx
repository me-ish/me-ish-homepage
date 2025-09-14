import type { Metadata } from "next";
import Link from "next/link";
import CoAInfoPanel from "@/components/cert/CoAInfoPanel";
import CoAPdfActions from "@/components/cert/CoAPdfActions";
import AssetsReceiveSection from "@/components/cert/AssetsReceiveSection";
import { coaUi } from "@/lib/i18n/coa-ui";
import {
  getEntryForCoA,
  resolveLangFromRequest,
  verifyCertToken,
  issueReissueLink,
} from "@/lib/coa/server";

// ★ Node ランタイムを明示（Supabase/crypto を使うので必須）
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "Certificate | me-ish",
  description: "Certificate of Authenticity (CoA)",
};

export default async function CertPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: Record<string, string | string[] | undefined>;
}) {
  // id の防御（/cert/?t=... のような誤URLで落ちないように）
  const idNum = Number(params.id);
  if (!Number.isInteger(idNum) || idNum <= 0) {
    return (
      <main className="min-h-[60vh] flex items-center justify-center px-4">
        <div className="w-full max-w-[720px] bg-white p-8 rounded-2xl shadow-lg space-y-5 text-center">
          <h1 className="text-2xl font-bold">Invalid URL</h1>
          <p className="text-gray-700">Certificate ID is missing.</p>
          <Link className="px-4 py-2 rounded-xl bg-black text-white" href="/">
            Back to gallery
          </Link>
        </div>
      </main>
    );
  }

  // URLSearchParams を正規化
  const search = new URLSearchParams(
    Object.entries(searchParams).flatMap(([k, v]) =>
      Array.isArray(v) ? v.map((vv) => [k, vv]) : [[k, v ?? ""]]
    )
  );

  const lang = await resolveLangFromRequest(search);
  const t = coaUi[lang];

  const token = search.get("t") || "";

  try {
    const ver = await verifyCertToken(token);
    if (!ver.ok) {
      return (
        <main className="min-h-[60vh] flex items-center justify-center px-4">
          <div className="w-full max-w-[720px] bg-white p-8 rounded-2xl shadow-lg space-y-5 text-center">
            <h1 className="text-2xl font-bold">CoA Link Error</h1>
            <p className="text-gray-700">{t.expiredNote}</p>
            <div className="flex gap-3 justify-center mt-4">
              <Link className="px-4 py-2 rounded-xl bg-black text-white" href="/">
                {t.backToGallery}
              </Link>
              {/* 再発行はここで新トークンを作って302へ。表示時に一度だけ評価されます */}
              <a
                className="px-4 py-2 rounded-xl bg-gray-200"
                href={await issueReissueLink(idNum, undefined)}
              >
                {t.reissueBtn}
              </a>
            </div>
          </div>
        </main>
      );
    }

    const entry = await getEntryForCoA(ver.entryId);
    if (!entry) {
      return (
        <main className="min-h-[60vh] flex items-center justify-center px-4">
          <div className="w-full max-w-[720px] bg-white p-8 rounded-2xl shadow-lg space-y-5 text-center">
            <h1 className="text-2xl font-bold">Not Found</h1>
            <p className="text-gray-700">The certificate record was not found.</p>
            <Link className="inline-block px-4 py-2 rounded-xl bg-black text-white" href="/">
              {t.backToGallery}
            </Link>
          </div>
        </main>
      );
    }

    // sales_type / sale_type のゆらぎ吸収（どちらか入っている方を採用）
    const purchaseType =
      ((entry as any).sales_type ?? (entry as any).sale_type ?? "normal") as
        | "normal"
        | "nft";

    // 相対パスで十分。NEXT_PUBLIC_SITE_URL 未設定でも安全
    const pdfHref = `/api/cert/download?t=${encodeURIComponent(token)}`;
    const artworkHref = `/api/files/download?certToken=${encodeURIComponent(token)}`;

    return (
      <main className="min-h-[80vh] px-4 py-10">
        <div className="mx-auto w-full max-w-[920px] space-y-8">
          {/* ① 案内（日本語/英語） */}
          <section className="rounded-2xl border border-gray-200 p-6 bg-white">
            <p className="text-gray-800 text-sm">{t.heroNote}</p>
          </section>

          {/* ② 証明書本体（英語ラベル） */}
          <CoAInfoPanel entry={entry} showOnchain={purchaseType === "nft"} />

          {/* ③ 証明書PDF */}
          <CoAPdfActions downloadHref={pdfHref} note={t.expiredNote} />

          {/* ④ 作品データ受け取り */}
          <AssetsReceiveSection
            salesType={purchaseType}
            labels={{
              sectionTitle: t.assetsSectionTitle,
              normalNote: t.normalNote,
              normalDownloadBtn: t.normalDownloadBtn,
              nftNote: t.nftNote,
              nftConnectBtn: t.nftConnectBtn,
              nftGasNote: t.nftGasNote,
            }}
            artworkHref={artworkHref}
            onNftClaim={() => {
              location.href = `/claim/${entry.id}?t=${encodeURIComponent(token)}`;
            }}
            showOffchainDownloadInNft={false}
          />
        </div>
      </main>
    );
  } catch (e: any) {
    // 例外は Digest になりがちなので画面にも表示（暫定）
    console.error("[CoA] server error:", e);
    return (
      <main className="min-h-[60vh] flex items-center justify-center px-4">
        <div className="w-full max-w-[760px] bg-white p-6 rounded-xl space-y-3 text-center">
          <h1 className="text-xl font-bold">Server Error</h1>
          <p className="text-gray-700 text-sm break-all">
            {String(e?.message || e)}
          </p>
          <Link className="inline-block px-4 py-2 rounded-xl bg-black text-white" href="/">
            {t.backToGallery}
          </Link>
        </div>
      </main>
    );
  }
}
