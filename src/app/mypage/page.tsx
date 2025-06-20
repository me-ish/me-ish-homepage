'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation'; // ✅ 追加
import { supabase } from '@/lib/supabaseClient';

type Profile = {
  display_name: string;
  sns_links: {
    homepage?: string;
    twitter?: string;
    instagram?: string;
  };
  wallet_address?: string;
};

export default function MyPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [showToast, setShowToast] = useState(false); // ✅ 追加
  const router = useRouter();
  const searchParams = useSearchParams(); // ✅ 追加

  useEffect(() => {
    // ✅ 紐づけ成功通知チェック
    if (searchParams.get('linked') === 'success') {
      setShowToast(true);
      const timer = setTimeout(() => setShowToast(false), 5000);
      return () => clearTimeout(timer);
    }
  }, [searchParams]);

  useEffect(() => {
    const loadProfile = async () => {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (!user || userError) {
        console.warn('未ログイン or セッション取得失敗:', userError?.message);
        router.push('/login');
        return;
      }

      setEmail(user.email ?? null);

      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();

      if (!profileData) {
        console.log('プロフィールが存在しないため新規作成を実行');

        const { error: insertError } = await supabase.from('profiles').insert({
          id: user.id,
          display_name: '',
          sns_links: {},
          wallet_address: '',
        });

        if (insertError) {
          console.error('プロフィール初期作成に失敗:', insertError.message);
          return;
        }

        const { data: newProfile, error: fetchError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();

        if (fetchError) {
          console.error('新規プロフィールの再取得に失敗:', fetchError.message);
          return;
        }

        setProfile(newProfile);
      } else {
        setProfile(profileData);
      }
    };

    loadProfile();
  }, [router]);

  return (
    <main className="p-6 max-w-xl mx-auto">
      {/* ✅ トースト通知 */}
      {showToast && (
        <div className="fixed top-4 right-4 bg-green-500 text-white px-4 py-2 rounded-lg shadow-md z-50">
          ✅ 紐づけが完了しました！
        </div>
      )}

      <h1 className="text-2xl font-bold mb-4">マイページ</h1>

      {profile ? (
        <div className="space-y-2 text-left">
          <p>メールアドレス：{email}</p>
          <p>表示名：{profile.display_name || '未設定'}</p>

          <div>
            <p className="font-bold mt-4">SNSリンク：</p>
            <ul className="ml-4 list-disc">
              {profile.sns_links?.homepage && <li>HP: {profile.sns_links.homepage}</li>}
              {profile.sns_links?.twitter && <li>Twitter: {profile.sns_links.twitter}</li>}
              {profile.sns_links?.instagram && <li>Instagram: {profile.sns_links.instagram}</li>}
            </ul>
          </div>

          {profile.wallet_address && <p>ウォレットアドレス：{profile.wallet_address}</p>}
        </div>
      ) : (
        <p>プロフィール情報を取得中です...</p>
      )}
    </main>
  );
}

