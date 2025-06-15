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
    const confirmSession = async () => {
      // セッション確認（ログイン完了時に発火）
      const { data: { session } } = await supabase.auth.getSession();

      if (session) {
        // セッションが確認できたらユーザー情報取得
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          router.push(redirect);
        }
      } else {
        router.push('/login'); // セッションがなければ戻す
      }
    };

    confirmSession();
  }, [router, supabase, redirect]);

  return <p className="text-center mt-20">ログイン処理中です...</p>;
}

