'use client';

import React, { useEffect } from 'react';
import { useFormContext } from 'react-hook-form';

const BRAND = '#00a1e9';

// 軽量なURL正規化（スキーム省略時は https:// を付与）
function normalizeUrl(v: string) {
  if (!v) return '';
  const trimmed = v.trim();
  if (!/^https?:\/\//i.test(trimmed) && /^[\w.-]+\.[a-z]{2,}/i.test(trimmed)) {
    return `https://${trimmed}`;
  }
  return trimmed;
}

// ゆるめのURLパターン（「https://example.com」や「example.com/abc」想定）
const urlPattern =
  /^(https?:\/\/)?([\w-]+\.)+[\w-]{2,}(\/[^\s]*)?$/i;

const Step1_ArtistInfo: React.FC = () => {
  const { register, setValue, formState: { errors } } = useFormContext();

  // ページトップへスクロール（SSR/CSR不一致を避けるため副作用でのみ実行）
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  return (
    <section
      className="w-full max-w-[720px] mx-auto p-6 sm:p-8 bg-white rounded-2xl shadow-sm ring-1 ring-gray-100"
      aria-labelledby="artist-info-title"
    >
      <header className="mb-6">
        <h2
          id="artist-info-title"
          className="text-[22px] font-bold text-gray-900 flex items-center gap-3"
        >
          <span
            className="inline-block h-5 w-1.5 rounded-full"
            style={{ backgroundColor: BRAND }}
            aria-hidden
          />
          作家情報の入力
        </h2>
        <p className="mt-2 text-sm text-gray-600">
          ギャラリー上に表示される基本情報です。後からマイページで更新できます。
          必須項目は<span className="font-semibold text-red-600">＊</span>が付いています。
        </p>
      </header>

      {/* 作家名 */}
      <div className="mb-5">
        <label
          htmlFor="artistName"
          className="block text-sm font-semibold text-gray-800 mb-1.5"
        >
          作家名（公開名）<span className="text-red-600">＊</span>
        </label>
        <input
          id="artistName"
          type="text"
          autoComplete="nickname"
          placeholder="例）山田 太郎 / Taro Yamada"
          aria-invalid={!!errors.artistName}
          aria-describedby="artistName_help"
          className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-[#00a1e9] placeholder:text-gray-400"
          {...register('artistName', {
            required: '作家名は必須です。',
            maxLength: { value: 64, message: '64文字以内で入力してください。' },
            validate: (v) =>
              v.trim().length > 0 || '空白のみは使用できません。'
          })}
        />
        <div id="artistName_help" className="mt-1 text-xs text-gray-500">
          本名・ペンネームどちらでも可。公開時はこの名前が表示されます。
        </div>
        {errors.artistName && (
          <p role="alert" className="mt-1.5 text-sm text-red-600">
            {/* @ts-ignore */}
            {errors.artistName.message}
          </p>
        )}
      </div>

      {/* メールアドレス */}
      <div className="mb-5">
        <label
          htmlFor="email"
          className="block text-sm font-semibold text-gray-800 mb-1.5"
        >
          メールアドレス<span className="text-red-600">＊</span>
        </label>
        <input
          id="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="例）example@domain.com"
          aria-invalid={!!errors.email}
          aria-describedby="email_help"
          className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-[#00a1e9] placeholder:text-gray-400"
          {...register('email', {
            required: 'メールアドレスは必須です。',
            pattern: {
              value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
              message: 'メールアドレスの形式が正しくありません。'
            }
          })}
        />
        <div id="email_help" className="mt-1 text-xs text-gray-500">
          審査結果やご連絡に使用します。公開はされません。
        </div>
        {errors.email && (
          <p role="alert" className="mt-1.5 text-sm text-red-600">
            {/* @ts-ignore */}
            {errors.email.message}
          </p>
        )}
      </div>

      {/* ホームページ */}
      <div className="mb-5">
        <label
          htmlFor="homepageUrl"
          className="block text-sm font-semibold text-gray-800 mb-1.5"
        >
          ホームページURL（任意）
        </label>
        <input
          id="homepageUrl"
          type="url"
          inputMode="url"
          autoComplete="url"
          placeholder="例）https://your-portfolio.com"
          aria-invalid={!!errors.homepageUrl}
          aria-describedby="homepageUrl_help"
          className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-[#00a1e9] placeholder:text-gray-400"
          {...register('homepageUrl', {
            setValueAs: (v) => normalizeUrl(v),
            validate: (v) =>
              !v || urlPattern.test(v) || 'URLの形式が正しくありません。'
          })}
          onBlur={(e) =>
            setValue('homepageUrl', normalizeUrl(e.currentTarget.value), {
              shouldDirty: true,
              shouldValidate: true,
            })
          }
        />
        <div id="homepageUrl_help" className="mt-1 text-xs text-gray-500">
          スキーム（https://）が無い場合は自動補完されます。
        </div>
        {errors.homepageUrl && (
          <p role="alert" className="mt-1.5 text-sm text-red-600">
            {/* @ts-ignore */}
            {errors.homepageUrl.message}
          </p>
        )}
      </div>

      {/* X（旧Twitter） */}
      <div className="mb-5">
        <label
          htmlFor="twitterUrl"
          className="block text-sm font-semibold text-gray-800 mb-1.5"
        >
          X（旧Twitter）URL（任意）
        </label>
        <input
          id="twitterUrl"
          type="url"
          inputMode="url"
          placeholder="例）https://x.com/yourusername"
          aria-invalid={!!errors.twitterUrl}
          aria-describedby="twitterUrl_help"
          className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-[#00a1e9] placeholder:text-gray-400"
          {...register('twitterUrl', {
            setValueAs: (v) => normalizeUrl(v),
            validate: (v) =>
              !v || urlPattern.test(v) || 'URLの形式が正しくありません。',
          })}
          onBlur={(e) =>
            setValue('twitterUrl', normalizeUrl(e.currentTarget.value), {
              shouldDirty: true,
              shouldValidate: true,
            })
          }
        />
        <div id="twitterUrl_help" className="mt-1 text-xs text-gray-500">
          ユーザー名だけ入力してもOK（<code>yourusername</code> → <code>https://x.com/yourusername</code> に自動補完）。
        </div>
        {errors.twitterUrl && (
          <p role="alert" className="mt-1.5 text-sm text-red-600">
            {/* @ts-ignore */}
            {errors.twitterUrl.message}
          </p>
        )}
      </div>

      {/* Instagram */}
      <div className="mb-1">
        <label
          htmlFor="instagramUrl"
          className="block text-sm font-semibold text-gray-800 mb-1.5"
        >
          Instagram URL（任意）
        </label>
        <input
          id="instagramUrl"
          type="url"
          inputMode="url"
          placeholder="例）https://instagram.com/yourusername"
          aria-invalid={!!errors.instagramUrl}
          aria-describedby="instagramUrl_help"
          className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-[#00a1e9] placeholder:text-gray-400"
          {...register('instagramUrl', {
            setValueAs: (v) => normalizeUrl(v),
            validate: (v) =>
              !v || urlPattern.test(v) || 'URLの形式が正しくありません。',
          })}
          onBlur={(e) =>
            setValue('instagramUrl', normalizeUrl(e.currentTarget.value), {
              shouldDirty: true,
              shouldValidate: true,
            })
          }
        />
        <div id="instagramUrl_help" className="mt-1 text-xs text-gray-500">
          ユーザー名だけでも自動でURL化されます。
        </div>
        {errors.instagramUrl && (
          <p role="alert" className="mt-1.5 text-sm text-red-600">
            {/* @ts-ignore */}
            {errors.instagramUrl.message}
          </p>
        )}
      </div>

      {/* 補足 */}
      <p className="mt-5 text-[11px] leading-relaxed text-gray-500">
        送信により、当ギャラリーの利用規約・プライバシーポリシーに同意したものとみなされます。
      </p>
    </section>
  );
};

export default Step1_ArtistInfo;

