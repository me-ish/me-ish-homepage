'use client';

import { Suspense, useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { FcGoogle } from 'react-icons/fc';
import {
  ShieldCheck, Bell, CreditCard, Image as Img, User, LogIn, Loader2, Sparkles
} from 'lucide-react';
import { Button } from '@/components/ui/button';

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
    <main className="min-h-screen bg-gradient-to-b from-[#f8fbff] via-white to-white px-6 py-12 flex flex-col items-center text-gray-800">
      {/* 背景パターン */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: 'radial-gradient(circle, rgba(0,161,233,0.8) 1px, transparent 1px)',
            backgroundSize: '24px 24px',
          }}
        />
      </div>

      {/* ブランド */}
      <Link
        href="/"
        className="relative z-10 mb-8 group flex items-center gap-2"
      >
        <span className="text-[#00a1e9] font-lilita text-[2.5rem] font-bold group-hover:opacity-80 transition-opacity">
          me-ish
        </span>
        <span className="text-xs bg-gradient-to-r from-[#e60039] to-[#ff1a53] text-white px-2.5 py-1 rounded-full font-semibold shadow-sm">
          β
        </span>
      </Link>

      {/* カード */}
      <div className="relative z-10 w-full max-w-[520px] rounded-3xl bg-white/80 backdrop-blur-sm ring-1 ring-[#00a1e9]/10 shadow-xl p-8">
        <h1 className="text-xl md:text-2xl font-bold text-gray-900 mb-2 flex items-center gap-2">
          <div className="p-2 rounded-xl bg-[#00a1e9]/10">
            <LogIn className="w-5 h-5 text-[#00a1e9]" />
          </div>
          マイページにログイン
        </h1>
        <p className="text-sm text-gray-600 mb-6 leading-relaxed">
          購入履歴のダウンロード、出展作品の管理、通知設定などをご利用いただけます。
          <span className="text-gray-500">鑑賞だけならログイン不要です。</span>
        </p>

        {/* Google ログイン */}
        <Button
          onClick={handleGoogleLogin}
          disabled={loading}
          aria-busy={loading}
          variant="outline"
          className={`
            w-full flex items-center justify-center gap-3
            border-2 border-gray-200 bg-white
            px-5 py-6 h-auto rounded-2xl
            text-gray-800 font-semibold text-base
            shadow-sm hover:shadow-md hover:border-[#00a1e9]/30 hover:bg-[#f8fbff]
            transition-all duration-300
            ${loading ? 'opacity-70 cursor-not-allowed' : ''}
          `}
        >
          {loading ? (
            <>
              <Loader2 className="w-6 h-6 animate-spin text-[#00a1e9]" />
              <span>ログイン中...</span>
            </>
          ) : (
            <>
              <FcGoogle className="text-2xl" />
              <span>Googleでログイン</span>
            </>
          )}
        </Button>

        {/* エラー表示 */}
        {err && (
          <div
            className="mt-4 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700"
            role="alert"
          >
            {err}
          </div>
        )}

        {/* 同意・安心情報 */}
        <div className="mt-5 text-xs text-gray-500 leading-relaxed">
          ログインすると、<strong className="text-gray-700">メールアドレス・表示名・アイコン</strong>を取得します（投稿や連絡先へのアクセスは行いません）。
          続行により{' '}
          <Link href="/footer/terms" className="text-[#00a1e9] hover:underline">
            利用規約
          </Link>{' '}
          と{' '}
          <Link href="/footer/privacy" className="text-[#00a1e9] hover:underline">
            プライバシーポリシー
          </Link>{' '}
          に同意したものとみなされます。
        </div>
      </div>

      {/* 機能のハイライト（2列 → モバイル1列） */}
      <div className="relative z-10 w-full max-w-[920px] grid grid-cols-1 md:grid-cols-2 gap-5 mt-10">
        <FeatureCard
          title="できること"
          icon={<Sparkles className="w-5 h-5 text-[#00a1e9]" />}
          items={[
            { icon: <Img className="w-4 h-4" />, text: '出展作品の登録・編集' },
            { icon: <CreditCard className="w-4 h-4" />, text: '売上・手数料の確認（成功時のみ10%）' },
            { icon: <Bell className="w-4 h-4" />, text: '展示・販売に関する通知の受け取り' },
            { icon: <User className="w-4 h-4" />, text: 'プロフィール編集とSNSリンク' },
          ]}
          accentColor="blue"
        />
        <FeatureCard
          title="安心の取り組み"
          icon={<ShieldCheck className="w-5 h-5 text-emerald-500" />}
          items={[
            { icon: <ShieldCheck className="w-4 h-4" />, text: 'ウォーターマーク／署名とAI学習阻害の多層保護' },
            { icon: <ShieldCheck className="w-4 h-4" />, text: '支払いはクレジット（円）のみ、暗号資産は非対応' },
            { icon: <ShieldCheck className="w-4 h-4" />, text: '購入後すぐにデジタル作品をダウンロード' },
          ]}
          accentColor="emerald"
        />
      </div>

      {/* フッターナビ */}
      <div className="relative z-10 mt-10 flex flex-wrap items-center justify-center gap-4 text-sm">
        <Link
          href="/#gallery"
          className="px-4 py-2 rounded-full bg-white ring-1 ring-gray-200 text-gray-600 hover:ring-[#00a1e9] hover:text-[#00a1e9] transition-all"
        >
          ログインせずに作品を見る
        </Link>
        <Link
          href="/#contact"
          className="px-4 py-2 rounded-full bg-white ring-1 ring-gray-200 text-gray-600 hover:ring-[#00a1e9] hover:text-[#00a1e9] transition-all"
        >
          ログインできないとき
        </Link>
      </div>
    </main>
  );
}

