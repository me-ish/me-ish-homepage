'use client';

import React, { useEffect, useState } from 'react';
import { useFormContext } from 'react-hook-form';
import { HelpCircle } from 'lucide-react';

type Step2Props = {
  preview: string | null;
  setPreview: (value: string | null) => void;
  localImageFile: File | null;
  setLocalImageFile: (file: File | null) => void;
};

const Step2_WorkInfo = ({
  preview,
  setPreview,
  localImageFile,
  setLocalImageFile,
}: Step2Props) => {
  const { register, watch, formState: { errors } } = useFormContext();
  const image = watch('image');
  const [showHelp, setShowHelp] = useState(false);

    // 🎯 追加部分：ページトップへスクロール
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  useEffect(() => {
    if (image && image instanceof FileList && image.length > 0) {
      const file = image[0];
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreview(reader.result as string);
        setLocalImageFile(file);
      };
      reader.readAsDataURL(file);
    } else if (image instanceof File) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreview(reader.result as string);
        setLocalImageFile(image);
      };
      reader.readAsDataURL(image);
    }
  }, [image, setPreview, setLocalImageFile]);

  return (
    <div className="w-full max-w-[640px] bg-white p-10 rounded-2xl shadow-lg space-y-6">
      {/* タイトル */}
      <h2 className="text-xl font-bold text-center border-l-4 border-[#00a1e9] pl-4 text-gray-800">
        応募作品の情報入力
      </h2>

      {/* 応募先ギャラリー */}
      <label className="flex flex-col mb-6 text-gray-800 font-semibold text-base">
        応募先ギャラリー（必須）
        <select
          className="w-full mt-2 p-3 text-base border border-gray-300 rounded-md bg-[#fafafa] focus:outline-none focus:ring-2 focus:ring-[#00a1e9] focus:bg-white"
          {...register('gallery_type', { required: true })}
          defaultValue=""
        >
          <option value="" disabled>選択してください</option>
          <option value="white">ホワイトギャラリー</option>
          <option value="float">フロートギャラリー</option>
        </select>
      </label>

      {/* 作品タイトル */}
      <label className="flex flex-col mb-6 text-gray-800 font-semibold text-base">
        作品タイトル（必須）
        <input
          type="text"
          placeholder="作品のタイトル"
          {...register('title', { required: true })}
          className="w-full mt-2 p-3 text-base border border-gray-300 rounded-md bg-[#fafafa] focus:outline-none focus:ring-2 focus:ring-[#00a1e9] focus:bg-white"
        />
      </label>

{/* 画像アップロード + ヘルプ */}
<div className="mb-6">
  <label className="flex items-center text-gray-800 font-semibold text-base mb-2">
    作品画像（必須・10MB以下）
    <button
      type="button"
      onClick={() => setShowHelp(!showHelp)}
      className="ml-2 text-[#00a1e9] hover:text-[#007bb8]"
    >
      <HelpCircle size={18} />
    </button>
  </label>

  <input
    type="file"
    accept="image/*"
    {...register('image', {
      required: true,
      validate: {
        lessThan10MB: (files: FileList) =>
          files && files[0]?.size <= 10 * 1024 * 1024 || '画像サイズは10MB以下にしてください',
      },
    })}
    className="text-sm text-gray-700"
  />

  {/* ✅ エラーメッセージ */}
{errors.image && typeof errors.image.message === 'string' && (
  <p className="text-sm text-red-600 mt-1">{errors.image.message}</p>
)}


        {showHelp && (
          <div className="mt-3 p-4 border border-gray-200 rounded-lg bg-[#f9f9f9] text-sm text-gray-700">
            <p className="font-semibold mb-2">📐 推奨画像サイズ</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>正方形：2000 × 2000px</li>
              <li>横長：2400 × 1600px（例：3:2）</li>
              <li>縦長：1600 × 2400px（例：2:3）</li>
              <li>最大：一辺3000px以内 / 10MB以下</li>
              <li>形式：JPEG / PNG（sRGB推奨）</li>
            </ul>
            <p className="mt-2 text-xs text-gray-500">
              ※ トリミング防止のため余白を含めた構図推奨
            </p>
          </div>
        )}
      </div>


      {/* プレビュー */}
      {preview && (
        <div className="text-center mt-4">
          <p className="text-sm text-gray-600 mb-2">プレビュー：</p>
          <img
            src={preview}
            alt="preview"
            className="max-w-full max-h-[400px] rounded"
          />
        </div>
      )}

      {/* 作品説明 */}
      <label className="flex flex-col mb-6 text-gray-800 font-semibold text-base">
        作品説明（任意）
        <textarea
          rows={5}
          placeholder="作品の説明やメッセージがあればご記入ください"
          {...register('description')}
          className="w-full mt-2 p-3 text-base border border-gray-300 rounded-md bg-[#fafafa] focus:outline-none focus:ring-2 focus:ring-[#00a1e9] focus:bg-white"
        />
      </label>
    </div>
  );
};

export default Step2_WorkInfo;
