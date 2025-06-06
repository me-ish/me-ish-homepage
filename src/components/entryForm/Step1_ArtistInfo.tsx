'use client';

import React from 'react';
import { useFormContext } from 'react-hook-form';

const Step1_ArtistInfo = () => {
  const { register } = useFormContext();

  return (
    <div className="w-full max-w-[700px] mx-auto p-6 bg-white rounded-md">
      <h2 className="text-xl font-bold text-center border-l-4 border-[#00a1e9] pl-4 text-gray-800">
        作家情報の入力
      </h2>

      {/* 作家名 */}
      <label className="block font-bold mb-1">
        作家名（公開名）
        <span className="text-red-600 text-sm ml-2">※必須</span>
      </label>
      <input
        type="text"
        className="w-full mb-6 px-4 py-2 border border-gray-300 rounded-md"
        placeholder="例）山田 太郎 / Taro Yamada"
        {...register('artistName', { required: true })}
      />

      {/* メールアドレス */}
      <label className="block font-bold mb-1">
        メールアドレス
        <span className="text-red-600 text-sm ml-2">※必須</span>
      </label>
      <input
        type="email"
        className="w-full mb-6 px-4 py-2 border border-gray-300 rounded-md"
        placeholder="例）example@domain.com"
        {...register('email', { required: true })}
      />

      {/* ホームページ */}
      <label className="block font-bold mb-1">
        ホームページURL（任意）
      </label>
      <input
        type="url"
        className="w-full mb-6 px-4 py-2 border border-gray-300 rounded-md"
        placeholder="例）https://your-portfolio.com"
        {...register('homepageUrl')}
      />

      {/* X（旧Twitter） */}
      <label className="block font-bold mb-1">
        X（旧Twitter）URL（任意）
      </label>
      <input
        type="url"
        className="w-full mb-6 px-4 py-2 border border-gray-300 rounded-md"
        placeholder="例）https://x.com/yourusername"
        {...register('twitterUrl')}
      />

      {/* Instagram */}
      <label className="block font-bold mb-1">
        Instagram URL（任意）
      </label>
      <input
        type="url"
        className="w-full mb-6 px-4 py-2 border border-gray-300 rounded-md"
        placeholder="例）https://instagram.com/yourusername"
        {...register('instagramUrl')}
      />
    </div>
  );
};

export default Step1_ArtistInfo;
