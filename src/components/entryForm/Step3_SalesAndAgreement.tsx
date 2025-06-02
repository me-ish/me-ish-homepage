'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useFormContext } from 'react-hook-form';
import { getDisplayPlanStats } from '@/lib/getDisplayPlanStats';

const planKeys = ['free', 'mini', 'light', 'standard', 'premium'] as const;
type PlanKey = typeof planKeys[number];

const GUARANTEED_VIEWS: Record<PlanKey, number> = {
  free: 0,
  mini: 1,
  light: 3,
  standard: 7,
  premium: 15,
};

const Step3_SalesAndAgreement = () => {
  const { register, watch } = useFormContext();
  const isForSale = watch('isForSale');
  const saleType = watch('saleType');

  const [canCheck, setCanCheck] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [stats, setStats] = useState<Record<PlanKey, number>>();
  const [totalUsage, setTotalUsage] = useState(0);

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

  useEffect(() => {
    getDisplayPlanStats().then((res) => {
      if (!res) return;
      setStats(res);
      const total = Object.entries(res).reduce((sum, [plan, count]) => {
        return sum + GUARANTEED_VIEWS[plan as PlanKey] * count;
      }, 0);
      setTotalUsage(total);
    });
  }, []);

  const renderPlanLabel = (plan: PlanKey, label: string) => {
    const applicants = stats?.[plan] ?? 0;
    const slotUsage = GUARANTEED_VIEWS[plan] * applicants;
    const percentage = ((slotUsage / 960) * 100).toFixed(1);
    const isCrowded = parseFloat(percentage) >= 25;

    const recommendPlan = (() => {
      const usageRate = totalUsage / 960;
      if (usageRate <= 0.1) return 'free';
      if (usageRate <= 0.3) return 'mini';
      if (usageRate <= 0.7) return 'light';
      return 'standard';
    })();

    const isRecommended = plan === recommendPlan;

    return (
      <label className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
        <input type="radio" value={plan} {...register('displayPlan', { required: true })} />
        <div>
          {label}
          {isRecommended && (
            <span className="ml-2 px-2 py-0.5 text-xs text-white bg-green-600 rounded-full font-bold shadow-sm">★ おすすめ</span>
          )}
          <div className="text-sm text-gray-500">
            現在 {applicants}人が選択中 / 全体の {percentage}% 使用中
            {isCrowded && (
              <span className="text-red-600 font-semibold ml-2">※混雑しています</span>
            )}
          </div>
        </div>
      </label>
    );
  };

  return (
    <div className="space-y-6">
      <label className="flex flex-col font-semibold text-[1rem] text-[#333] mb-6">
        この作品を販売しますか？
        <span className="text-[#e63946] text-sm ml-2">※必須</span>
        <div className="mt-2 flex gap-6 font-normal">
          <label className="flex items-center gap-2">
            <input type="radio" value="yes" {...register('isForSale', { required: true })} /> はい
          </label>
          <label className="flex items-center gap-2">
            <input type="radio" value="no" {...register('isForSale', { required: true })} /> いいえ
          </label>
        </div>
      </label>

      {isForSale === 'yes' && (
        <>
          <label className="flex flex-col font-semibold text-[1rem] text-[#333] mb-6">
            販売形式
            <span className="text-[#e63946] text-sm ml-2">※必須</span>
            <div className="mt-2 flex gap-6 font-normal">
              <label className="flex items-center gap-2">
                <input type="radio" value="normal" {...register('saleType', { required: true })} /> 通常販売
              </label>
              <label className="flex items-center gap-2">
                <input type="radio" value="nft" {...register('saleType', { required: true })} /> NFT販売
              </label>
            </div>
          </label>

          <label className="flex flex-col font-semibold text-[1rem] text-[#333] mb-6">
            販売価格（円・税込）
            <span className="text-[#e63946] text-sm ml-2">※必須</span>
            <input
              type="number"
              min="0"
              placeholder="例：5000"
              className="w-full px-4 py-3 mt-2 text-base bg-[#fafafa] border border-[#ccc] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00a1e9] focus:bg-white"
              {...register('price', { required: true })}
            />
            <small className="text-[#666] mt-1">※円単位で半角数字のみ / 税込価格</small>
          </label>

          <label className="flex flex-col font-semibold text-[1rem] text-[#333] mb-6">
            表示保証プランの選択
            <span className="text-[#e63946] text-sm ml-2">※必須</span>
            <div className="mt-4 flex flex-col gap-4 font-normal">
              {renderPlanLabel('free', 'Free（¥0 / 表示保証なし・ローテーション枠）')}
              {renderPlanLabel('mini', 'Mini（¥400 / 月1回保証）')}
              {renderPlanLabel('light', 'Light（¥1,000 / 月3回保証）')}
              {renderPlanLabel('standard', 'Standard（¥2,000 / 月7回保証）')}
              {renderPlanLabel('premium', 'Premium（¥4,000 / 月15回保証）')}
            </div>
            <small className="text-[#666] mt-2">
              ※表示保証付きプランを選ぶと、1ヶ月の間に指定回数分は必ずギャラリーに表示されます。
              Freeプランでもローテーション表示は行われますが、表示頻度は保証されません。
            </small>
            <small className="text-sm text-blue-600 mt-3 block">
              現在、全体使用率は {((totalUsage / 960) * 100).toFixed(1)}% です。
            </small>
          </label>

          {saleType === 'nft' && (
            <label className="flex flex-col font-semibold text-[1rem] text-[#333] mb-6">
              ウォレットアドレス（任意）
              <input
                type="text"
                placeholder="0x..."
                className="w-full px-4 py-3 mt-2 text-base bg-[#fafafa] border border-[#ccc] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00a1e9] focus:bg-white"
                {...register('wallet')}
              />
            </label>
          )}
        </>
      )}

      <hr className="my-8 border-t border-gray-300" />

      <div
        ref={scrollRef}
        className="max-h-[150px] overflow-y-auto border border-[#ccc] bg-[#fafafa] p-4 rounded-lg text-sm leading-relaxed text-gray-700"
      >
        <p className="font-bold">【利用規約の要点】</p>
        <ul className="list-disc list-inside mt-2 space-y-1">
          <li>投稿作品は審査の上、me-ishで展示・販売される場合があります</li>
          <li>著作権はアーティストに帰属しますが、展示・告知に使用する場合があります</li>
          <li>購入者には私的鑑賞の範囲での使用が許可されます（著作権の譲渡なし）</li>
          <li>第三者の権利を侵害する作品は禁止です</li>
          <li>生成AIによる自動生成作品は禁止です</li>
        </ul>
        <p className="mt-2">
          詳細は
          <a href="/terms" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline ml-1">
            公式サイトの利用規約
          </a>
          をご確認ください。
        </p>
      </div>

      <div className="flex items-center gap-2 mt-4 font-medium text-gray-800">
        <input type="checkbox" {...register('agreeTerms', { required: true })} disabled={!canCheck} />
        <span>上記の利用規約に同意します</span>
        <span className="text-[#e63946] text-sm ml-2">※必須</span>
      </div>

      <div className="flex items-center gap-2 mt-4 font-medium text-gray-800">
        <input type="checkbox" {...register('agreeTerms', { required: true })} />
        <span>自作作品であり、第三者の権利を侵害していません</span>
        <span className="text-[#e63946] text-sm ml-2">※必須</span>
      </div>

      <div className="flex items-center gap-2 mt-4 font-medium text-gray-800">
        <input type="checkbox" {...register('confirmOriginal', { required: true })} />
        <span>AIによる自動生成作品ではありません</span>
        <span className="text-[#e63946] text-sm ml-2">※必須</span>
      </div>
    </div>
  );
};

export default Step3_SalesAndAgreement;
