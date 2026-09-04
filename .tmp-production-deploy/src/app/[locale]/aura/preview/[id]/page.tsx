// src/app/aura/preview/[id]/page.tsx

import { findRequest } from "@/lib/aura/aura.db";
import type { Design, Content } from "@/lib/aura/aura.schema";
import PreviewWaitClient from "./PreviewWaitClient";
import { fontFamilyFromPreset } from "@/styles/auraFonts";

import AuraPreviewShellClient from "@/components/aura/AuraPreviewShellClient";

type Params = { id: string };

export default async function AuraPreviewPage(
  props: {
    params: Promise<Params>;
  }
) {
  const params = await props.params;
  const rec = await findRequest(params.id);

  if (!rec || !rec.design || !rec.content) {
    return <PreviewWaitClient id={params.id} />;
  }

  const design = rec.design as Design;
  const content = rec.content as Content;

  const fontClass = fontFamilyFromPreset((design as any).theme?.fontPreset ?? null);

  const initialSectionOrder: string[] =
    ((design as any).layoutDecision?.sectionOrder as string[] | undefined) ??
    (Array.isArray(design.sections)
      ? design.sections.map((s: any) => s.type)
      : content.sections.map((s: any) => s.type));

  return (
    <main className={`mx-auto max-w-5xl px-4 py-10 ${fontClass}`}>
      <AuraPreviewShellClient
        requestId={params.id}
        design={design}
        content={content}
        initialSectionOrder={initialSectionOrder}
      />
    </main>
  );
}
