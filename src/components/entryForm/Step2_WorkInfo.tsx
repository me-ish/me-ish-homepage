'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useFormContext } from 'react-hook-form';
import { HelpCircle } from 'lucide-react';
import type { FormValues } from '@/app/entry/FormWrapper';

type Step2Props = {
  preview: string | null;
  setPreview: (value: string | null) => void;
  localImageFile: File | null;
  setLocalImageFile: (file: File | null) => void;
};

const BRAND = '#00a1e9';
const MAX_BYTES = 10 * 1024 * 1024; // 10MB
const ACCEPTED = ['image/jpeg', 'image/png']; // 必要なら 'image/webp' も追加可
const MAX_EDGE = 3000; // 一辺3000px以内
const MIN_SHORT_EDGE = 1200; // 短辺1200px以上（画質担保）

function pickFileFromValue(v: File | FileList | null | undefined) {
  if (!v) return null;
  if (v instanceof File) return v;
  if (v instanceof FileList && v.length > 0) return v[0];
  return null;
}
async function readImageMeta(file: File): Promise<{ width: number; height: number }> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    const meta = await new Promise<{ width: number; height: number }>((resolve, reject) => {
      img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
      img.onerror = reject;
      img.src = url;
    });
    return meta;
  } finally {
    URL.revokeObjectURL(url);
  }
}
function aspectLabel(w: number, h: number) {
  const r = (w / h).toFixed(2);
  if (Math.abs(w / h - 1) <= 0.08) return '1:1（正方形）';
  if (Math.abs(w / h - 1.5) <= 0.08) return '3:2（横長）';
  if (Math.abs(w / h - 2 / 3) <= 0.08) return '2:3（縦長）';
  return `${r}:1（自由比率）`;
}
function extractTitleFromFilename(name: string) {
  return name.replace(/\.[a-z0-9]+$/i, '').replace(/[_\-]+/g, ' ').trim().slice(0, 64);
}
// 型安全にエラーメッセージを取り出すヘルパー
function errMsg(err: unknown): string | undefined {
  const m = (err as { message?: unknown })?.message;
  return typeof m === 'string' ? m : undefined;
}

