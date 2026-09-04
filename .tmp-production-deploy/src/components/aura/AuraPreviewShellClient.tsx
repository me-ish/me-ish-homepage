// src/components/aura/AuraPreviewShellClient.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import type { Content, Design } from "@/lib/aura/aura.schema";
import AuraPortfolioRenderer from "@/components/aura/AuraPortfolioRenderer";
import AuraPreviewEditorClient from "@/components/aura/AuraPreviewEditorClient";
import { AuraSectionOrderEditor } from "@/components/aura/AuraSectionOrderEditor";

type Props = {
  requestId: string;
  design: Design;
  content: Content;
  initialSectionOrder?: string[];
};

function uniq(arr: string[]) {
  return Array.from(new Set(arr));
}

export default function AuraPreviewShellClient({
  requestId,
  design,
  content,
  initialSectionOrder,
}: Props) {
  // 初期順（design > content）
  const defaultOrder = useMemo(() => {
    const base =
      (Array.isArray(initialSectionOrder) && initialSectionOrder.length > 0
        ? initialSectionOrder
        : content.sections.map((s) => s.type)) ?? [];
    return uniq(base);
  }, [initialSectionOrder, content.sections]);

  // ★唯一の順序ソース
  const [sectionOrder, setSectionOrder] = useState<string[]>(defaultOrder);

  // ★即時同期用の「編集中Content」
  const [draftContent, setDraftContent] = useState<Content>(content);

  // 生成が完了して design/content が差し替わった時の同期
  const syncKey = useMemo(() => {
    const len = content.sections?.length ?? 0;
    const initSig = (initialSectionOrder ?? []).join("|");
    return `${requestId}::${len}::${initSig}`;
  }, [requestId, content.sections, initialSectionOrder]);

  useEffect(() => {
    setSectionOrder(defaultOrder);
    setDraftContent(content);
  }, [syncKey, defaultOrder, content]);

  return (
    <main className="space-y-10">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">ポートフォリオ プレビュー</h1>
        <p className="text-sm text-gray-600">
          入力内容を手直しすると、プレビューに即反映されます。最後に「確定して公開」を押してください。
        </p>
      </header>

      {/* =========================
       * 1) プレビュー（主役を上へ）
       * ========================= */}
      <section aria-label="Preview" className="space-y-3">
        <div className="flex items-end justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-gray-800">プレビュー</h2>
            <p className="mt-1 text-xs text-gray-500">
              変更は即時反映されます（保存は「確定して公開」）。
            </p>
          </div>
        </div>

        <div className="rounded-2xl border bg-white/60 p-4 shadow-sm">
          <AuraPortfolioRenderer
            design={design}
            content={draftContent}
            sectionOrder={sectionOrder}
          />
        </div>
      </section>

      {/* =========================
       * 2) 編集（テキストなど）
       * ========================= */}
      <section aria-label="Editor" className="space-y-3">
        <div>
          <h2 className="text-sm font-semibold text-gray-800">内容を編集する</h2>
          <p className="mt-1 text-xs text-gray-500">
            各セクションの文章や項目を修正できます。
          </p>
        </div>

        <div className="rounded-2xl border bg-white/70 p-4 shadow-sm">
          <AuraPreviewEditorClient
            requestId={requestId}
            draftContent={draftContent}
            onDraftContentChange={setDraftContent}
            sectionOrder={sectionOrder}
          />
        </div>
      </section>

      {/* =========================
       * 3) 表示順（折りたたみ：下へ）
       * ========================= */}
      <section aria-label="Section order" className="space-y-3">
        <details className="group rounded-2xl border bg-white/70 p-4 shadow-sm">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4">
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-gray-800">
                表示順を調整する
              </h2>
              <p className="mt-1 text-xs text-gray-500">
                ドラッグ＆ドロップで順番を変更できます。プレビューにも即時反映されます。
              </p>
            </div>

            <span className="rounded-full border bg-white px-3 py-1 text-xs text-gray-600 shadow-sm transition group-open:rotate-180">
              ▼
            </span>
          </summary>

          <div className="mt-4">
            <AuraSectionOrderEditor
              sectionOrder={sectionOrder}
              onChange={setSectionOrder}
            />
          </div>
        </details>
      </section>
    </main>
  );
}
