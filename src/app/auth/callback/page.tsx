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
    const checkSessionAndRedirect = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        router.push(redirect);
      } else {
        router.push('/login'); // セッションが無ければログイン画面へ戻す
      }
    };

    checkSessionAndRedirect();
  }, [router, supabase, redirect]);

  return <p className="text-center mt-20">ログイン処理中です...</p>;
}
