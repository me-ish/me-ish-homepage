// src/app/aura/u/[slug]/page.tsx
import { notFound, redirect } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

async function getPublicIdBySlug(slug: string): Promise<string | null> {
  const supabase = supabaseAdmin();

  const { data, error } = await supabase
    .from("aura_requests")
    .select("public_id, visibility, published_at, status")
    .eq("slug", slug)
    .maybeSingle();

  if (error || !data) return null;

  if (data.visibility !== "public") return null;
  if (!data.published_at) return null;
  if (data.status !== "published") return null;

  const pid = typeof data.public_id === "string" ? data.public_id.trim() : "";
  return pid ? pid : null;
}

export default async function AuraSlugRedirectPage(
  props: {
    params: Promise<{ slug: string }>;
  }
) {
  const params = await props.params;
  const publicId = await getPublicIdBySlug(params.slug);
  if (!publicId) notFound();

  redirect(`/aura/p/${publicId}`);
}
