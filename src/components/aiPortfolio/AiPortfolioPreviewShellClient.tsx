"use client";

import React, { useMemo, useState } from "react";
import type { Design, Content } from "@/lib/aiPortfolio/aiPortfolio.schema";
import AiPortfolioPortfolioRenderer from "./aiPortfolioPortfolioRenderer";
import AiPortfolioPreviewEditorClient from "./aiPortfolioPreviewEditorClient";
import { AiPortfolioSectionOrderEditor } from "./AiPortfolioSectionOrderEditor";

type Props = {
  design: Design;
  content: Content;
  requestId: string;
};

export default function AiPortfolioPreviewShellClient({
  design,
  content,
  requestId,
}: Props) {
  const initialOrder = useMemo(() => {
    const layoutDecision = (design as any)
      .layoutDecision as { sectionOrder?: string[] } | undefined;

    if (layoutDecision?.sectionOrder && layoutDecision.sectionOrder.length) {
      return [...layoutDecision.sectionOrder];
    }

    if (Array.isArray(design.sections) && design.sections.length > 0) {
      return [...design.sections]
        .sort((a, b) => a.order - b.order)
        .map((s) => s.type);
    }

    return content.sections.map((s) => s.type);
  }, [design, content]);

  const [sectionOrder, setSectionOrder] = useState<string[]>(initialOrder);

  console.log("[PreviewShell] sectionOrder:", sectionOrder);

  return (
    <div className="space-y-8">
      {/* 上：実際のプレビュー */}
      <AiPortfolioPortfolioRenderer
        design={design}
        content={content}
        sectionOrderOverride={sectionOrder}
      />

      {/* 中：順番編集 UI */}
      <AiPortfolioSectionOrderEditor
        sectionOrder={sectionOrder}
        onChange={setSectionOrder}
      />

      {/* 下：既存のテキスト編集 UI（そのまま） */}
      <AiPortfolioPreviewEditorClient
        requestId={requestId}
        initialContent={content}
      />
    </div>
  );
}
