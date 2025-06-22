'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import ProfileEditModal from './ProfileEditModal';
import { Globe, Twitter, Instagram } from 'lucide-react'; // ✅ 追加（SNSアイコン用）

// Types
interface Profile {
  display_name: string;
  sns_links: {
    homepage?: string;
    twitter?: string;
    instagram?: string;
  };
  wallet_address?: string;
}

interface Entry {
  id: number;
  title: string;
  image_url: string;
  confirmed: boolean;
  created_at: string;
  likes?: number;            // ← 追加
  gallery_type?: string;     // ← 追加
  edition_total?: number;    // ← 追加
  edition_sold?: number;     // ← 追加
}

export default function MyPageClient() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [showToast, setShowToast] = useState(false);
  const [editing, setEditing] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (searchParams.get('linked') === 'success') {
      setShowToast(true);
      const timer = setTimeout(() => setShowToast(false), 5000);
      return () => clearTimeout(timer);
    }
  }, [searchParams]);

  useEffect(() => {
    const loadUserData = async () => {
      const { data: { user }, error } = await supabase.auth.getUser();
      if (!user || error) {
        router.push('/login');
        return;
      }
      setEmail(user.email ?? null);

      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();

      if (!profileData) {
        const { error: insertError } = await supabase.from('profiles').insert({
          id: user.id,
          display_name: '',
          sns_links: {},
          wallet_address: '',
        });
        if (insertError) return;
      }

      const { data: refreshedProfile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      setProfile(refreshedProfile);

      const { data: entriesData } = await supabase
        .from('entries')
        .select('id, title, image_url, confirmed, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      setEntries(entriesData || []);
    };

    loadUserData();
  }, [router]);

  return (
    <>
      {/* ✅ モーダル */}
      {editing && profile && (
        <ProfileEditModal
          initialProfile={profile}
          onCancel={() => setEditing(false)}
          onSave={async (updated) => {
            const userId = (await supabase.auth.getUser()).data.user?.id;
            const { error } = await supabase
              .from('profiles')
              .update(updated)
              .eq('id', userId);

            if (!error) {
              setProfile({ ...profile, ...updated });
              setEditing(false);
            } else {
              alert('保存に失敗しました');
            }
          }}
        />
      )}

      <main className="p-6 max-w-4xl mx-auto space-y-8">
        {showToast && (
          <div className="fixed top-4 right-4 bg-green-500 text-white px-4 py-2 rounded-lg shadow-md z-50">
            ✅ 紐づけが完了しました！
          </div>
        )}

        <section className="space-y-2">
          <h1 className="text-3xl font-bold">マイページ</h1>
          <p className="text-gray-700">
            ようこそ、{profile?.display_name || email || 'ユーザー'} さん
          </p>

          <div className="bg-gray-50 p-4 rounded-lg shadow">
            <h2 className="text-xl font-semibold mb-2">プロフィール情報</h2>
            <button
              className="mt-4 px-4 py-2 bg-[#00a1e9] text-white rounded hover:bg-[#008fcc]"
              onClick={() => setEditing(true)}
            >
              プロフィールを編集
            </button>

            <p><strong>メールアドレス：</strong>{email}</p>
            <p><strong>表示名：</strong>{profile?.display_name || '未設定'}</p>
            <div>
              <p className="font-semibold mt-2 mb-1">SNSリンク：</p>
              <div className="flex items-center space-x-4">
                {profile?.sns_links?.homepage && (
                  <a
                    href={profile.sns_links.homepage}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-gray-600 hover:text-blue-600"
                    title="ホームページ"
                  >
                    <Globe className="w-5 h-5" />
                  </a>
                )}
                {profile?.sns_links?.twitter && (
                  <a
                    href={profile.sns_links.twitter}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#1DA1F2] hover:opacity-80"
                    title="Twitter"
                  >
                    <Twitter className="w-5 h-5" />
                  </a>
                )}
                {profile?.sns_links?.instagram && (
                  <a
                    href={profile.sns_links.instagram}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#E1306C] hover:opacity-80"
                    title="Instagram"
                  >
                    <Instagram className="w-5 h-5" />
                  </a>
                )}
              </div>
            </div>
            {profile?.wallet_address && (
              <p className="mt-2"><strong>ウォレットアドレス：</strong>{profile.wallet_address}</p>
            )}
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4">あなたの応募作品</h2>
          {entries.length === 0 ? (
            <p className="text-gray-500">まだ作品がありません。</p>
          ) : (
<div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
  {entries.map(entry => (
    <div key={entry.id} className="border rounded-lg overflow-hidden shadow-sm bg-white">
      <img src={entry.image_url} alt={entry.title} className="w-full h-48 object-cover" />
      <div className="p-4">
        <h3 className="font-semibold text-lg truncate mb-1">{entry.title}</h3>
        <p className="text-sm text-gray-600">
          {entry.confirmed ? '✅ 承認済' : '⏳ 承認待ち'}
          <span className="ml-2">({new Date(entry.created_at).toLocaleDateString()})</span>
        </p>

        {/* ✅ 追加情報 */}
        <div className="text-sm text-gray-700 mt-2 space-y-1">
          <p>❤️ {entry.likes ?? 0} いいね</p>
          <p>展示：{entry.gallery_type ? (entry.gallery_type === 'white' ? 'White Gallery' : entry.gallery_type === 'float' ? 'Float Gallery' : entry.gallery_type) : '未定'}</p>
          <p>エディション：{entry.edition_total ?? 0}点中{" "}{(entry.edition_total ?? 0) - (entry.edition_sold ?? 0)}点残</p>

        </div>
      </div>
    </div>
  ))}
</div>

          )}
        </section>
      </main>
    </>
  );
}

