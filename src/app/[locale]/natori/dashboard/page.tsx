"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Calculator,
  FolderOpen,
  ImageIcon,
  Link2,
  LogIn,
  LogOut,
  Sparkles,
  User2,
  type LucideIcon,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import Footer from "@/components/natori/Footer";

type DashboardCard = {
  href: string;
  title: string;
  description: string;
  icon: LucideIcon;
  accent: string;
  requiresLogin?: boolean;
};

const CARDS: DashboardCard[] = [
  {
    href: "/natori/projects",
    title: "案件管理",
    description: "カレンダー・スケジュール・タスクチェック",
    icon: FolderOpen,
    accent: "from-pink-100 to-pink-50 text-pink-700",
    requiresLogin: true,
  },
  {
    href: "/natori/estimate",
    title: "見積もり",
    description: "依頼文から概算と返信文を作る",
    icon: Calculator,
    accent: "from-rose-100 to-rose-50 text-rose-700",
  },
  {
    href: "/natori",
    title: "ポートフォリオ",
    description: "公開ページ・ギャラリー",
    icon: ImageIcon,
    accent: "from-fuchsia-100 to-fuchsia-50 text-fuchsia-700",
  },
  {
    href: "/natori/links",
    title: "リンク集",
    description: "X / TikTok / つなぐ / Skeb など",
    icon: Link2,
    accent: "from-amber-100 to-amber-50 text-amber-700",
  },
];

export default function NatoriDashboardPage() {
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [signingOut, setSigningOut] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const supabase = createClient();
      const { data, error: authErr } = await supabase.auth.getUser();
      if (authErr) throw authErr;
      setEmail(data.user?.email ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const supabase = createClient();
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setEmail(session?.user.email ?? null);
    });
    return () => {
      sub.subscription.unsubscribe();
    };
  }, [refresh]);

  const handleLogin = () => {
    router.push("/login?redirect=/natori/dashboard");
  };

  const handleLogout = async () => {
    setSigningOut(true);
    setError(null);
    try {
      const supabase = createClient();
      const { error: signOutErr } = await supabase.auth.signOut();
      if (signOutErr) throw signOutErr;
      setEmail(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSigningOut(false);
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-b from-pink-50/70 via-white to-white">
      <section className="border-b border-pink-100 bg-white/70 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3 sm:px-6">
          <Link href="/natori" className="text-xs font-medium text-pink-600 hover:underline">
            Natori
          </Link>
          <span className="text-xs text-gray-300">/</span>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-pink-600">Dashboard</p>
          <p className="hidden text-sm font-bold text-gray-900 sm:inline">仕事用ダッシュボード</p>
          <div className="ml-auto flex items-center gap-2">
            {loading ? (
              <span className="text-xs text-gray-500">確認中…</span>
            ) : email ? (
              <>
                <span className="hidden items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-800 sm:inline-flex">
                  <User2 className="h-3.5 w-3.5" aria-hidden />
                  {email}
                </span>
                <Button
                  onClick={handleLogout}
                  disabled={signingOut}
                  variant="outline"
                  className="h-9 rounded-full border-gray-300 bg-white px-3 text-xs font-bold text-gray-800 hover:bg-gray-50"
                >
                  <LogOut className="h-3.5 w-3.5" aria-hidden />
                  {signingOut ? "ログアウト中…" : "ログアウト"}
                </Button>
              </>
            ) : (
              <Button
                onClick={handleLogin}
                className="h-9 rounded-full bg-pink-500 px-3 text-xs font-bold text-white hover:bg-pink-600"
              >
                <LogIn className="h-3.5 w-3.5" aria-hidden />
                ログイン
              </Button>
            )}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-pink-500 text-white shadow-sm">
            <Sparkles className="h-5 w-5" aria-hidden />
          </div>
          <div className="min-w-0">
            <h1 className="text-2xl font-black text-gray-900 sm:text-3xl">仕事用ダッシュボード</h1>
            <p className="mt-1 text-sm leading-6 text-gray-600">
              案件管理・見積もり・ポートフォリオ・リンク集をここからまとめて開けます。
            </p>
          </div>
        </div>

        {email && email === "info@me-ish.art" ? null : null}

        {error ? (
          <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold text-red-700 sm:text-sm">
            {error}
          </div>
        ) : null}

        {!loading && !email ? (
          <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs leading-5 text-amber-900 sm:text-sm">
            <p className="font-bold">ログインしていません。</p>
            <p className="mt-1">
              案件管理のデータはログインすると自分のアカウントに切り替わります。見積もりやポートフォリオはログインなしでも開けます。
            </p>
          </div>
        ) : null}

        <ul className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
          {CARDS.map((card) => {
            const Icon = card.icon;
            const locked = card.requiresLogin && !email;
            return (
              <li key={card.href}>
                <Link
                  href={card.href}
                  className={`group flex items-start gap-3 rounded-2xl border border-pink-100 bg-gradient-to-br ${card.accent} bg-white/80 p-4 shadow-sm transition hover:shadow-md sm:p-5`}
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white shadow-sm">
                    <Icon className="h-5 w-5" aria-hidden />
                  </div>
                  <div className="min-w-0">
                    <p className="text-base font-black leading-6 text-gray-900">
                      {card.title}
                      {locked ? (
                        <span className="ml-2 rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                          要ログイン
                        </span>
                      ) : null}
                    </p>
                    <p className="mt-1 break-words text-xs leading-5 text-gray-700 sm:text-sm">
                      {card.description}
                    </p>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      <Footer />
    </main>
  );
}
