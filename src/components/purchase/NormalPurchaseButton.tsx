'use client';

import React from 'react';

interface NormalPurchaseButtonProps {
  entryId: string;
  title: string;
  price: number;
}

const NormalPurchaseButton: React.FC<NormalPurchaseButtonProps> = ({ entryId, title, price }) => {
  const handleClick = async () => {
    try {
      const res = await fetch('/api/purchase/stripe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entryId,
          title,
          price,
        }),
      });

      const data = await res.json();

      if (data.url) {
        window.location.href = data.url;
      } else {
        alert('支払い画面の生成に失敗しました');
        console.error(data.error);
      }
    } catch (error) {
      console.error('Stripe遷移エラー:', error);
      alert('エラーが発生しました。');
    }
  };

  return (
    <button
      onClick={handleClick}
      className="bg-[#00a1e9] hover:bg-[#008ec4] text-white font-bold py-2 px-6 rounded-lg transition"
    >
      購入する（¥{price.toLocaleString()}）
    </button>
  );
};

export default NormalPurchaseButton;