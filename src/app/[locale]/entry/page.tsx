'use client';

import { Palette } from 'lucide-react';
import { useTranslations } from 'next-intl';
import FormWrapper from './FormWrapper';

export default function EntryPage() {
  const t = useTranslations('pages.entry');
  return (
    <div className="min-h-screen bg-gradient-to-b from-[#f8fbff] via-white to-white">
      {/* Hero Header */}
      <div className="relative overflow-hidden bg-gradient-to-r from-[#00a1e9] to-[#0080c0] py-12 px-4">
        {/* Background pattern */}
        <div
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)',
            backgroundSize: '24px 24px',
          }}
        />

        <div className="relative z-10 max-w-[700px] mx-auto text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-white/20 backdrop-blur-sm mb-4">
            <Palette className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-white">
            {t('formTitle')}
          </h1>
          <p className="mt-2 text-white/80 text-sm md:text-base">
            {t('formSubtitle')}
          </p>
        </div>
      </div>

      {/* Form Content */}
      <FormWrapper />
    </div>
  );
}
