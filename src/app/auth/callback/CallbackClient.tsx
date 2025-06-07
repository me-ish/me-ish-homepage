'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

export default function CallbackClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get('redirect') || '/mypage';
  const supabase = createClientComponentClient();

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        router.push(redirect);
      }
    });
  }, [router, supabase, redirect]);

  return <p className="text-center mt-20">ログイン処理中です...</p>;
}
