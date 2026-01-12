// src/app/aura/preview/[id]/page.tsx
// Alias: /aura/preview/[id] → /aiPortfolio/preview/[id] (内部実装は aiPortfolio、公開URLは /aura に統一)
import { permanentRedirect } from "next/navigation";

export default async function AuraPreviewRedirect({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  permanentRedirect(`/aiPortfolio/preview/${encodeURIComponent(id)}`);
}
