'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useFormContext } from 'react-hook-form';
import { getDisplayPlanStats } from '@/lib/getDisplayPlanStats';
import type { FormValues } from '@/app/entry/FormWrapper';

const BRAND = '#00a1e9';
const FEE_RATE = 0.15;

const planKeys = ['free', 'mini', 'light', 'standard', 'premium'] as const;
type PlanKey = typeof planKeys[number];

const GUARANTEED_VIEWS: Record<PlanKey, number> = {
  free: 0,
  mini: 1,
  light: 3,
  standard: 7,
  premium: 15,
};

// 型安全にエラーメッセージだけ取り出す
function errMsg(err: unknown): string | undefined {
  const m = (err as { message?: unknown })?.message;
  return typeof m === 'string' ? m : undefined;
}

const yen = (n: number) => new Intl.NumberFormat('ja-JP').format(n);

const Step3_SalesAndAgreement = () => {
  const {
    register,
    watch,
    formState: { errors },
  } = useFormContext<FormValues>();

  const isForSale = watch('isForSale');       // 'yes' | 'no' | ''
  const saleType = watch('saleType');
  const priceRaw = watch('price') ?? '';
  const editionTotal = watch('editionTotal') ?? '';

  const [canCheck, setCanCheck] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [stats, setStats] = useState<Record<PlanKey, number>>();
  const [totalUsage, setTotalUsage] = useState(0);

  // ページトップへ
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  // 規約スクロール完了で agreeTerms を有効化
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const handleScroll = () => {
      const isBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 1;
      if (isBottom) setCanCheck(true);
    };
    el.addEventListener('scroll', handleScroll);
    return () => el.removeEventListener('scroll', handleScroll);
  }, []);

  // プラン使用状況を取得
  useEffect(() => {
    getDisplayPlanStats().then((res) => {
      if (!res) return;
      setStats(res);
      const total = (Object.entries(res) as [PlanKey, number][])
        .reduce((sum, [plan, count]) => sum + GUARANTEED_VIEWS[plan] * count, 0);
      setTotalUsage(total);
    });
  }, []);

  // 価格→報酬のリアルタイム計算
  const priceNum = useMemo(() => {
    const n = Number(String(priceRaw).replace(/[^\d]/g, ''));
    return Number.isFinite(n) ? n : 0;
  }, [priceRaw]);

  const fee = Math.floor(priceNum * FEE_RATE);
  const reward = Math.max(0, priceNum - fee);

  // 推奨プラン
  const recommendPlan: PlanKey | null = useMemo(() => {
    if (!stats) return null;
    const usageRate = totalUsage / 960; // 960 は仮の総枠
    if (usageRate <= 0.1) return 'free';
    if (usageRate <= 0.3) return 'mini';
    if (usageRate <= 0.7) return 'light';
    return 'standard';
  }, [stats, totalUsage]);

  const renderPlanLabel = (plan: PlanKey, label: string) => {
    const applicants = stats?.[plan] ?? 0;
    const slotUsage = GUARANTEED_VIEWS[plan] * applicants;
    const percentage = ((slotUsage / 960) * 100).toFixed(1);
    const isCrowded = parseFloat(percentage) >= 25;
    const isRecommended = plan === recommendPlan;

    return (
      <label className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 p-3 border rounded-lg hover:border-gray-400 transition">
        <input
          type="radio"
          value={plan}
          className="mt-0.5"
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
      <header>
        <h2 id="sale-agree-title" className="text-[22px] font-bold text-gray-900 flex items-center gap-3">
          <span className="inline-block h-5 w-1.5 rounded-full" style={{ backgroundColor: BRAND }} aria-hidden />
          販売設定・規約同意
        </h2>
      </header>

      {/* 販売するか */}
      <div>
        <label className="block text-sm font-semibold text-gray-800 mb-1.5">
          この作品を販売しますか？ <span className="text-red-600">＊</span>
        </label>
        <div className="mt-2 flex gap-6">
          <label className="flex items-center gap-2">
            <input type="radio" value="yes" {...register('isForSale', { required: '販売有無を選択してください。' })} /> はい
          </label>
          <label className="flex items-center gap-2">
            <input type="radio" value="no"  {...register('isForSale', { required: '販売有無を選択してください。' })} /> いいえ
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
          {/* 販売形式 */}
          <div>
            <label className="block text-sm font-semibold text-gray-800 mb-1.5">
              販売形式 <span className="text-red-600">＊</span>
            </label>
            <div className="mt-2 flex gap-6">
              <label className="flex items-center gap-2">
                <input type="radio" value="normal" {...register('saleType', { required: '販売形式を選択してください。' })} /> 通常販売
              </label>
              <label className="flex items-center gap-2">
                <input type="radio" value="nft"    {...register('saleType', { required: '販売形式を選択してください。' })} /> NFT販売
              </label>
            </div>
            {(() => {
              const m = errMsg(errors.saleType);
              return m ? <p className="text-sm text-red-600 mt-1.5">{m}</p> : null;
            })()}
          </div>

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

          {/* エディション数 */}
          <div>
            <label htmlFor="editionTotal" className="block text-sm font-semibold text-gray-800 mb-1.5">
              販売点数（エディション数） <span className="text-red-600">＊</span>
            </label>
            <input
              id="editionTotal"
              type="number"
              inputMode="numeric"
              min={1}
              max={10}
              placeholder="例：5"
              className="w-full px-4 py-3 mt-1.5 text-base bg-[#fafafa] border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00a1e9] focus:bg-white"
              {...register('editionTotal', {
                required: '販売点数を入力してください。',
                min: { value: 1, message: '1以上を入力してください。' },
                max: { value: 10, message: '最大10点まで指定できます。' },
              })}
            />
            <small className="text-[#666] mt-1 block">※販売点数は1〜10の範囲で指定</small>
            {(() => {
              const m = errMsg(errors.editionTotal);
              return m ? <p className="text-sm text-red-600 mt-1.5">{m}</p> : null;
            })()}
          </div>

          {/* 表示保証プラン */}
          <div>
            <label className="block text-sm font-semibold text-gray-800 mb-1.5">
              表示保証プランの選択 <span className="text-red-600">＊</span>
            </label>
            <div className="mt-3 flex flex-col gap-3">
              {renderPlanLabel('free',     'Free（¥0 / 表示保証なし・ローテーション枠）')}
              {renderPlanLabel('mini',     'Mini（¥400 / 月1回保証）')}
              {renderPlanLabel('light',    'Light（¥1,000 / 月3回保証）')}
              {renderPlanLabel('standard', 'Standard（¥2,000 / 月7回保証）')}
              {renderPlanLabel('premium',  'Premium（¥4,000 / 月15回保証）')}
            </div>
            <small className="text-sm text-blue-600 mt-3 block">
              現在、全体使用率は {((totalUsage / 960) * 100).toFixed(1)}% です。
            </small>
            {(() => {
              const m = errMsg(errors.displayPlan);
              return m ? <p className="text-sm text-red-600 mt-1.5">{m}</p> : null;
            })()}
          </div>
        </>
      )}

      <hr className="my-6 border-t border-gray-200" />

      {/* 規約ボックス */}
      <div
        ref={scrollRef}
        className="max-h-[150px] overflow-y-auto border border-gray-300 bg-[#fafafa] p-4 rounded-lg text-sm leading-relaxed text-gray-700"
      >
        <p className="font-bold">【利用規約の要点】</p>
        <ul className="list-disc list-inside mt-2 space-y-1">
          <li>投稿作品は審査の上、me-ishで展示・販売される場合があります。</li>
          <li>著作権はアーティストに帰属しますが、展示・告知に使用する場合があります。</li>
          <li>購入者には私的鑑賞の範囲での使用が許可されます（著作権の譲渡なし）。</li>
          <li>第三者の権利を侵害する作品は禁止です。</li>
          <li>生成AIによる自動生成作品は禁止です。</li>
        </ul>
        <p className="mt-2">
          詳細は
          <a href="/terms" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline ml-1">
            公式サイトの利用規約
          </a>
          をご確認ください。
        </p>
      </div>

      {/* 同意チェック 3連 */}
      <div className="flex items-center gap-2 mt-4 text-gray-800">
        <input type="checkbox" {...register('agreeTerms', { required: '利用規約への同意が必要です。' })} disabled={!canCheck} />
        <span className="text-sm">上記の利用規約に同意します</span>
        <span className="text-red-600 text-xs ml-2">＊必須（全文をスクロールすると有効化）</span>
      </div>
      {(() => {
        const m = errMsg(errors.agreeTerms);
        return m ? <p className="text-sm text-red-600 -mt-1.5">{m}</p> : null;
      })()}

      <div className="flex items-center gap-2 mt-3 text-gray-800">
        <input type="checkbox" {...register('confirmRights', { required: '権利確認が必要です。' })} />
        <span className="text-sm">自作作品であり、第三者の権利を侵害していません</span>
        <span className="text-red-600 text-xs ml-2">＊必須</span>
      </div>
      {(() => {
        const m = errMsg(errors.confirmRights);
        return m ? <p className="text-sm text-red-600 -mt-1.5">{m}</p> : null;
      })()}

      <div className="flex items-center gap-2 mt-3 text-gray-800">
        <input type="checkbox" {...register('confirmOriginal', { required: '生成AI作品ではない旨の確認が必要です。' })} />
        <span className="text-sm">AIによる自動生成作品ではありません</span>
        <span className="text-red-600 text-xs ml-2">＊必須</span>
      </div>
      {(() => {
        const m = errMsg(errors.confirmOriginal);
        return m ? <p className="text-sm text-red-600 -mt-1.5">{m}</p> : null;
      })()}
    </section>
  );
};

export default Step3_SalesAndAgreement;