/** Suspense 用の軽いスケルトン */
function LoginSkeleton() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-[#f8fbff] via-white to-white px-6 py-12 flex flex-col items-center">
      <div className="h-10 w-32 bg-gray-100 rounded-lg mb-8 animate-pulse" />
      <div className="w-full max-w-[520px] rounded-3xl bg-white shadow-xl p-8 animate-pulse">
        <div className="h-8 w-48 bg-gray-100 rounded-lg mb-4" />
        <div className="h-4 w-full bg-gray-100 rounded mb-2" />
        <div className="h-4 w-3/4 bg-gray-100 rounded mb-6" />
        <div className="h-14 w-full bg-gray-100 rounded-2xl" />
      </div>
    </main>
  );
}

/* ---------- Sub ---------- */
function FeatureCard({
  title,
  icon,
  items,
  accentColor = 'blue',
}: {
  title: string;
  icon: React.ReactNode;
  items: { icon: React.ReactNode; text: string }[];
  accentColor?: 'blue' | 'emerald';
}) {
  const colors = {
    blue: {
      bg: 'bg-gradient-to-br from-[#f0f9ff] to-white',
      iconBg: 'bg-[#00a1e9]/10',
      iconText: 'text-[#00a1e9]',
    },
    emerald: {
      bg: 'bg-gradient-to-br from-emerald-50 to-white',
      iconBg: 'bg-emerald-500/10',
      iconText: 'text-emerald-500',
    },
  };

  const c = colors[accentColor];

  return (
    <div className={`rounded-2xl ${c.bg} ring-1 ring-gray-100 shadow-sm p-6 hover:shadow-md transition-shadow`}>
      <div className="flex items-center gap-3 mb-4">
        <div className={`p-2.5 rounded-xl ${c.iconBg}`}>
          {icon}
        </div>
        <h2 className="font-bold text-lg text-gray-900">{title}</h2>
      </div>
      <ul className="space-y-3 text-sm">
        {items.map((it, i) => (
          <li key={i} className="flex items-start gap-3 text-gray-600">
            <span className={`mt-0.5 ${c.iconText}`}>{it.icon}</span>
            <span>{it.text}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
