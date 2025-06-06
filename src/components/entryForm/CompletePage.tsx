'use client';

import React from 'react';

const CompletePage = () => {
  return (
    <div className="w-full max-w-[640px] bg-white p-10 rounded-2xl shadow-lg space-y-8 text-center">
      <h2 className="text-2xl font-bold text-gray-800">送信完了！</h2>
      <p className="text-gray-700">ご応募ありがとうございました。</p>
      <p className="text-gray-700">ご記入いただいた内容を確認し、後日ご連絡いたします。</p>

      <a
        href="/"
        className="inline-block mt-6 px-6 py-2 bg-[#00a1e9] text-white rounded-md font-semibold hover:bg-[#008ec4]"
      >
        me-ish ホームに戻る
      </a>
    </div>
  );
};

export default CompletePage;
