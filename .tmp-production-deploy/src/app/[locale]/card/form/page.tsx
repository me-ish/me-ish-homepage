// src/app/[locale]/card/form/page.tsx
"use client";

import CardFormWizard from "@/components/card/form/CardFormWizard";

export default function CardFormPage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-50 via-slate-50 to-slate-100 py-8 px-4">
      <div className="text-center mb-8">
        <p className="text-xs text-slate-500 tracking-wider uppercase mb-1">
          me-ish CARD
        </p>
        <h1 className="text-2xl font-bold text-slate-800">
          デジタル名刺を作成
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          3ステップで完成するアーティスト向けAIデザイン名刺
        </p>
      </div>
      <CardFormWizard />
    </main>
  );
}
