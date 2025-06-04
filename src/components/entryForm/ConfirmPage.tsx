'use client';

import React from 'react';
import { useFormContext } from 'react-hook-form';

interface ConfirmPageProps {
  onBack: () => void;
  onSubmit: (data: any) => void;
  validateFields: string[]; // ※未使用でもOK
}

const displayPlanLabels: Record<string, string> = {
  free: 'Free（¥0 / 表示保証なし）',
  mini: 'Mini（¥400 / 月1回保証）',
  light: 'Light（¥1,000 / 月3回保証）',
  standard: 'Standard（¥2,000 / 月7回保証）',
  premium: 'Premium（¥4,000 / 月15回保証）',
};

const ConfirmPage: React.FC<ConfirmPageProps> = ({ onBack, onSubmit }) => {
  const { getValues, handleSubmit } = useFormContext();
  const data = getValues();

  const imageFile =
    data.image instanceof FileList && data.image.length > 0
      ? data.image[0]
      : data.image instanceof File
      ? data.image
      : null;

  return (
    <div className="w-full max-w-[640px] bg-white p-10 rounded-2xl shadow-lg space-y-8">
      <h2 className="text-xl font-bold text-center border-l-4 border-[#00a1e9] pl-4 text-gray-800">
        STEP 4：入力内容の確認
      </h2>

      {/* アーティスト情報 */}
      <div className="p-4 bg-[#f9f9f9] border border-[#ddd] rounded-md space-y-2 text-[16px] text-gray-800">
        <h3 className="text-lg font-bold mb-2">アーティスト情報</h3>
        <p><strong>作家名：</strong> {data.artistName}</p>
        <p><strong>メールアドレス：</strong> {data.email}</p>
        {data.homepageUrl && <p><strong>ホームページ：</strong> {data.homepageUrl}</p>}
        {data.twitterUrl && <p><strong>X（旧Twitter）：</strong> {data.twitterUrl}</p>}
        {data.instagramUrl && <p><strong>Instagram：</strong> {data.instagramUrl}</p>}
      </div>

      {/* 作品情報 */}
      <div className="p-4 bg-[#f9f9f9] border border-[#ddd] rounded-md space-y-2 text-[16px] text-gray-800">
        <h3 className="text-lg font-bold mb-2">作品情報</h3>
        <p><strong>ギャラリー：</strong> {data.gallery_type}</p>
        <p><strong>作品タイトル：</strong> {data.title}</p>
        <p><strong>作品説明：</strong> {data.description || '（なし）'}</p>
        {imageFile && (
          <div className="mt-2">
            <strong>画像プレビュー：</strong>
            <img
              src={URL.createObjectURL(imageFile)}
              alt="preview"
              className="mt-2 max-w-full max-h-[400px] rounded"
            />
          </div>
        )}
      </div>

      {/* 販売情報 */}
      {data.isForSale === 'yes' && (
        <div className="p-4 bg-[#f9f9f9] border border-[#ddd] rounded-md space-y-2 text-[16px] text-gray-800">
          <h3 className="text-lg font-bold mb-2">販売情報</h3>
          <p><strong>販売形式：</strong> 
            {data.saleType === 'nft'
              ? 'NFT販売'
              : data.saleType === 'normal'
              ? '通常販売'
              : '(未選択)'}
          </p>
          <p><strong>販売価格：</strong> {data.price} 円</p>
          {data.saleType === 'nft' && (
            <p><strong>ウォレットアドレス：</strong> {data.wallet || '(未入力)'}</p>
          )}
          <p><strong>表示保証プラン：</strong> 
            {displayPlanLabels[data.displayPlan] || '(未選択)'}
          </p>
        </div>
      )}

      {/* ボタン */}
      <div className="mt-8 flex justify-center gap-6">
        <button
          type="button"
          onClick={onBack}
          className="px-5 py-2.5 bg-[#ccc] text-gray-800 rounded-md font-semibold hover:bg-[#bbb]"
        >
          戻る
        </button>
        <button
          type="button"
          onClick={handleSubmit(onSubmit)}
          className="px-5 py-2.5 bg-[#00a1e9] text-white rounded-md font-semibold hover:bg-[#008ec4]"
        >
          送信
        </button>
      </div>
    </div>
  );
};

export default ConfirmPage;
