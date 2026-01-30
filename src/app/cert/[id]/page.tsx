// /src/app/cert/[id]/page.tsx
import type { Metadata } from "next";
import Link from "next/link";
import { AlertCircle, ArrowLeft, RefreshCw, FileX } from "lucide-react";
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

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "Certificate | me-ish",
  description: "Certificate of Authenticity (CoA)",
};

// Brand constants
const BRAND = {
  logoUrl: "/brand/me-ish.png",
  sealUrl: "/brand/seal.png",
  accent: "#00a1e9",
  issuerName: "me-ish",
} as const;

// Error card component
function ErrorCard({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children?: React.ReactNode;
}) {
  return (
    <main className="min-h-screen bg-gradient-to-b from-gray-50 to-white flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          {/* Header */}
          <div className="p-6 text-center">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-red-50 mb-4">
              <AlertCircle className="w-7 h-7 text-red-500" />
            </div>
            <h1 className="text-xl font-bold text-gray-900">{title}</h1>
            <p className="mt-2 text-sm text-gray-600 leading-relaxed">{description}</p>
          </div>

          {/* Actions */}
          {children && (
            <div className="px-6 pb-6 flex flex-col gap-3">
              {children}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

export default async function CertPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const idNum = Number(params.id);

  // Invalid URL check
  if (!Number.isInteger(idNum) || idNum <= 0) {
    return (
      <ErrorCard
        title="Invalid URL"
        description="Certificate ID is missing or invalid."
      >
        <Link
          href="/"
          className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-gray-900 text-white text-sm font-medium transition-all hover:bg-gray-800"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to gallery
        </Link>
      </ErrorCard>
    );
  }

  // Parse search params
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

    // Token verification failed
    if (!ver.ok) {
      return (
        <ErrorCard
          title="Link Expired"
          description={t.expiredNote}
        >
          <a
            href={await issueReissueLink(idNum, undefined)}
            className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-[#00a1e9] text-white text-sm font-medium transition-all hover:bg-[#0090d4]"
          >
            <RefreshCw className="w-4 h-4" />
            {t.reissueBtn}
          </a>
          <Link
            href="/"
            className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-gray-100 text-gray-700 text-sm font-medium transition-all hover:bg-gray-200"
          >
            <ArrowLeft className="w-4 h-4" />
            {t.backToGallery}
          </Link>
        </ErrorCard>
      );
    }

    const entry = await getEntryForCoA(ver.entryId);

    // Entry not found
    if (!entry) {
      return (
        <ErrorCard
          title="Not Found"
          description="The certificate record was not found."
        >
          <Link
            href="/"
            className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-gray-900 text-white text-sm font-medium transition-all hover:bg-gray-800"
          >
            <ArrowLeft className="w-4 h-4" />
            {t.backToGallery}
          </Link>
        </ErrorCard>
      );
    }

    const normalizedEntry = {
      ...entry,
      title: entry.title ?? "(Untitled)",
    };

    const artworkHref = `/api/files/download?certToken=${encodeURIComponent(token)}`;
    const pdfTargetId = "coa-printable";
    const pdfFilename = "CoA_me-ish";

    return (
      <main className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
        {/* Hero notice */}
        <div className="bg-white border-b border-gray-100">
          <div className="max-w-4xl mx-auto px-4 py-4">
            <p className="text-sm text-gray-600 text-center leading-relaxed">
              {t.heroNote}
            </p>
          </div>
        </div>

        {/* Main content */}
        <div className="max-w-4xl mx-auto px-4 py-8 md:py-12 space-y-6">
          {/* Certificate card (printable area) */}
          <div
            id={pdfTargetId}
            className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden"
            style={{ maxWidth: 800, margin: '0 auto' }}
          >
            <div className="p-4 md:p-8">
              <CoAInfoPanel
                entry={normalizedEntry}
                showOnchain={false}
                {...BRAND}
              />
            </div>
          </div>

          {/* Action sections */}
          <div className="max-w-2xl mx-auto space-y-4">
            {/* PDF Download */}
            <CoAPdfActions filename={pdfFilename} targetId={pdfTargetId} />
            <p className="text-xs text-gray-400 text-center">{t.expiredNote}</p>

            {/* Artwork Download */}
            <AssetsReceiveSection
              labels={{
                sectionTitle: t.assetsSectionTitle,
                normalNote: t.normalNote,
                normalDownloadBtn: t.normalDownloadBtn,
              }}
              artworkHref={artworkHref}
            />
          </div>

          {/* Back link */}
          <div className="text-center pt-4">
            <Link
              href="/"
              className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              {t.backToGallery}
            </Link>
          </div>
        </div>
      </main>
    );
  } catch (e: unknown) {
    const errorMessage = e instanceof Error ? e.message : String(e);
    console.error("[CoA] server error:", e);

    return (
      <ErrorCard
        title="Server Error"
        description={errorMessage}
      >
        <Link
          href="/"
          className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-gray-900 text-white text-sm font-medium transition-all hover:bg-gray-800"
        >
          <ArrowLeft className="w-4 h-4" />
          {t.backToGallery}
        </Link>
      </ErrorCard>
    );
  }
}
