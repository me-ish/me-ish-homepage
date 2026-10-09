'use client';

import React from 'react';
import { LEGACY_SERVICES_PAUSED } from '@/lib/legacyServiceSuspension';

interface NormalPurchaseButtonProps {
  entryId: string;
  title: string;
  price: number;
}

const NormalPurchaseButton: React.FC<NormalPurchaseButtonProps> = ({ entryId, title, price }) => {
  const handleClick = async () => {
    if (LEGACY_SERVICES_PAUSED) return;
    try {
      const res = await fetch('/api/purchase/stripe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-requested-with': 'me-ish' },
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
      disabled={LEGACY_SERVICES_PAUSED}
      className="bg-[#00a1e9] hover:bg-[#008ec4] text-white font-bold py-2 px-6 rounded-lg transition disabled:opacity-60"
    >
      {LEGACY_SERVICES_PAUSED ? '購入受付休止中' : `購入する（¥${price.toLocaleString()}）`}
    </button>
  );
};

export default NormalPurchaseButton;
