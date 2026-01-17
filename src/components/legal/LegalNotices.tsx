// src/components/legal/LegalNotices.tsx
import React from 'react';

export function LegalNotices() {
  return (
    <div className="mt-3 text-xs text-gray-500 leading-relaxed space-y-1">
      <p>※ 価格は<strong>税込・円表示（総額表示）</strong>です。</p>
      <p>※ 支払方法：クレジットカード（Stripe／日本円）。購入確定時に<strong>即時決済</strong>されます。</p>
      <p>※ 引渡時期：決済確認後、<strong>即時〜24時間以内</strong>に納品（障害時は最長<strong>3営業日</strong>）。</p>
      <p>※ デジタル商品のため<strong>購入後の返金・キャンセルは原則不可</strong>（重複課金・重大欠陥等は<strong>購入後7日以内</strong>に対応）。</p>
      <p>※ 表示保証オプションは<strong>1作品ごと</strong>に提供し、有効期間内に所定回数を保証。消化済み回数は返金不可。</p>
      <p className="pt-1">
        <a href="/footer/tokushoho" className="underline underline-offset-2">特定商取引法に基づく表記</a>
        <span className="mx-1">／</span>
        <a href="/footer/terms#sec-6" className="underline underline-offset-2">利用規約（展示・販売）</a>
      </p>
    </div>
  );
}
