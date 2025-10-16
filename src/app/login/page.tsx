'use client';

import { Suspense, useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { FcGoogle } from 'react-icons/fc';
import {
  ShieldCheck, Bell, CreditCard, Image as Img, User, LogIn
} from 'lucide-react';

/** 外側は Suspense でラップ（← これが重要） */
export default function LoginPage() {
  return (
    <Suspense fallback={<LoginSkeleton />}>
      <LoginInner />
    </Suspense>
  );
}

/** 中身はそのまま（元の LoginPage を LoginInner にリネーム） */
function LoginInner() {
  const router = useRouter();
  const search = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // すでにログイン済みなら /mypage へ
  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (data.user) router.replace('/mypage');
    })();
  }, [router]);

  const handleGoogleLogin = async () => {
    try {
      setErr(null);
      setLoading(true);
      const origin = window.location.origin;

      // リダイレクト先（クエリ優先・未指定なら /mypage）
      const redirect = decodeURIComponent(search.get('redirect') || '/mypage');
      const redirectTo = `${origin}/auth/callback?redirect=${encodeURIComponent(redirect)}`;

      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo },
      });
      if (error) throw error;
    } catch (e: any) {
      setErr(e?.message ?? 'ログインに失敗しました。時間をおいて再度お試しください。');
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-white to-[#eaf6ff] px-6 py-12 flex flex-col items-center text-[#222]">
      {/* ブランド */}
      <Link href="/" className="mb-8 text-[#00a1e9] font-lilita text-[2rem] font-bold">
        me-ish
        <span className="ml-2 align-middle text-xs bg-[#e60039] text-white px-2 py-0.5 rounded">β</span>
      </Link>

      {/* カード */}
      <div className="w-full max-w-[520px] rounded-2xl border bg-white shadow-lg p-6">
        <h1 className="text-[1.4rem] font-semibold mb-2 flex items-center gap-2">
          <LogIn className="w-5 h-5 text-[#00a1e9]" />
          マイページにログイン
        </h1>
        <p className="text-sm text-[#555] mb-5">
          購入履歴のダウンロード、出展作品の管理、通知設定などをご利用いただけます。
          鑑賞だけならログイン不要です。
        </p>

        {/* Google ログイン */}
        <button
          onClick={handleGoogleLogin}
          disabled={loading}
          aria-busy={loading}
          className={`w-full flex items-center justify-center gap-3 border border-[#d9e6f2] bg-white px-5 py-3 rounded-xl text-[#222] shadow-sm hover:bg-[#f7fbff] transition ${
            loading ? 'opacity-70 cursor-not-allowed' : ''
          }`}
        >
          <FcGoogle className="text-2xl" />
          <span className="font-semibold">{loading ? '処理中…' : 'Googleでログイン'}</span>
        </button>

        {/* エラー表示 */}
        {err && (
          <div className="mt-3 rounded-lg bg-[#fff4f4] border border-[#ffd7d7] px-3 py-2 text-sm text-[#9b1c1c]" role="alert">
            {err}
          </div>
        )}

        {/* 同意・安心情報 */}
        <div className="mt-4 text-xs text-[#667] leading-relaxed">
          ログインすると、<strong>メールアドレス・表示名・アイコン</strong>を取得します（投稿や連絡先へのアクセスは行いません）。
          続行により <Link href="/footer/terms" className="underline">利用規約</Link> と
          <Link href="/footer/privacy" className="underline ml-1">プライバシーポリシー</Link> に同意したものとみなされます。
        </div>
      </div>

      {/* 機能のハイライト（2列 → モバイル1列） */}
      <div className="w-full max-w-[920px] grid grid-cols-1 md:grid-cols-2 gap-4 mt-8">
        <FeatureCard
          title="できること"
          items={[
            { icon: <Img className="w-4 h-4 text-[#00a1e9]" />, text: '出展作品の登録・編集（通常 or NFT を選択）' },
            { icon: <CreditCard className="w-4 h-4 text-[#00a1e9]" />, text: '売上・手数料の確認（成功時のみ10%）' },
            { icon: <Bell className="w-4 h-4 text-[#00a1e9]" />, text: '展示・販売に関する通知の受け取り' },
            { icon: <User className="w-4 h-4 text-[#00a1e9]" />, text: 'プロフィール編集とSNSリンク' },
          ]}
        />
        <FeatureCard
          title="安心の取り組み"
          items={[
            { icon: <ShieldCheck className="w-4 h-4 text-[#00a1e9]" />, text: 'ウォーターマーク／署名とAI学習阻害の多層保護' },
            { icon: <ShieldCheck className="w-4 h-4 text-[#00a1e9]" />, text: '支払いはクレジット（円）のみ、暗号資産は非対応' },
            { icon: <ShieldCheck className="w-4 h-4 text-[#00a1e9]" />, text: 'NFTは出展時選択作品のみ、購入後に発行・受け渡し' },
          ]}
        />
      </div>

      {/* フッターナビ */}
      <div className="mt-8 text-sm text-[#667]">
        <Link href="/#gallery" className="underline underline-offset-2 hover:opacity-80">ログインせずに作品を見る</Link>
        <span className="mx-2">／</span>
        <Link href="/#contact" className="underline underline-offset-2 hover:opacity-80">ログインできないとき</Link>
      </div>
    </main>
  );
}

/** Suspense 用の軽いスケルトン */
function LoginSkeleton() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-white to-[#eaf6ff] px-6 py-12 flex flex-col items-center">
      <div className="w-full max-w-[520px] rounded-2xl border bg-white shadow-lg p-6 animate-pulse">
        <div className="h-6 w-40 bg-[#eef5fb] rounded mb-4" />
        <div className="h-12 w-full bg-[#eef5fb] rounded" />
        <div className="mt-4 h-16 w-full bg-[#f6f8fb] rounded" />
      </div>
    </main>
  );
}

/* ---------- Sub ---------- */
function FeatureCard({
  title,
  items,
}: {
  title: string;
  items: { icon: React.ReactNode; text: string }[];
}) {
  return (
    <div className="rounded-2xl border bg-white shadow-sm p-5">
      <h2 className="font-semibold text-lg mb-2">{title}</h2>
      <ul className="space-y-2 text-sm">
        {items.map((it, i) => (
          <li key={i} className="flex items-start gap-2 text-[#444]">
            <span className="mt-0.5">{it.icon}</span>
            <span>{it.text}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
