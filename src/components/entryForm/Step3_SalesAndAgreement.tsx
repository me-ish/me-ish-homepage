'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useFormContext } from 'react-hook-form';
import { getDisplayPlanStats } from '@/lib/getDisplayPlanStats';
import type { FormValues } from '@/app/entry/FormWrapper';
import BankBranchFields from '@/components/entryForm/BankBranchFields'; // ★ 追加

const BRAND = '#00a1e9';
const FEE_RATE = 0.10;

/** ★ いまは Free のみ許可 */
const FREE_ONLY = true;

/** ★ NFT販売を一時停止（= ラジオを押せない＆選べない） */
const NFT_SALE_DISABLED = true;

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

const Step3_SalesAndAgreement = () => {
  const {
    register,
    watch,
    setValue,
    formState: { errors },
  } = useFormContext<FormValues>();

  const isForSale = watch('isForSale');
  const saleType = watch('saleType');
  const priceRaw = watch('price') ?? '';
  const editionMode = watch('editionMode');
  const editionTotal = watch('editionTotal') ?? '';

  const [canCheck, setCanCheck] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [stats, setStats] = useState<Record<PlanKey, number>>();
  const [totalUsage, setTotalUsage] = useState(0);

  useEffect(() => { window.scrollTo({ top: 0, behavior: 'smooth' }); }, []);

  // ★ Free固定をフォーム値に反映（初回のみ）
  useEffect(() => {
    if (FREE_ONLY) {
      setValue('displayPlan', 'free', { shouldDirty: false, shouldValidate: true });
    }
  }, [setValue]);

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

  /** ★ 以前「NFT販売」を選んでいた場合のガード：自動解除 */
  useEffect(() => {
    if (NFT_SALE_DISABLED && saleType === 'nft') {
      setValue('saleType', undefined as unknown as FormValues['saleType'], {
        shouldDirty: true,
        shouldValidate: true,
      });
    }
  }, [saleType, setValue]);

  /** ★ 販売形式ラジオの登録（バリデでも nft を弾く） */
  const saleTypeRegister = register('saleType', {
    required: '販売形式を選択してください。',
    validate: (v: string) => {
      if (NFT_SALE_DISABLED && v === 'nft') {
        return '現在は通常販売のみ選択できます。';
      }
      return true;
    },
  });

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
          {/* 販売形式（NFTは押せない） */}
          <div>
            <label className="block text-sm font-semibold text-gray-800 mb-1.5">
              販売形式 <span className="text-red-600">＊</span>
            </label>

            {NFT_SALE_DISABLED && (
              <p className="text-xs text-gray-500 mb-2">
                ※ 現在はテスト期間のため <strong>通常販売のみ</strong> を受け付けています（NFT販売は準備中）。
              </p>
            )}

            <div className="mt-2 flex flex-col sm:flex-row gap-4">
              {/* 通常販売 */}
              <label className="flex items-center gap-2">
                <input type="radio" value="normal" {...saleTypeRegister} />
                通常販売
              </label>

              {/* NFT販売（押せない・選べない） */}
              <label
                className={[
                  'flex items-center gap-2 rounded px-2 py-1',
                  NFT_SALE_DISABLED ? 'opacity-50 cursor-not-allowed ring-1 ring-gray-200' : '',
                ].join(' ')}
                aria-disabled={NFT_SALE_DISABLED}
                title={NFT_SALE_DISABLED ? 'NFT販売は現在準備中のため選択できません' : undefined}
              >
                <input
                  type="radio"
                  value="nft"
                  disabled={NFT_SALE_DISABLED}
                  {...saleTypeRegister}
                />
                NFT販売（準備中）
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
                /> エディション指定
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  value="unlimited"
                  {...register('editionMode', { required: '販売点数を選択してください。' })}
                /> 無制限
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
                    required: '販売点数を入力してください。',
                    min: { value: 1, message: '1以上を入力してください。' },
                    max: { value: 10, message: '最大10点まで指定できます。' },
                  })}
                />
                <small className="text-[#666] mt-1 block">※1〜10の範囲で指定</small>
              </div>
            )}

            {(() => {
              const m = errMsg(errors.editionTotal || errors.editionMode);
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
              {renderPlanLabel('free',     'Free（¥0 / 表示保証なし・ローテーション枠）')}
              {renderPlanLabel('mini',     'Mini（¥400 / 月1回保証）')}
              {renderPlanLabel('light',    'Light（¥1,000 / 月3回保証）')}
              {renderPlanLabel('standard', 'Standard（¥1,400 / 月7回保証）')}
              {renderPlanLabel('premium',  'Premium（¥2,700 / 月15回保証）')}
            </div>
            <small className="text-sm text-blue-600 mt-3 block">
              現在、全体使用率は {((totalUsage / 960) * 100).toFixed(1)}% です。
            </small>
            {(() => {
              const m = errMsg(errors.displayPlan);
              return m ? <p className="text-sm text-red-600 mt-1.5">{m}</p> : null;
            })()}
          </div>

          {/* ★ 追加：口座入力（zengin-code の banks.json / branches.json を使うコンポーネント） */}
          <BankBranchFields />
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

