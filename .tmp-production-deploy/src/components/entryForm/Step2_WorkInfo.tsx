'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useFormContext } from 'react-hook-form';
import { HelpCircle } from 'lucide-react';
import type { FormValues } from '@/app/[locale]/entry/FormWrapper';

// shadcn/ui
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';

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
const MIN_SHORT_EDGE = 960; // 短辺960px以上（画質担保）

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

function errMsg(err: unknown): string | undefined {
  const m = (err as { message?: unknown })?.message;
  return typeof m === 'string' ? m : undefined;
}

function aiUsageLabel(v: FormValues['ai_usage'] | undefined) {
  if (!v) return null;
  if (v === 'none') return 'AI使用：なし';
  if (v === 'assist') return 'AI使用：補助（非生成）';
  if (v === 'gen_assist') return 'AI使用：生成AI併用';
  return null;
}

const AI_SCOPE_LABEL: Record<string, string> = {
  background: '背景',
  props: '小物・装飾',
  inpaint: '部分補完・不要物除去',
  other: 'その他',
};

function formatAiScope(scope: string[]) {
  return scope.map((k) => AI_SCOPE_LABEL[k] ?? k);
}

const Step2_WorkInfo = ({
  preview,
  setPreview,
  localImageFile: _localImageFile,
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
  const galleryType = watch('gallery_type');
  const titleValue: string = watch('title') || '';
  const descValue: string = watch('description') || '';
  const hasSignature = watch('has_signature');
  const aiUsage = watch('ai_usage');
  const aiUsageScope = watch('ai_usage_scope') || [];
  const aiUsageNote = watch('ai_usage_note') || '';

  const [isDragging, setIsDragging] = useState(false);
  const [meta, setMeta] = useState<{ width: number; height: number } | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);

  // ページトップへスクロール
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  // 初期値が未設定なら White を既定にする（選択済みの場合は上書きしない）
  useEffect(() => {
    if (!galleryType) {
      setValue('gallery_type', 'white', { shouldDirty: false, shouldValidate: true });
    }
  }, [galleryType, setValue]);

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

  const selectedAiBadge = useMemo(() => aiUsageLabel(aiUsage), [aiUsage]);
  const formattedScope = useMemo(() => formatAiScope(aiUsageScope), [aiUsageScope]);

  return (
    <section
      className="w-full max-w-[720px] mx-auto rounded-2xl bg-white p-6 sm:p-8 shadow-sm ring-1 ring-gray-100 space-y-6"
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

      {/* 1) 応募先ギャラリー */}
      <div>
        <label className="block text-sm font-semibold text-gray-800 mb-1.5">
          応募先ギャラリー <span className="text-red-600">＊</span>
        </label>

        <div role="radiogroup" className="grid gap-3">
          <label className="inline-flex items-start gap-2 rounded-lg border border-gray-300 px-3 py-2 hover:bg-gray-50 cursor-pointer">
            <input
              type="radio"
              value="white"
              {...register('gallery_type', {
                required: '応募先ギャラリーを選択してください。',
              })}
            />
            <span className="text-sm text-gray-800">
              <span className="font-semibold">White Gallery</span>
              <span className="block text-xs text-gray-500 mt-0.5">
                常設展示（審査後に公開）
              </span>
            </span>
          </label>

          <label className="inline-flex items-start gap-2 rounded-lg border border-gray-300 px-3 py-2 hover:bg-gray-50 cursor-pointer">
            <input
              type="radio"
              value="float"
              {...register('gallery_type', {
                required: '応募先ギャラリーを選択してください。',
              })}
            />
            <span className="text-sm text-gray-800">
              <span className="font-semibold">Float Gallery</span>
              <span className="block text-xs text-gray-500 mt-0.5">
                期間限定展示（公開期間は約1か月）
              </span>
            </span>
          </label>
        </div>

        {(() => {
          const m = errMsg(errors.gallery_type);
          return m ? <p role="alert" className="mt-1.5 text-sm text-red-600">{m}</p> : null;
        })()}
      </div>

      {/* 2) 作品タイトル */}
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

      {/* 3) 作品画像（D&D対応 + 統合ヘルプモーダル） */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center">
            <label htmlFor="image" className="text-sm font-semibold text-gray-800">
              作品画像 <span className="text-red-600">＊</span>（10MB以下）
            </label>

            {/* 統合ヘルプ（推奨画像 + 画像保護/サイン + AI区分） */}
            <Dialog open={helpOpen} onOpenChange={setHelpOpen}>
              <DialogTrigger asChild>
                <button
                  type="button"
                  className="ml-2 inline-flex items-center gap-1 rounded-md px-2 py-1 text-[#00a1e9] hover:text-[#007bb8] hover:bg-[#f0fbff]"
                  title="推奨画像・画像保護・AI使用区分について"
                >
                  <HelpCircle size={18} />
                  <span className="text-xs font-semibold">ヘルプ</span>
                </button>
              </DialogTrigger>
              <DialogContent className="max-w-[720px]">
                <DialogHeader>
                  <DialogTitle className="text-base">応募画像のヘルプ</DialogTitle>
                </DialogHeader>

                <Tabs defaultValue="image" className="w-full">
                  <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="image">推奨画像</TabsTrigger>
                    <TabsTrigger value="protect">画像保護</TabsTrigger>
                    <TabsTrigger value="ai">AI使用区分</TabsTrigger>
                  </TabsList>

                  <TabsContent value="image" className="mt-4 space-y-3">
                    <div className="text-sm text-gray-700 leading-relaxed">
                      品質と表示安定のため、以下の目安を推奨しています。
                    </div>

                    <div className="rounded-xl border bg-gray-50 p-4 text-sm">
                      <ul className="list-disc pl-5 space-y-1 text-gray-700">
                        <li>正方形：2000 × 2000px</li>
                        <li>横長：2400 × 1600px（3:2）</li>
                        <li>縦長：1600 × 2400px（2:3）</li>
                        <li>最大：一辺 {MAX_EDGE}px以内／{Math.floor(MAX_BYTES / (1024 * 1024))}MB以下</li>
                        <li>形式：JPEG / PNG（sRGB推奨）</li>
                      </ul>
                      <p className="mt-2 text-xs text-gray-500">
                        ※ トリミングを避けたい場合は、端に要素を寄せすぎず余白を確保してください。
                      </p>
                    </div>
                  </TabsContent>

                  <TabsContent value="protect" className="mt-4 space-y-3">
                    <div className="text-sm text-gray-700 leading-relaxed">
                      me-ish はアーティストの権利を尊重し、無断利用・無断学習の抑止を目的として運用しています。
                    </div>

                    <Accordion type="single" collapsible className="w-full">
                      <AccordionItem value="sig">
                        <AccordionTrigger>作者サインについて</AccordionTrigger>
                        <AccordionContent>
                          <div className="space-y-2 text-sm text-gray-700">
                            <p>
                              基本方針として<strong>作者サイン入り作品を推奨</strong>しています。
                            </p>
                            <p>
                              サインがない場合、公開前に me-ish が <em>「created by 作家名」</em> の
                              <strong>ウォーターマーク（右下）</strong>を自動付与します。
                            </p>
                            <p className="text-xs text-gray-500">
                              ※ サインがある場合は見切れないよう、端から少し余白を取るのがおすすめです。
                            </p>
                          </div>
                        </AccordionContent>
                      </AccordionItem>

                      <AccordionItem value="ai-block">
                        <AccordionTrigger>AI認識阻害処理について</AccordionTrigger>
                        <AccordionContent>
                          <div className="space-y-2 text-sm text-gray-700">
                            <p>
                              公開前に、状況に応じて<strong>AI認識阻害処理</strong>を実施します（恒久的効果は保証しません）。
                            </p>
                            <ul className="list-disc pl-5 space-y-1">
                              <li>ウォーターマーク（視覚的透かし）</li>
                              <li>ステガノグラフィー（不可視情報の埋め込み）</li>
                              <li>微細ノイズ等の付加による学習阻害（例：Glaze 等）</li>
                            </ul>
                            <p className="text-xs text-gray-500">
                              ※ 端末性能や表示品質に配慮しつつ、運用ポリシーに基づいて付与します。
                            </p>
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    </Accordion>
                  </TabsContent>

                  <TabsContent value="ai" className="mt-4 space-y-3">
                    <div className="text-sm text-gray-700 leading-relaxed">
                      この項目は、閲覧者・購入者の誤認防止のために確認しています。<strong>選択内容は作品ページに表示されます</strong>（将来的にギャラリー一覧にも反映する可能性があります）。
                    </div>

                    <div className="rounded-xl border bg-gray-50 p-4 text-sm text-gray-700 space-y-2">
                      <p className="font-semibold">判定の基本ルール</p>
                      <ul className="list-disc pl-5 space-y-1">
                        <li><strong>画像を生成していない</strong>（文章の提案・分析、非生成の補助のみ） → <strong>AI補助（非生成）</strong></li>
                        <li><strong>画像を生成した</strong>（ラフ/構図案/背景/部分補完など、工程の一部でも） → <strong>生成AI併用</strong></li>
                      </ul>
                      <Separator className="my-3" />
                      <p className="font-semibold">迷いがちな例</p>
                      <ul className="list-disc pl-5 space-y-1">
                        <li>文章で構図案を提案してもらった → <strong>AI補助（非生成）</strong></li>
                        <li>画像生成AIで構図ラフを作り参考にした → <strong>生成AI併用</strong></li>
                        <li>インペイント/アウトペイントで部分補完した → <strong>生成AI併用</strong></li>
                        <li>ノイズ除去/アップスケール/手ブレ補正 → <strong>AI補助（非生成）</strong></li>
                      </ul>
                      <p className="mt-2 text-xs text-gray-500">
                        ※ 迷う場合は「生成AI併用」を選ぶのが安全です（透明性を優先）。
                      </p>
                    </div>
                  </TabsContent>
                </Tabs>
              </DialogContent>
            </Dialog>
          </div>

          {/* 選択中のAI区分（控えめな視認性サポート：未選択なら非表示） */}
          {selectedAiBadge ? (
            <Badge variant="secondary" className="text-xs">
              {selectedAiBadge}
            </Badge>
          ) : null}
        </div>

        <label
          htmlFor="image"
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={onDrop}
          className={[
            'block w-full rounded-xl px-4 py-8 text-center transition border-2',
            isDragging
              ? 'border-[#00a1e9] ring-2 ring-[#00a1e9]/30 bg-[#f5fbff]'
              : 'border-dashed border-gray-300 hover:border-gray-400',
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

        {(() => {
          const m = errMsg(errors.image);
          return m ? <p role="alert" className="text-sm text-red-600 mt-2">{m}</p> : null;
        })()}

        {/* プレビュー */}
        {preview && (
          <div className="mt-3">
            <p className="text-sm text-gray-600 mb-2">プレビュー：</p>
            <div className="relative">
              <img
                src={preview}
                alt="応募画像プレビュー"
                className="max-w-full max-h-[420px] rounded-lg border border-gray-200"
              />
              {meta && (
                <div className="absolute bottom-2 right-2 rounded-md bg-white/85 backdrop-blur px-2 py-1 text-[11px] text-gray-700 shadow">
                  {meta.width}×{meta.height}px ・ {aspectLabel(meta.width, meta.height)}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 4) 作品説明 */}
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

      {/* 5) サイン有無（必須） */}
      <div>
        <label className="block text-sm font-semibold text-gray-800 mb-1.5">
          この作品に<strong>作者サイン</strong>は含まれていますか？ <span className="text-red-600">＊</span>
        </label>
        <div role="radiogroup" className="flex flex-wrap gap-3">
          <label className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 hover:bg-gray-50 cursor-pointer">
            <input
              type="radio"
              value="yes"
              {...register('has_signature', { required: 'サインの有無を選択してください。' })}
            />
            <span className="text-sm text-gray-800">はい（作者サインが入っています）</span>
          </label>
          <label className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 hover:bg-gray-50 cursor-pointer">
            <input
              type="radio"
              value="no"
              {...register('has_signature', { required: 'サインの有無を選択してください。' })}
            />
            <span className="text-sm text-gray-800">いいえ（me-ish のWM付与に同意します）</span>
          </label>
        </div>

        {(() => {
          const m = errMsg(errors.has_signature);
          return m ? <p role="alert" className="mt-1.5 text-sm text-red-600">{m}</p> : null;
        })()}

        {hasSignature === 'yes' && (
          <p className="mt-2 text-xs text-gray-600">
            ※ サインが見切れないよう、端から少し余白を確保することをおすすめします。
          </p>
        )}
        {hasSignature === 'no' && (
          <p className="mt-2 text-xs text-gray-600">
            ※ me-ish のWMは<strong>右下に小さめ</strong>で入ります（白背景でも視認性を確保）。作家名は応募情報の表記に合わせます。
          </p>
        )}
      </div>

      {/* 6) AI使用区分（必須） */}
      <div>
        <label className="block text-sm font-semibold text-gray-800 mb-1.5">
          制作におけるAIの使用について <span className="text-red-600">＊</span>
        </label>

        <p className="text-xs text-gray-500 mb-2">
          選択内容は、公開後に作品ページへ表示されます（誤認防止・透明性のため）。
        </p>

        <div role="radiogroup" className="grid gap-3">
          <label className="inline-flex items-start gap-2 rounded-lg border border-gray-300 px-3 py-2 hover:bg-gray-50 cursor-pointer">
            <input
              type="radio"
              value="none"
              {...register('ai_usage', { required: 'AI使用区分を選択してください。' })}
            />
            <span className="text-sm text-gray-800">
              <span className="font-semibold">使用していない</span>
              <span className="block text-xs text-gray-500 mt-0.5">
                手描き（生成AIで画像そのものは作っていない）
              </span>
            </span>
          </label>

          <label className="inline-flex items-start gap-2 rounded-lg border border-gray-300 px-3 py-2 hover:bg-gray-50 cursor-pointer">
            <input
              type="radio"
              value="assist"
              {...register('ai_usage', { required: 'AI使用区分を選択してください。' })}
            />
            <span className="text-sm text-gray-800">
              <span className="font-semibold">AI補助（非生成）</span>
              <span className="block text-xs text-gray-500 mt-0.5">
                例：ノイズ除去／アップスケール／手ブレ補正／色味調整／文章での構図提案 など
              </span>
            </span>
          </label>

          <label className="inline-flex items-start gap-2 rounded-lg border border-gray-300 px-3 py-2 hover:bg-gray-50 cursor-pointer">
            <input
              type="radio"
              value="gen_assist"
              {...register('ai_usage', { required: 'AI使用区分を選択してください。' })}
            />
            <span className="text-sm text-gray-800">
              <span className="font-semibold">生成AI併用（背景・小物・一部補完など）</span>
              <span className="block text-xs text-gray-500 mt-0.5">
                例：画像生成AIでラフ/構図案、背景素材、インペイント等を制作工程に使用
              </span>
            </span>
          </label>
        </div>

        {(() => {
          const m = errMsg(errors.ai_usage);
          return m ? <p role="alert" className="mt-1.5 text-sm text-red-600">{m}</p> : null;
        })()}

        {aiUsage === 'gen_assist' && (
          <div className="mt-3 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-[13px] leading-relaxed text-blue-900">
            <p className="font-semibold">生成AI併用を選んだ方へ（任意）</p>
            <p className="mt-1 text-xs text-blue-800/90">
              使用範囲を簡単に記載してください（誤認防止・透明性のため）。
            </p>

            <div className="mt-2 grid gap-2">
              <label className="inline-flex items-center gap-2 text-sm">
                <input type="checkbox" value="background" {...register('ai_usage_scope')} />
                <span>背景</span>
              </label>
              <label className="inline-flex items-center gap-2 text-sm">
                <input type="checkbox" value="props" {...register('ai_usage_scope')} />
                <span>小物・装飾</span>
              </label>
              <label className="inline-flex items-center gap-2 text-sm">
                <input type="checkbox" value="inpaint" {...register('ai_usage_scope')} />
                <span>部分補完・不要物除去（インペイント等）</span>
              </label>
              <label className="inline-flex items-center gap-2 text-sm">
                <input type="checkbox" value="other" {...register('ai_usage_scope')} />
                <span>その他</span>
              </label>

              <input
                type="text"
                placeholder="補足（任意）：例）背景のみ生成→上から描き起こし"
                className="w-full mt-1 px-3 py-2 rounded-lg border border-blue-200 bg-white focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-[#00a1e9] placeholder:text-gray-400"
                {...register('ai_usage_note')}
              />

              {/* 軽いサマリ（入力がある時だけ） */}
              {(aiUsageScope.length > 0 || aiUsageNote.trim().length > 0) && (
                <div className="mt-1 text-xs text-blue-900/80">
                  <span className="font-semibold">入力内容：</span>
                  {aiUsageScope.length > 0 ? (
                    <span className="mr-2">
                      範囲：{formattedScope.join(' / ')}
                    </span>
                  ) : null}
                  {aiUsageNote.trim().length > 0 ? (
                    <span>補足：{aiUsageNote.trim()}</span>
                  ) : null}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </section>
  );
};

export default Step2_WorkInfo;
