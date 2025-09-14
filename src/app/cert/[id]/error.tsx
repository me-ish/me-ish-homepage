'use client';

import { useEffect } from 'react';

export default function CertError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Vercel の Functions Logs にも流れる
    console.error('[CoA route error]', error);
  }, [error]);

  return (
    <main className="min-h-[60vh] flex items-center justify-center px-4">
      <div className="w-full max-w-[760px] bg-white p-6 rounded-xl space-y-3 text-center">
        <h1 className="text-xl font-bold">Server Error</h1>
        <p className="text-gray-700 text-sm break-all">
          {error.message || 'Unexpected error'}
        </p>
        {error.digest && (
          <p className="text-xs text-gray-500">digest: {error.digest}</p>
        )}
        <button
          onClick={() => reset()}
          className="inline-block px-4 py-2 rounded-xl bg-black text-white"
        >
          再読み込み
        </button>
      </div>
    </main>
  );
}
