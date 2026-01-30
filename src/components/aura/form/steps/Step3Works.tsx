// src/components/aiPortfolio/form/steps/Step3Works.tsx
"use client";

import AuraImageUploader from "@/components/aura/AuraImageUploader";
import type { AiPortfolioImageItem } from "@/components/aura/AuraImageUploader";
import type { AuraFormData } from "../auraFormTypes";

type Props = {
  data: AuraFormData;
  onChange: (updates: Partial<AuraFormData>) => void;
  requestId: string | null;
  onRequireDraft: () => void;
};

export function Step3Works({ data, onChange, requestId, onRequireDraft }: Props) {
  const handleImagesChange = (images: AiPortfolioImageItem[]) => {
    onChange({ images });
  };

  return (
    <div className="space-y-6">
      {/* ヘッダー */}
      <div className="text-center">
        <h2 className="text-xl font-semibold text-slate-900 md:text-2xl">
          作品を見せる
        </h2>
        <p className="mt-2 text-sm text-slate-500">
          あなたの作品画像をアップロードしてください（最大6枚）
        </p>
      </div>

      {/* 説明 */}
      <div className="mx-auto max-w-xl">
        <div className="rounded-2xl border border-sky-200 bg-sky-50 p-4">
          <div className="flex items-start gap-3">
            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-sky-500 text-white">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="text-sm text-sky-800">
              <p className="font-medium">おすすめのアップロード方法</p>
              <ul className="mt-1 list-inside list-disc text-xs text-sky-700">
                <li>代表作を1〜3枚選ぶのがベスト</li>
                <li>正方形 or 横長の画像が見栄えよく表示されます</li>
                <li>2MB以内のJPG/PNG推奨</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* アップローダー */}
      <div className="mx-auto max-w-xl">
        <div
          className={[
            "rounded-2xl border-2 border-dashed p-4 transition-colors",
            data.images.length > 0
              ? "border-sky-300 bg-sky-50/50"
              : "border-slate-300 bg-slate-50",
          ].join(" ")}
        >
          <AuraImageUploader
            value={data.images}
            onChange={handleImagesChange}
            max={6}
            requestId={requestId}
            onRequireDraft={onRequireDraft}
          />
        </div>

        <p className="mt-3 text-center text-xs text-slate-500">
          {data.images.length === 0 ? (
            "作品画像がなくてもポートフォリオは生成できます"
          ) : (
            <span className="font-medium text-sky-600">
              {data.images.length}枚アップロード済み
            </span>
          )}
        </p>
      </div>
    </div>
  );
}
