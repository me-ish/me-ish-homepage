// C:\me-ish-next\src\components\entryForm\ConfirmPage.tsx
'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useFormContext } from 'react-hook-form';
import type { FormValues } from '@/app/entry/FormWrapper';

interface ConfirmPageProps {
  onBack: () => void;
}

const BRAND = '#00a1e9';
const FEE_RATE = 0.10 as const;

const displayPlanLabels: Record<string, string> = {
  free: 'Free（¥0 / 表示保証なし・ローテーション枠）',
  mini: 'Mini（¥400 / 月4回保証）',
  light: 'Light（¥800 / 月9回保証）',
  standard: 'Standard（¥1,200 / 月14回保証）',
  premium: 'Premium（¥2,400 / 月30回保証）',
};

const galleryTypeLabel: Record<string, string> = {
  white: 'ホワイトギャラリー（常設）',
  float: 'フロートギャラリー（1か月展示）',
};

const yen = (n: number) => new Intl.NumberFormat('ja-JP').format(n);

// 型安全にエラーメッセージだけ取り出す（必要なら使用）
function errMsg(err: unknown): string | undefined {
  const m = (err as { message?: unknown })?.message;
  return typeof m === 'string' ? m : undefined;
}

function aiUsageLabel(v: FormValues['ai_usage'] | undefined) {
  if (!v) return '—';
  if (v === 'none') return '使用していない';
  if (v === 'assist') return 'AI補助（非生成）';
  if (v === 'gen_assist') return '生成AI併用';
  return '—';
}

