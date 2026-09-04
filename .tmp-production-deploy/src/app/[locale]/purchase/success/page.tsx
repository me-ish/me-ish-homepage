// src/app/purchase/success/page.tsx
import { Suspense } from 'react';
import SuccessClient from './SuccessClient';

export default function Page() {
  return (
    <Suspense fallback={<div className="py-20 text-center">読み込み中…</div>}>
      <SuccessClient />
    </Suspense>
  );
}
