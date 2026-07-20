// src/app/[locale]/card/preview/[id]/page.tsx
import { findCardRequest } from "@/lib/card/card.db";
import type { CardDesign, CardContent } from "@/lib/card/card.schema";
import CardPreviewWaitClient from "@/components/card/CardPreviewWaitClient";
import CardPreviewShellClient from "@/components/card/CardPreviewShellClient";

type Params = { id: string };

export default async function CardPreviewPage(
  props: {
    params: Promise<Params>;
  }
) {
  const params = await props.params;
  const rec = await findCardRequest(params.id);

  if (!rec || !rec.design || !rec.content) {
    return <CardPreviewWaitClient requestId={params.id} />;
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <CardPreviewShellClient
        requestId={params.id}
        design={rec.design as CardDesign}
        content={rec.content as CardContent}
        publicSlug={rec.publicSlug}
      />
    </main>
  );
}
