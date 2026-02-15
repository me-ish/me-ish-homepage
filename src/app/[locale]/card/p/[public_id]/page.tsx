// src/app/[locale]/card/p/[public_id]/page.tsx
import { notFound, permanentRedirect } from "next/navigation";
import type { Metadata } from "next";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getSiteUrl } from "@/lib/constants";
import CardRenderer from "@/components/card/renderer/CardRenderer";

export const dynamic = "force-dynamic";

type CardRow = {
  design: any;
  content: any;
  visibility: string | null;
  published_at: string | null;
  status: string | null;
  public_id: string | null;
  public_slug: string | null;
  renderer_version: string | null;
};

function isUuidLike(v: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    v,
  );
}

function cleanStr(v: any): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t || null;
}

async function getPublicCard(key: string): Promise<CardRow | null> {
  const supabase = supabaseAdmin();

  const select =
    "design, content, visibility, published_at, status, public_id, public_slug, renderer_version";

  const isUuid = isUuidLike(key);

  const { data, error } = await supabase
    .from("card_requests")
    .select(select)
    .eq(isUuid ? "public_id" : "public_slug", key)
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;
  if (data.visibility !== "public") return null;
  if (!data.published_at) return null;
  if (data.status !== "published") return null;
  if (!data.design || !data.content) return null;

  return data as CardRow;
}

export async function generateMetadata({
  params,
}: {
  params: { public_id: string };
}): Promise<Metadata> {
  const key = params.public_id;
  const data = await getPublicCard(key);

  if (!data) return { title: "Not Found | me-ish CARD" };

  const name = data.content?.profile?.name ?? key;
  const titleText = data.content?.profile?.title ?? "";
  const title = `${name} - ${titleText} | me-ish CARD`;
  const description =
    data.content?.profile?.tagline ?? `${name}のデジタル名刺`;

  return {
    title,
    description,
    openGraph: { title, description },
  };
}

export default async function CardPublicPage({
  params,
}: {
  params: { public_id: string };
}) {
  const key = params.public_id;
  const data = await getPublicCard(key);
  if (!data) notFound();

  // Redirect UUID to slug if available
  if (isUuidLike(key)) {
    const pslug = cleanStr(data.public_slug);
    if (pslug) {
      permanentRedirect(`/card/p/${pslug}`);
    }
  }

  const publicUrl = `${getSiteUrl()}/card/p/${data.public_slug ?? data.public_id ?? key}`;

  return (
    <CardRenderer
      design={data.design}
      content={data.content}
      publicUrl={publicUrl}
    />
  );
}
