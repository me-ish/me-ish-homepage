// src/app/aura/p/[public_id]/page.tsx
import { notFound, permanentRedirect } from "next/navigation";
import type { Metadata } from "next";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { RendererRouter } from "@/components/aura/renderer/RendererRouter";
import { fontFamilyFromPreset } from "@/styles/auraFonts";

export const dynamic = "force-dynamic";

type PublicAuraRow = {
  design: any;
  content: any;

  // 公開ゲート系
  visibility: string | null;
  published_at: string | null;
  status: string | null;

  // 既存/互換
  slug: string | null; // 旧slug（残っているなら参照）
  public_id: string | null;

  // ✅ public_slug方式
  public_slug: string | null;

  // ✅ Renderer Version（買い切り固定化）
  renderer_version: string | null;
};

function isUuidLike(v: string) {
  // 形式: 8-4-4-4-12 の hex
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    v
  );
}

function cleanStr(v: any): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t ? t : null;
}

async function getPublicAuraByKey(key: string): Promise<PublicAuraRow | null> {
  const supabase = supabaseAdmin();

  // public_slug を導入済み前提 + renderer_version 追加
  const select =
    "design, content, visibility, published_at, status, slug, public_id, public_slug, renderer_version";

  const isUuid = isUuidLike(key);

const base = supabase.from("aura_requests").select(select).limit(1);

const { data, error } = await (isUuid
  ? base.eq("public_id", key)
  : base.eq("public_slug", key)
).maybeSingle();


  if (error || !data) return null;

  // 公開ゲート
  if (data.visibility !== "public") return null;
  if (!data.published_at) return null;
  if (data.status !== "published") return null;

  if (!data.design || !data.content) return null;

  return data as any;
}

function resolveSectionOrder(design: any, content: any): string[] {
  const fromDesign = design?.layoutDecision?.sectionOrder;
  if (Array.isArray(fromDesign) && fromDesign.length > 0) return fromDesign;

  const fromContent = content?.sections
    ?.map((s: any) => s?.type)
    .filter(Boolean);

  if (Array.isArray(fromContent) && fromContent.length > 0) return fromContent;

  return [];
}

function pickTitleAndDescription(data: PublicAuraRow, key: string) {
  // schema準拠：hero.headings[0] / hero.paragraphs[0] を優先
  const hero = Array.isArray(data.content?.sections)
    ? data.content.sections.find((s: any) => s?.type === "hero")
    : null;

  const heroTitle = cleanStr(hero?.headings?.[0]);
  const heroDesc = cleanStr(hero?.paragraphs?.[0]);

  const safeCore =
    cleanStr(data.public_slug) ??
    cleanStr(data.slug) ??
    cleanStr(data.public_id) ??
    key;

  const title = heroTitle ? `${heroTitle} | AURA` : `${safeCore} | AURA`;
  const description = heroDesc ?? "AIで生成されたポートフォリオ。";

  return { title, description };
}

export async function generateMetadata({
  params,
}: {
  params: { public_id: string };
}): Promise<Metadata> {
  const key = params.public_id;
  const data = await getPublicAuraByKey(key);

  if (!data) return { title: "Not Found | AURA" };

  const { title, description } = pickTitleAndDescription(data, key);

  return {
    title,
    description,
    openGraph: { title, description },
  };
}

export default async function AuraPublicPage({
  params,
}: {
  params: { public_id: string };
}) {
  const key = params.public_id;
  const data = await getPublicAuraByKey(key);
  if (!data) notFound();

  // ✅ UUIDで来た場合、public_slug があるなら正規URLへ寄せる（方針通り）
  if (isUuidLike(key)) {
    const pslug = cleanStr(data.public_slug);
    if (pslug) {
      permanentRedirect(`/aura/p/${pslug}`);
    }
  }

  const fontClass = fontFamilyFromPreset(data.design?.theme?.fontPreset ?? null);
  const sectionOrder = resolveSectionOrder(data.design, data.content);

  // ✅ renderer_version を取得（DB default '1.0.0' により既存も対応）
  const rendererVersion = data.renderer_version ?? "1.0.0";

  return (
    <main className={`mx-auto max-w-5xl px-4 py-10 ${fontClass}`}>
      <RendererRouter
        rendererVersion={rendererVersion}
        design={data.design}
        content={data.content}
        sectionOrder={sectionOrder}
      />
    </main>
  );
}
