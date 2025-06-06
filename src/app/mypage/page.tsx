'use client';
import { useEffect, useState } from 'react';
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

  useEffect(() => {
    const loadProfile = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      setEmail(user.email ?? null);

      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (profileData) setProfile(profileData);
    };

    loadProfile();
  }, []);

  return (
    <main className="p-6 max-w-xl mx-auto">
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
