'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useFormContext } from 'react-hook-form';
import { getDisplayPlanStats } from '@/lib/getDisplayPlanStats';
import type { FormValues } from '@/app/[locale]/entry/FormWrapper';
import BankBranchFields from '@/components/entryForm/BankBranchFields';

// shadcn/ui（Step2で導入済み前提）
import { Badge } from '@/components/ui/badge';

const BRAND = '#00a1e9';
const FEE_RATE = 0.10;

/** 通常運用: すべてのプランを選択可能 */
const FREE_ONLY = false;

const planKeys = ['free', 'mini', 'light', 'standard', 'premium'] as const;
type PlanKey = typeof planKeys[number];

const GUARANTEED_VIEWS: Record<PlanKey, number> = {
  free: 0,
  mini: 1,
  light: 3,
  standard: 7,
  premium: 15,
};

function errMsg(err: unknown): string | undefined {
  const m = (err as { message?: unknown })?.message;
  return typeof m === 'string' ? m : undefined;
}

const yen = (n: number) => new Intl.NumberFormat('ja-JP').format(n);

function aiUsageLabel(v: FormValues['ai_usage'] | undefined) {
  if (!v) return null;
  if (v === 'none') return 'AI使用：なし';
  if (v === 'assist') return 'AI使用：補助（非生成）';
  if (v === 'gen_assist') return 'AI使用：生成AI併用';
  return null;
}

