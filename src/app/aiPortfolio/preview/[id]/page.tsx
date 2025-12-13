// src/app/aiPortfolio/preview/[id]/page.tsx

import { findRequest } from "@/lib/aiPortfolio/aiPortfolio.db";
import AiPortfolioPortfolioRenderer from "@/components/aiPortfolio/aiPortfolioPortfolioRenderer";
import AiPortfolioPreviewEditorClient from "@/components/aiPortfolio/aiPortfolioPreviewEditorClient";
import type { Design, Content } from "@/lib/aiPortfolio/aiPortfolio.schema";
import PreviewWaitClient from "./PreviewWaitClient";
import { fontFamilyFromPreset } from "@/styles/aiPortfolioFonts";

type Params = { id: string };

export default async function AiPortfolioPreviewPage({
  params,
}: {
  params: Params;
}) {
  const rec = await findRequest(params.id);

  if (!rec || !rec.design || !rec.content) {
    return <PreviewWaitClient id={params.id} />;
  }

  const design = rec.design as Design;
  const content = rec.content as Content;

  const fontClass = fontFamilyFromPreset(
    (design as any).theme?.fontPreset ?? null,
  );

  // layoutDecision.sectionOrder があればそれを使う
  const initialSectionOrder: string[] =
    ((design as any).layoutDecision?.sectionOrder as string[] | undefined) ??
    (Array.isArray(design.sections)
      ? design.sections.map((s) => s.type)
      : content.sections.map((s) => s.type));

  return (
    <main
      className={`mx-auto max-w-5xl px-4 py-10 space-y-10 ${fontClass}`}
    >
      <header>
        <h1 className="text-2xl font-semibold">ポートフォリオ プレビュー</h1>
        <p className="mt-2 text-sm text-gray-600">
          フォームの入力内容をもとに自動生成されたポートフォリオです。
          気になる部分は下で手直しできます。
        </p>
      </header>

      {/* プレビュー本体 */}
      <div className="mt-4">
        <AiPortfolioPortfolioRenderer design={design} content={content} />
      </div>

      {/* テキスト編集エリア＋セクション順序編集 */}
      <AiPortfolioPreviewEditorClient
        requestId={params.id}
        initialContent={content}
        initialSectionOrder={initialSectionOrder}
      />
    </main>
  );
}