const ConfirmPage: React.FC<ConfirmPageProps> = ({ onBack }) => {
  const { watch } = useFormContext<FormValues>();
  const data = watch();

  // ページトップへスクロール（Framer Motion遷移後でも滑らかに）
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
    return () => cancelAnimationFrame(id);
  }, []);

  // 画像ファイルの抽出
  const imageFile: File | null = useMemo(() => {
    if (data.image instanceof FileList && data.image.length > 0) return data.image[0];
    if (data.image instanceof File) return data.image;
    return null;
  }, [data.image]);

  // プレビューURL（リーク対策で revoke する）
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!imageFile) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(imageFile);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [imageFile]);

  // 価格と手数料・報酬
  const priceNum = useMemo(() => {
    const n = Number(String(data.price ?? '').replace(/[^\d]/g, ''));
    return Number.isFinite(n) ? n : 0;
  }, [data.price]);

  const fee = Math.floor(priceNum * FEE_RATE);
  const reward = Math.max(0, priceNum - fee);

  const isUnlimited = data.editionMode === 'unlimited';
  const editionLabel = isUnlimited
    ? '無制限'
    : (data.editionTotal ? `${data.editionTotal} 点` : '—');

  return (
    <section
      className="w-full max-w-[720px] mx-auto p-6 sm:p-8 bg-white rounded-2xl shadow-sm ring-1 ring-gray-100 space-y-6"
      aria-labelledby="confirm-title"
    >
      <header className="flex items-center justify-between">
        <h2 id="confirm-title" className="text-[22px] font-bold text-gray-900 flex items-center gap-3">
          <span className="inline-block h-5 w-1.5 rounded-full" style={{ backgroundColor: BRAND }} aria-hidden />
          入力内容の最終確認
        </h2>
        <button
          type="button"
          onClick={onBack}
          className="text-sm px-3 py-1.5 rounded-lg border border-gray-300 hover:bg-gray-50 text-gray-700"
          title="前のステップに戻って修正"
        >
          ← 修正する
        </button>
      </header>

      {/* アーティスト情報 */}
      <div className="p-4 sm:p-5 bg-[#fbfbfb] border border-gray-200 rounded-xl space-y-2 text-gray-800">
        <h3 className="text-base font-bold text-gray-900">アーティスト情報</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1">
          <p>
            <span className="text-gray-500">作家名：</span>
            <span className="font-medium">{data.artistName || '—'}</span>
          </p>
          <p>
            <span className="text-gray-500">メール：</span>
            <span className="font-medium">{data.email || '—'}</span>
          </p>

          {data.homepageUrl && (
            <p className="sm:col-span-2">
              <span className="text-gray-500">ホームページ：</span>
              <a href={data.homepageUrl} className="text-blue-600 underline break-all" target="_blank" rel="noopener noreferrer">
                {data.homepageUrl}
              </a>
            </p>
          )}
          {data.twitterUrl && (
            <p className="sm:col-span-2">
              <span className="text-gray-500">X：</span>
              <a href={data.twitterUrl} className="text-blue-600 underline break-all" target="_blank" rel="noopener noreferrer">
                {data.twitterUrl}
              </a>
            </p>
          )}
          {data.instagramUrl && (
            <p className="sm:col-span-2">
              <span className="text-gray-500">Instagram：</span>
              <a href={data.instagramUrl} className="text-blue-600 underline break-all" target="_blank" rel="noopener noreferrer">
                {data.instagramUrl}
              </a>
            </p>
          )}
        </div>
      </div>

      {/* 作品情報 */}
      <div className="p-4 sm:p-5 bg-[#fbfbfb] border border-gray-200 rounded-xl text-gray-800">
        <h3 className="text-base font-bold text-gray-900 mb-2">作品情報</h3>
        <div className="space-y-1">
          <p>
            <span className="text-gray-500">ギャラリー：</span>
            <span className="inline-flex items-center gap-2">
              <span className="font-medium">{galleryTypeLabel[data.gallery_type] ?? data.gallery_type ?? '—'}</span>
              {data.gallery_type && (
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 border border-gray-200">
                  {data.gallery_type}
                </span>
              )}
            </span>
          </p>

          <p>
            <span className="text-gray-500">作品タイトル：</span>
            <span className="font-medium">{data.title || '—'}</span>
          </p>

          <p>
            <span className="text-gray-500">作者サイン：</span>
            <span className="font-medium">
              {data.has_signature === 'yes'
                ? 'あり'
                : data.has_signature === 'no'
                ? 'なし（me-ishがWM付与）'
                : '—'}
            </span>
          </p>

          <p>
            <span className="text-gray-500">AI使用：</span>
            <span className="font-medium">{aiUsageLabel(data.ai_usage)}</span>
            <span className="ml-2 text-xs text-gray-500">
              （選択内容は作品ページに表示されます）
            </span>
          </p>

          {/* 生成AI併用時のみ、任意入力も表示 */}
          {data.ai_usage === 'gen_assist' && (
            <div className="mt-2 rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-sm text-blue-900">
              <p className="font-semibold">生成AIの使用範囲（任意）</p>
              <p className="text-xs text-blue-800/90 mt-1">
                透明性のため、入力がある場合のみ表示します。
              </p>
              <div className="mt-1 space-y-1 text-[13px]">
                <p>
                  <span className="text-blue-900/70">範囲：</span>
                  <span className="font-medium">
                    {(data.ai_usage_scope && data.ai_usage_scope.length > 0)
                      ? data.ai_usage_scope.join(' / ')
                      : '—'}
                  </span>
                </p>
                <p className="whitespace-pre-wrap break-words">
                  <span className="text-blue-900/70">補足：</span>
                  <span className="font-medium">{data.ai_usage_note?.trim() ? data.ai_usage_note.trim() : '—'}</span>
                </p>
              </div>
            </div>
          )}

          <p className="whitespace-pre-wrap break-words">
            <span className="text-gray-500">作品説明：</span>{data.description || '（なし）'}
          </p>
        </div>

        {previewUrl && (
          <div className="mt-3">
            <p className="text-sm text-gray-600 mb-1">画像プレビュー：</p>
            <img
              src={previewUrl}
              alt="応募画像プレビュー"
              className="max-w-full max-h-[420px] rounded-lg border border-gray-200"
            />
            {imageFile && (
              <p className="mt-1 text-xs text-gray-500 break-all">
                ファイル名：{imageFile.name}
              </p>
            )}
          </div>
        )}
      </div>

      {/* 販売情報（販売=はい のとき） */}
      {data.isForSale === 'yes' && (
        <div className="p-4 sm:p-5 bg-[#fbfbfb] border border-gray-200 rounded-xl text-gray-800 space-y-2">
          <h3 className="text-base font-bold text-gray-900">販売情報</h3>

          <p>
            <span className="text-gray-500">販売モード：</span>
            <span className="font-medium">{isUnlimited ? '無制限販売' : 'エディション販売'}</span>
            {data.editionMode && (
              <span className="ml-2 text-[11px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 border border-gray-200">
                {data.editionMode}
              </span>
            )}
          </p>

          <p>
            <span className="text-gray-500">販売点数：</span>
            <span className="font-medium">{editionLabel}</span>
            {isUnlimited && <span className="ml-2 text-xs text-gray-500">(在庫制限なし)</span>}
          </p>

          <p>
            <span className="text-gray-500">販売価格：</span>
            <span className="font-medium">¥{yen(priceNum)}</span>
            <span className="ml-2 text-xs text-gray-500">（1点あたり）</span>
          </p>

          <p className="text-sm text-gray-700">
            アーティスト報酬：<span className="font-semibold">¥{yen(Math.max(0, reward))}</span> ／
            me-ish手数料（{Math.round(FEE_RATE * 100)}%）：<span className="font-semibold">¥{yen(fee)}</span>
          </p>

          <p>
            <span className="text-gray-500">表示保証プラン：</span>
            <span className="font-medium">{displayPlanLabels[data.displayPlan] ?? '—'}</span>
          </p>
        </div>
      )}

      {/* 注意テキスト */}
      <p className="text-xs text-gray-500">
        ※ 表示内容をご確認のうえ、ページ下部の「送信」ボタンを押してください。修正が必要な場合は「← 修正する」から前のステップに戻れます。
      </p>
    </section>
  );
};

export default ConfirmPage;