const Step3_SalesAndAgreement = () => {
  const {
    register,
    watch,
    setValue,
    formState: { errors },
  } = useFormContext<FormValues>();

  const isForSale = watch('isForSale');
  const priceRaw = watch('price') ?? '';
  const editionMode = watch('editionMode');
  const editionTotal = watch('editionTotal') ?? '';

  // Step2のAI申告を参照（Step3の規約/同意文言と整合させる）
  const aiUsage = watch('ai_usage');
  const selectedAiBadge = useMemo(() => aiUsageLabel(aiUsage), [aiUsage]);

  const [canCheck, setCanCheck] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [stats, setStats] = useState<Record<PlanKey, number>>();
  const [totalUsage, setTotalUsage] = useState(0);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  // ★ Free固定をフォーム値に反映（初回のみ）
  useEffect(() => {
    if (FREE_ONLY) {
      setValue('displayPlan', 'free', { shouldDirty: false, shouldValidate: true });
    }
  }, [setValue]);

  // 販売=はい の場合は saleType を常に normal に固定（通常販売のみ）
  useEffect(() => {
    if (isForSale === 'yes') {
      setValue('saleType', 'normal' as unknown as FormValues['saleType'], {
        shouldDirty: false,
        shouldValidate: false,
      });
    } else if (isForSale === 'no') {
      // 販売しない場合は saleType を空にしておく（保存データの混乱回避）
      setValue('saleType', undefined as unknown as FormValues['saleType'], {
        shouldDirty: false,
        shouldValidate: false,
      });
    }
  }, [isForSale, setValue]);

  // 規約ボックス全読了でチェック可能
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const handleScroll = () => {
      const isBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 1;
      if (isBottom) setCanCheck(true);
    };
    el.addEventListener('scroll', handleScroll);
    if (el.scrollHeight <= el.clientHeight) setCanCheck(true);
    else handleScroll();
    return () => el.removeEventListener('scroll', handleScroll);
  }, []);

  // プラン混雑率
  useEffect(() => {
    getDisplayPlanStats().then((res) => {
      if (!res) return;
      setStats(res);
      const total = (Object.entries(res) as [PlanKey, number][])
        .reduce((sum, [plan, count]) => sum + GUARANTEED_VIEWS[plan] * count, 0);
      setTotalUsage(total);
    });
  }, []);

  const priceNum = useMemo(() => {
    const n = Number(String(priceRaw).replace(/[^\d]/g, ''));
    return Number.isFinite(n) ? n : 0;
  }, [priceRaw]);

  const fee = Math.floor(priceNum * FEE_RATE);
  const reward = Math.max(0, priceNum - fee);

  const recommendPlan: PlanKey | null = useMemo(() => {
    if (!stats) return null;
    const usageRate = totalUsage / 960;
    if (usageRate <= 0.1) return 'free';
    if (usageRate <= 0.3) return 'mini';
    if (usageRate <= 0.7) return 'light';
    return 'standard';
  }, [stats, totalUsage]);

  /** ★ 表示保証プランのUI（Free以外は押せない） */
  const renderPlanLabel = (plan: PlanKey, label: string) => {
    const applicants = stats?.[plan] ?? 0;
    const slotUsage = GUARANTEED_VIEWS[plan] * applicants;
    const percentage = ((slotUsage / 960) * 100).toFixed(1);
    const isCrowded = parseFloat(percentage) >= 25;
    const isRecommended = plan === recommendPlan;

    const isDisabled = FREE_ONLY && plan !== 'free';

    return (
      <label
        className={[
          'flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 p-3 border rounded-lg transition',
          isDisabled ? 'opacity-50 cursor-not-allowed' : 'hover:border-gray-400',
        ].join(' ')}
        aria-disabled={isDisabled}
        title={isDisabled ? '現在は Free のみ選択可能です' : undefined}
      >
        <input
          type="radio"
          value={plan}
          className="mt-0.5"
          disabled={isDisabled}
          {...register('displayPlan', { required: '表示保証プランを選択してください。' })}
        />
        <div>
          <span className="font-medium text-gray-900">{label}</span>
          {isRecommended && (
            <span className="ml-2 px-2 py-0.5 text-xs text-white bg-green-600 rounded-full font-bold shadow-sm">
              ★ おすすめ
            </span>
          )}
          <div className="text-xs text-gray-500 mt-1">
            現在 {applicants}人が選択中 / 全体の {percentage}% 使用中
            {isCrowded && <span className="text-red-600 font-semibold ml-2">※混雑しています</span>}
            {isDisabled && <span className="ml-2 text-gray-500">（Free のみ選択可）</span>}
          </div>
        </div>
      </label>
    );
  };

  return (
    <section
      className="w-full max-w-[720px] mx-auto p-6 sm:p-8 bg-white rounded-2xl shadow-sm ring-1 ring-gray-100 space-y-6"
      aria-labelledby="sale-agree-title"
    >
      <header className="space-y-2">
        <h2 id="sale-agree-title" className="text-[22px] font-bold text-gray-900 flex items-center gap-3">
          <span className="inline-block h-5 w-1.5 rounded-full" style={{ backgroundColor: BRAND }} aria-hidden />
          販売設定・規約同意
        </h2>

        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm text-gray-600">
            販売・エディション・表示プラン・規約同意を設定します。
          </p>
          {selectedAiBadge ? (
            <Badge variant="secondary" className="text-xs">
              {selectedAiBadge}
            </Badge>
          ) : null}
        </div>

        <p className="text-xs text-gray-500">
          ※ 「AI使用区分」は応募情報として扱われ、公開後に作品ページへ表示されます（誤認防止・透明性のため）。
        </p>
      </header>

      {/* 販売するか */}
      <div>
        <label className="block text-sm font-semibold text-gray-800 mb-1.5">
          この作品を販売しますか？ <span className="text-red-600">＊</span>
        </label>
        <div className="mt-2 flex gap-6">
          <label className="flex items-center gap-2">
            <input
              type="radio"
              value="yes"
              {...register('isForSale', { required: '販売有無を選択してください。' })}
            />
            はい
          </label>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              value="no"
              {...register('isForSale', { required: '販売有無を選択してください。' })}
            />
            いいえ
          </label>
        </div>
        {(() => {
          const m = errMsg(errors.isForSale);
          return m ? <p className="text-sm text-red-600 mt-1.5">{m}</p> : null;
        })()}
      </div>

      {/* 販売詳細（販売=はい のときだけ） */}
      {isForSale === 'yes' && (
        <>
          {/* 価格 */}
          <div>
            <label htmlFor="price" className="block text-sm font-semibold text-gray-800 mb-1.5">
              販売価格（円・税込） <span className="text-red-600">＊</span>
            </label>
            <input
              id="price"
              type="number"
              inputMode="numeric"
              min={1}
              placeholder="例：5000"
              className="w-full px-4 py-3 mt-1.5 text-base bg-[#fafafa] border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00a1e9] focus:bg-white"
              {...register('price', {
                required: '販売価格を入力してください。',
                validate: (v: string) => {
                  const n = Number(String(v).replace(/[^\d]/g, ''));
                  if (!Number.isFinite(n) || n <= 0) return '0より大きい金額を入力してください。';
                  if (n > 1_000_000) return '上限は1,000,000円です。';
                  return true;
                },
              })}
            />
            <small className="text-[#666] mt-1 block">※円単位・半角数字のみ</small>

            {priceNum > 0 && (
              <p className="text-sm text-gray-700 mt-2">
                アーティスト報酬：<span className="font-bold">¥{yen(reward)}</span> ／ me-ish手数料（{Math.round(FEE_RATE * 100)}%）：
                <span className="font-bold">¥{yen(fee)}</span>
              </p>
            )}
            {(() => {
              const m = errMsg(errors.price);
              return m ? <p className="text-sm text-red-600 mt-1.5">{m}</p> : null;
            })()}
          </div>

          {/* 販売点数 */}
          <div>
            <label className="block text-sm font-semibold text-gray-800 mb-1.5">
              販売点数（エディション数 or 無制限） <span className="text-red-600">＊</span>
            </label>

            <div className="mt-2 flex gap-6">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  value="limited"
                  {...register('editionMode', { required: '販売点数を選択してください。' })}
                />
                エディション指定
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  value="unlimited"
                  {...register('editionMode', { required: '販売点数を選択してください。' })}
                />
                無制限
              </label>
            </div>

            {/* editionTotal は limited のときだけ表示 */}
            {editionMode === 'limited' && (
              <div className="mt-2">
                <input
                  id="editionTotal"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={10}
                  placeholder="例：5"
                  className="w-full px-4 py-3 mt-1.5 text-base bg-[#fafafa] border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#00a1e9]"
                  {...register('editionTotal', {
                    validate: (v: string) => {
                      if (editionMode !== 'limited') return true;
                      const n = Number(String(v).replace(/[^\d]/g, ''));
                      if (!Number.isFinite(n) || n <= 0) return '販売点数を入力してください。';
                      if (n < 1) return '1以上を入力してください。';
                      if (n > 10) return '最大10点まで指定できます。';
                      return true;
                    },
                  })}
                />
                <small className="text-[#666] mt-1 block">※1〜10の範囲で指定</small>
              </div>
            )}

            {(() => {
              const m = errMsg(errors.editionMode) || errMsg(errors.editionTotal);
              return m ? <p className="text-sm text-red-600 mt-1.5">{m}</p> : null;
            })()}
          </div>

          {/* 表示保証プラン */}
          <div>
            <label className="block text-sm font-semibold text-gray-800 mb-1.5">
              表示保証プランの選択 <span className="text-red-600">＊</span>
            </label>
            {FREE_ONLY && (
              <p className="text-xs text-gray-500 mb-2">
                ※ 現在の募集では <strong>Free</strong> のみ選択できます。他プランは準備中です。
              </p>
            )}
            <div className="mt-3 flex flex-col gap-3">
              {renderPlanLabel('free', 'Free（¥0 / 表示保証なし・ローテーション枠）')}
              {renderPlanLabel('mini', 'Mini（¥400 / 月4回保証）')}
              {renderPlanLabel('light', 'Light（¥800 / 月9回保証）')}
              {renderPlanLabel('standard', 'Standard（¥1,200 / 月14回保証）')}
              {renderPlanLabel('premium', 'Premium（¥2,400 / 月30回保証）')}
            </div>
            <small className="text-sm text-blue-600 mt-3 block">
              現在、全体使用率は {((totalUsage / 960) * 100).toFixed(1)}% です。
            </small>
            {(() => {
              const m = errMsg(errors.displayPlan);
              return m ? <p className="text-sm text-red-600 mt-1.5">{m}</p> : null;
            })()}
          </div>

          {/* ★ 追加：口座入力 */}
          <BankBranchFields />
        </>
      )}

      <hr className="my-6 border-t border-gray-200" />

      {/* 規約ボックス（要点） */}
      <div
        ref={scrollRef}
        className="max-h-[190px] overflow-y-auto border border-gray-300 bg-[#fafafa] p-4 rounded-lg text-sm leading-relaxed text-gray-700"
        aria-label="利用規約の要点（スクロールして全文確認）"
      >
        <p className="font-bold text-gray-900">【利用規約の要点（重要）】</p>

        <p className="mt-2 text-xs text-gray-500">
          ※ ここは要点です。応募前に必ず最後までスクロールし、詳細（利用規約・プライバシーポリシー）もご確認ください。
        </p>

        <div className="mt-3 space-y-3">
          {/* 1) 展示・審査 */}
          <div>
            <p className="font-semibold text-gray-900">1. 展示・審査</p>
            <ul className="list-disc list-inside mt-1 space-y-1">
              <li>投稿作品は審査の上、me-ishで展示される場合があります（展示は確約ではありません）。</li>
              <li>展示・販売の可否や掲載タイミングは運営判断となります。</li>
            </ul>
          </div>

          {/* 2) 著作権・利用許諾 */}
          <div>
            <p className="font-semibold text-gray-900">2. 著作権と利用許諾（必須）</p>
            <ul className="list-disc list-inside mt-1 space-y-1">
              <li>著作権はアーティストに帰属します（権利の譲渡は発生しません）。</li>
              <li>
                me-ishは、サービス提供（展示表示・販売・審査・運営/不正防止・問い合わせ対応）のために、作品画像・作品名・作家名等を利用します。
              </li>
              <li>購入者には私的鑑賞の範囲での使用が許可されます（著作権の譲渡なし）。</li>
            </ul>
          </div>

          {/* 3) 禁止事項・権利侵害 */}
          <div>
            <p className="font-semibold text-gray-900">3. 禁止事項（必須）</p>
            <ul className="list-disc list-inside mt-1 space-y-1">
              <li>第三者の権利（著作権・商標権・肖像権等）を侵害する作品は禁止です。</li>
              <li>公序良俗に反する内容、誹謗中傷、違法な内容を含む作品は禁止です。</li>
            </ul>
          </div>

          {/* 4) AI利用ポリシー */}
          <div>
            <p className="font-semibold text-gray-900">4. 生成AIに関するルール（必須）</p>
            <ul className="list-disc list-inside mt-1 space-y-1">
              <li>
                <strong>完全自動生成（生成AIの出力のみで、人の創作性がほぼ無い）作品は受け付けません。</strong>
              </li>
              <li>
                AIを使用した場合は、応募フォームの<strong>AI使用区分</strong>で申告してください（申告内容は作品ページに表示されます）。
              </li>
            </ul>
          </div>

          {/* 5) 公式広報（任意） */}
          <div>
            <p className="font-semibold text-gray-900">5. 公式広報での紹介（任意）</p>
            <ul className="list-disc list-inside mt-1 space-y-1">
              <li>
                同意いただいた場合、me-ish公式の広報（サイト・SNS・告知記事等）で、
                作品画像（サムネ/一部トリミングを含む）・作品名・作家名・展示情報を紹介することがあります。
              </li>
              <li>
                広報は閲覧用途の形式で行い、原寸データの配布や二次利用許諾を意味しません。
              </li>
            </ul>
          </div>

          {/* 6) 保管（任意） */}
          <div>
            <p className="font-semibold text-gray-900">6. 作品データの保管（任意）</p>
            <ul className="list-disc list-inside mt-1 space-y-1">
              <li>
                同意いただいた場合、マイページのポートフォリオ機能のために、展示終了後も作品データ（画像・メタデータ）をme-ishが保持します。
              </li>
              <li>
                同意しない場合、展示期間終了後に削除対象となります（ただし、決済・返金・紛争対応等のため、運営上必要な最小限の情報を一定期間保持する場合があります）。
              </li>
            </ul>
          </div>
        </div>

        <p className="mt-3 text-xs text-gray-600">
          詳細は
          <a
            href="/footer/terms"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 underline ml-1"
          >
            利用規約
          </a>
          と
          <a
            href="/footer/privacy"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 underline ml-1"
          >
            プライバシーポリシー
          </a>
          をご確認ください。
        </p>
      </div>

      {/* 同意チェック（必須） */}
      <div className="mt-4 space-y-3 text-gray-800">
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            {...register("agreeTerms", { required: "利用規約への同意が必要です。" })}
            disabled={!canCheck}
          />
          <span className="text-sm">
            上記の要点を確認し、利用規約・プライバシーポリシーに同意します
          </span>
          <span className="text-red-600 text-xs ml-2">＊必須（全文をスクロールすると有効化）</span>
        </div>
        {(() => {
          const m = errMsg(errors.agreeTerms);
          return m ? <p className="text-sm text-red-600 -mt-1.5">{m}</p> : null;
        })()}

        <div className="flex items-center gap-2">
          <input type="checkbox" {...register("confirmRights", { required: "権利確認が必要です。" })} />
          <span className="text-sm">自作作品であり、第三者の権利を侵害していません</span>
          <span className="text-red-600 text-xs ml-2">＊必須</span>
        </div>
        {(() => {
          const m = errMsg(errors.confirmRights);
          return m ? <p className="text-sm text-red-600 -mt-1.5">{m}</p> : null;
        })()}

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            {...register("confirmOriginal", {
              required: "申告内容（AI使用区分を含む）の確認が必要です。",
            })}
          />
          <span className="text-sm">
            AI使用区分を含め、申告内容に虚偽がありません（完全自動生成のみの作品ではありません）
          </span>
          <span className="text-red-600 text-xs ml-2">＊必須</span>
        </div>
        {(() => {
          const m = errMsg(errors.confirmOriginal);
          return m ? <p className="text-sm text-red-600 -mt-1.5">{m}</p> : null;
        })()}

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            {...register("confirmAge", {
              required: "年齢確認が必要です。",
            })}
          />
          <span className="text-sm">
            18歳以上です、または保護者の同意を得ています
          </span>
          <span className="text-red-600 text-xs ml-2">＊必須</span>
        </div>
        {(() => {
          const m = errMsg(errors.confirmAge);
          return m ? <p className="text-sm text-red-600 -mt-1.5">{m}</p> : null;
        })()}
      </div>

      {/* 追加の同意（任意） */}
      <div className="mt-6 rounded-xl border border-gray-200 bg-white p-4 text-gray-800">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold">追加の同意（任意）</span>
          <Badge variant="secondary" className="text-xs">おすすめ</Badge>
        </div>

        <p className="mt-2 text-xs text-gray-500">
          ※ ここは任意です。チェックしなくても応募・展示の審査には影響しません。
        </p>

        <div className="mt-4 space-y-3">
          <label className="flex items-start gap-2">
            <input type="checkbox" {...register("agreePromotion")} />
            <span className="text-sm leading-relaxed">
              me-ish公式の広報（サイト・SNS・告知記事等）で、作品画像（サムネ/一部トリミングを含む）・作品名・作家名・展示情報を紹介することに同意します
            </span>
          </label>

          <label className="flex items-start gap-2">
            <input type="checkbox" {...register("agreeStorage")} />
            <span className="text-sm leading-relaxed">
              マイページでポートフォリオ機能を利用するため、展示終了後も作品データ（画像・メタデータ）をme-ishが保持することに同意します
            </span>
          </label>

          <p className="text-xs text-gray-500">
            ※ 同意はマイページからいつでも変更できます。
          </p>
        </div>
      </div>

    </section>
  );
};

export default Step3_SalesAndAgreement;