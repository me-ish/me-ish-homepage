// ✅ Server Component
import { Suspense } from 'react';
import CallbackClient from './CallbackClient';

export default function CallbackPage() {
  return (
    <Suspense fallback={<p className="text-center mt-20">ログイン処理中です...</p>}>
      <CallbackClient />
    </Suspense>
  );
}