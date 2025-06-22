'use client';

import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';
import { FcGoogle } from 'react-icons/fc';

export default function LoginPage() {
  const router = useRouter();

  const handleGoogleLogin = async () => {
    const origin = window.location.origin;
    const redirect = '/mypage';
    const redirectTo = `${origin}/auth/callback?redirect=${encodeURIComponent(redirect)}`;
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo },
    });
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-white to-[#eaf6ff] px-6 py-12 flex flex-col items-center">
      {/* ログインボタン */}
      <button
        onClick={handleGoogleLogin}
        className="flex items-center gap-3 border border-gray-300 bg-white px-5 py-2 rounded-md text-gray-800 shadow hover:bg-gray-100 transition mb-10"
      >
        <FcGoogle className="text-xl" />
        <span className="font-medium">Googleでログイン</span>
      </button>

      {/* 機能一覧 */}
      <div className="w-full max-w-xl space-y-4">
        <div className="bg-white border rounded-lg shadow-sm p-5">
          <h2 className="font-semibold text-lg mb-2">できること</h2>
          <ul className="list-disc list-inside text-sm text-gray-700 space-y-1">
            <li>🖼️ 作品をオンラインギャラリーに展示</li>
            <li>💰 通常販売・NFT販売のどちらも対応</li>
            <li>📊 エディション数の管理と売上表示</li>
            <li>🧑‍💼 プロフィールで自分をブランディング</li>
            <li>📬 展示や売上に応じた通知メール</li>
          </ul>
        </div>

        <div className="bg-white border rounded-lg shadow-sm p-5">
          <h2 className="font-semibold text-lg mb-2">これから追加予定の機能</h2>
          <ul className="list-disc list-inside text-sm text-gray-700 space-y-1">
            <li>💬 作品ごとのコメント投稿・閲覧機能</li>
            <li>📌 マイリスト／お気に入り保存</li>
            <li>🔍 展示履歴や人気作品のフィルター</li>
            <li>🧠 AIによるキュレーション推薦</li>
          </ul>
        </div>
      </div>
    </main>
  );
}