const Step2_WorkInfo = ({
  preview,
  setPreview,
  setLocalImageFile,
}: Step2Props) => {
  const {
    register,
    watch,
    setValue,
    trigger,
    formState: { errors },
  } = useFormContext<FormValues>();

  const imageField = watch('image');
  const titleValue: string = watch('title') || '';
  const descValue: string = watch('description') || '';

  const [showHelp, setShowHelp] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [meta, setMeta] = useState<{ width: number; height: number } | null>(null);

  // ページトップへスクロール
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  // 念のためマウント時に white を強制セット（hiddenのdefaultValueと二重の安全網）
  useEffect(() => {
    setValue('gallery_type', 'white', { shouldDirty: false, shouldValidate: true });
  }, [setValue]);

  // プレビュー／メタ取得／タイトル補完（バリデーションは register 側に集約）
  useEffect(() => {
    const file = pickFileFromValue(imageField);
    if (!file) {
      setPreview(null);
      setLocalImageFile(null);
      setMeta(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    setLocalImageFile(file);

    readImageMeta(file)
      .then((m) => setMeta(m))
      .catch(() => setMeta(null));

    if (!titleValue?.trim()) {
      const suggested = extractTitleFromFilename(file.name);
      if (suggested) setValue('title', suggested, { shouldDirty: true, shouldValidate: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imageField]);

  // D&Dで投入（FileListをそのままフォーム値にセット）
  const onDrop: React.DragEventHandler<HTMLLabelElement> = async (e) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      setValue('image', files, { shouldDirty: true, shouldValidate: true });
      await trigger('image');
    }
  };

  return (
    <section
      className="w-full max-w-[720px] mx-auto p-6 sm:p-8 bg-white rounded-2xl shadow-sm ring-1 ring-gray-100 space-y-6"
      aria-labelledby="work-info-title"
    >
      <header className="mb-2">
        <h2 id="work-info-title" className="text-[22px] font-bold text-gray-900 flex items-center gap-3">
          <span className="inline-block h-5 w-1.5 rounded-full" style={{ backgroundColor: BRAND }} aria-hidden />
          応募作品の情報入力
        </h2>
        <p className="mt-2 text-sm text-gray-600">
          画像は<strong>10MB以内・JPEG/PNG・一辺3000px以内</strong>を推奨。短辺は<strong>{MIN_SHORT_EDGE}px以上</strong>が目安です。
        </p>
      </header>

      {/* 応募先ギャラリー（White固定） */}
      <div>
        <label className="block text-sm font-semibold text-gray-800 mb-1.5">
          応募先ギャラリー <span className="text-red-600">＊</span>
        </label>

        {/* 表示は固定バッジ */}
        <div className="inline-flex items-center gap-2 rounded-lg border border-[#d9eef8] bg-[#f3fbff] px-3 py-2">
          <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: BRAND }} aria-hidden />
          <span className="text-sm font-semibold text-gray-800">ホワイトギャラリー</span>
          <span className="text-xs text-gray-500">（β中はWhiteのみ募集）</span>
        </div>

        {/* 送信用：white固定（RHFに値を載せる） */}
        <input type="hidden" defaultValue="white" {...register('gallery_type')} />

        <p className="mt-1 text-xs text-gray-500">
          🧭 無期限の常設展示（⽇替わりなし）。フロートギャラリーはβ終了後に募集予定です。
        </p>
      </div>

      {/* 作品タイトル */}
      <div>
        <label htmlFor="title" className="block text-sm font-semibold text-gray-800 mb-1.5">
          作品タイトル <span className="text-red-600">＊</span>
        </label>
        <input
          id="title"
          type="text"
          placeholder="作品のタイトル"
          maxLength={64}
          aria-invalid={!!errors.title}
          aria-describedby="title_help title_count"
          className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-[#00a1e9] placeholder:text-gray-400"
          {...register('title', {
            required: '作品タイトルは必須です。',
            maxLength: { value: 64, message: '64文字以内で入力してください。' },
            validate: (v) => v.trim().length > 0 || '空白のみは使用できません。',
          })}
        />
        <div className="mt-1 flex items-center justify-between">
          <p id="title_help" className="text-xs text-gray-500">未入力の場合はファイル名から自動補完します（編集可）。</p>
          <span id="title_count" className="text-xs text-gray-400">{titleValue.length}/64</span>
        </div>
        {(() => {
          const m = errMsg(errors.title);
          return m ? <p role="alert" className="mt-1.5 text-sm text-red-600">{m}</p> : null;
        })()}
      </div>

      {/* 画像アップロード（D&D対応） */}
      <div>
        <div className="flex items-center mb-2">
          <label htmlFor="image" className="text-sm font-semibold text-gray-800">
            作品画像 <span className="text-red-600">＊</span>（10MB以下）
          </label>
          <button
            type="button"
            onClick={() => setShowHelp(!showHelp)}
            className="ml-2 inline-flex items-center text-[#00a1e9] hover:text-[#007bb8]"
            aria-expanded={showHelp}
            aria-controls="image_helpbox"
            title="推奨サイズの表示/非表示"
          >
            <HelpCircle size={18} />
          </button>
        </div>

        <label
          htmlFor="image"
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={onDrop}
          className={[
            'block w-full border-2 rounded-xl px-4 py-8 text-center transition',
            isDragging ? 'border-[#00a1e9] ring-2 ring-[#00a1e9]/30 bg-[#f5fbff]' : 'border-dashed border-gray-300 hover:border-gray-400',
          ].join(' ')}
        >
          <p className="text-sm text-gray-700">
            ここにドラッグ＆ドロップ、または <span className="font-semibold underline">ファイルを選択</span>
          </p>

          <input
            id="image"
            type="file"
            accept={ACCEPTED.join(',')}
            className="sr-only"
            aria-invalid={!!errors.image}
            {...register('image', {
              onChange: async () => { await trigger('image'); },
              validate: {
                exists: (v: File | FileList) =>
                  !!pickFileFromValue(v) || '作品画像は必須です。',
                size: (v: File | FileList) => {
                  const f = pickFileFromValue(v);
                  return !f || f.size <= MAX_BYTES || '画像サイズは10MB以下にしてください。';
                },
                type: (v: File | FileList) => {
                  const f = pickFileFromValue(v);
                  return !f || ACCEPTED.includes(f.type) || 'JPEG または PNG をご利用ください（HEICは非対応）。';
                },
                dims: async (v: File | FileList) => {
                  const f = pickFileFromValue(v);
                  if (!f) return true;
                  try {
                    const m = await readImageMeta(f);
                    const shortEdge = Math.min(m.width, m.height);
                    const longEdge = Math.max(m.width, m.height);
                    if (shortEdge < MIN_SHORT_EDGE) return `短辺は${MIN_SHORT_EDGE}px以上を推奨しています（現在: ${shortEdge}px）。`;
                    if (longEdge > MAX_EDGE) return `一辺は${MAX_EDGE}px以内にしてください（現在: ${longEdge}px）。`;
                    return true;
                  } catch {
                    return '画像の読み込みに失敗しました。別の画像でお試しください。';
                  }
                },
              },
            })}
          />
        </label>

        {/* 画像エラー */}
        {(() => {
          const m = errMsg(errors.image);
          return m ? <p role="alert" className="text-sm text-red-600 mt-2">{m}</p> : null;
        })()}

        {showHelp && (
          <div id="image_helpbox" className="mt-3 p-4 border border-gray-200 rounded-lg bg-[#f9f9f9] text-sm text-gray-700">
            <p className="font-semibold mb-2">📐 推奨画像</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>正方形：2000 × 2000px</li>
              <li>横長：2400 × 1600px（3:2）</li>
              <li>縦長：1600 × 2400px（2:3）</li>
              <li>最大：一辺3000px以内／10MB以下</li>
              <li>形式：JPEG / PNG（sRGB推奨）</li>
            </ul>
            <p className="mt-2 text-xs text-gray-500">※ トリミング防止のため余白を含めた構図推奨</p>
          </div>
        )}
      </div>

      {/* プレビュー */}
      {preview && (
        <div className="mt-2">
          <p className="text-sm text-gray-600 mb-2">プレビュー：</p>
          <div className="relative">
            <img src={preview} alt="応募画像プレビュー" className="max-w-full max-h-[420px] rounded-lg border border-gray-200" />
            {meta && (
              <div className="absolute bottom-2 right-2 rounded-md bg-white/85 backdrop-blur px-2 py-1 text-[11px] text-gray-700 shadow">
                {meta.width}×{meta.height}px ・ {aspectLabel(meta.width, meta.height)}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 作品説明 */}
      <div>
        <label htmlFor="description" className="block text-sm font-semibold text-gray-800 mb-1.5">
          作品説明（任意）
        </label>
        <textarea
          id="description"
          rows={5}
          placeholder="作品の背景・制作意図・使用ツールなど（最大600文字）"
          maxLength={600}
          aria-invalid={!!errors.description}
          aria-describedby="desc_count"
          className="w-full mt-1 px-4 py-3 text-base border border-gray-300 rounded-lg bg-[#fafafa] focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-[#00a1e9] focus:bg-white placeholder:text-gray-400"
          {...register('description')}
        />
        <div className="mt-1 text-right">
          <span id="desc_count" className="text-xs text-gray-400">{descValue.length}/600</span>
        </div>
      </div>
    </section>
  );
};

export default Step2_WorkInfo;
