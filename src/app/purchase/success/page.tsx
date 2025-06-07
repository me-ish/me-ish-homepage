// src/app/purchase/success/page.tsx
import { Suspense } from 'react';
import SuccessClient from './SuccessClient';

export default function SuccessPage() {
  return (
    <Suspense fallback={<div className="text-center py-20">処理中です...</div>}>
      <SuccessClient />
    </Suspense>
  );
}
