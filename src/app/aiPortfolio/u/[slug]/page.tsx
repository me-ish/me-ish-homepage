import { notFound } from "next/navigation";
import { findRequest } from "@/lib/aiPortfolio/aiPortfolio.db";
import AiPortfolioPortfolioRenderer from "@/components/aiPortfolio/aiPortfolioPortfolioRenderer";
import type { Design, Content } from "@/lib/aiPortfolio/aiPortfolio.schema";

type Params = { id: string };

export default async function AiPortfolioPreviewPage({
  params,
}: {
  params: Params;
}) {
  const rec = await findRequest(params.id);

  if (!rec || !rec.design || !rec.content) {
    notFound();
  }

  const design = rec.design as Design;
  const content = rec.content as Content;

  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="text-2xl font-semibold">ポートフォリオ プレビュー</h1>
      <p className="mt-2 text-sm text-gray-600">
        フォームの入力内容をもとに自動生成されたポートフォリオです。
      </p>

      <div className="mt-8">
        <AiPortfolioPortfolioRenderer design={design} content={content} />
      </div>
    </main>
  );
}
