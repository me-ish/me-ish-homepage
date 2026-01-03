// src/app/aiPortfolio/preview/[id]/page.tsx

import { findRequest } from "@/lib/aiPortfolio/aiPortfolio.db";
import type { Design, Content } from "@/lib/aiPortfolio/aiPortfolio.schema";
import PreviewWaitClient from "./PreviewWaitClient";
import { fontFamilyFromPreset } from "@/styles/aiPortfolioFonts";

// ★ NEW: Shell（順序の単一ソース、プレビュー共通化）
import AiPortfolioPreviewShellClient from "@/components/aiPortfolio/AiPortfolioPreviewShellClient";

type Params = { id: string };

export default async function AiPortfolioPreviewPage({
  params,
}: {
  params: Params;
}) {
  const rec = await findRequest(params.id);

  if (!rec || !rec.design || !rec.content) {
    // id / requestId どちらでもOKだが、ここは互換で id のまま
    return <PreviewWaitClient id={params.id} />;
  }

  const design = rec.design as Design;
  const content = rec.content as Content;

  const fontClass = fontFamilyFromPreset((design as any).theme?.fontPreset ?? null);

  // layoutDecision.sectionOrder があればそれを使う
  const initialSectionOrder: string[] =
    ((design as any).layoutDecision?.sectionOrder as string[] | undefined) ??
    (Array.isArray(design.sections)
      ? design.sections.map((s) => s.type)
      : content.sections.map((s) => s.type));

  return (
    <main className={`mx-auto max-w-5xl px-4 py-10 ${fontClass}`}>
      <AiPortfolioPreviewShellClient
        requestId={params.id}
        design={design}
        content={content}
        initialSectionOrder={initialSectionOrder}
      />
    </main>
  );
}
