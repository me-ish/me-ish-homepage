// /src/app/cert/[id]/page.tsx
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

// Node ランタイム（Supabase/crypto を使うため）
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
  // /cert/?t=... のような誤URLで落ちないように防御
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

  // URLSearchParams 正規化
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
              {/* 再発行リンク（表示時に一度だけ評価） */}
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

    // title を必ず string に
    const normalizedEntry = {
      ...entry,
      title: entry.title ?? "(Untitled)",
    };

    // 作品データ受け取りエンドポイント
    const artworkHref = `/api/files/download?certToken=${encodeURIComponent(token)}`;

    // PDF化ターゲット
    const pdfTargetId = "coa-printable";
    const pdfFilename = "CoA_me-ish";

    // ★ /public/brand の画像をそのまま使う
    const BRAND = {
      logoUrl: "/brand/me-ish.png",
      sealUrl: "/brand/seal.png",
      accent: "#00a1e9",
      issuerName: "me-ish",
      // 必要なら watermarkOpacity: 0.06 なども
    } as const;

    return (
      <main className="min-h-[80vh] px-4 py-10">
        <div className="mx-auto w-full max-w-[920px] space-y-8">
          {/* ① 案内（日本語/英語） */}
          <section className="rounded-2xl border border-gray-200 p-6 bg-white">
            <p className="text-gray-800 text-sm">{t.heroNote}</p>
          </section>

          {/* ② 証明書本体（A4台紙に載せてPDF化しやすく） */}
          <div
            id={pdfTargetId}
            className="relative mx-auto bg-white"
            style={{
              // A4 (約 794x1123px @96dpi)
              width: 794,
              height: 1123,
              padding: 32,
            }}
          >
            <div className="w-full h-full grid place-items-center">
              <div className="w-[700px]">
                <CoAInfoPanel
                  entry={normalizedEntry}
                  showOnchain={false}
                  {...BRAND}
                />
              </div>
            </div>
          </div>

          {/* ③ 証明書PDF（DOM→PDF） */}
          <CoAPdfActions filename={pdfFilename} targetId={pdfTargetId} />
          <p className="mt-2 text-xs text-gray-500">{t.expiredNote}</p>

          {/* ④ 作品データ受け取り */}
          <AssetsReceiveSection
            labels={{
              sectionTitle: t.assetsSectionTitle,
              normalNote: t.normalNote,
              normalDownloadBtn: t.normalDownloadBtn,
            }}
            artworkHref={artworkHref}
          />
        </div>
      </main>
    );
  } catch (e: any) {
    console.error("[CoA] server error:", e);
    return (
      <main className="min-h-[60vh] flex items-center justify-center px-4">
        <div className="w-full max-w-[760px] bg-white p-6 rounded-xl space-y-3 text-center">
          <h1 className="text-xl font-bold">Server Error</h1>
          <p className="text-gray-700 text-sm break-all">{String(e?.message || e)}</p>
          <Link className="inline-block px-4 py-2 rounded-xl bg-black text-white" href="/">
            {t.backToGallery}
          </Link>
        </div>
      </main>
    );
  }
}

