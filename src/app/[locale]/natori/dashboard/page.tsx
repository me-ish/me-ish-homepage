"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Calculator,
  ChevronDown,
  ChevronUp,
  FolderOpen,
  ImageIcon,
  Inbox,
  Link2,
  LogOut,
  Palette,
  PenLine,
  Settings,
  Sparkles,
  Trophy,
  User2,
  type LucideIcon,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  fetchOwnNatoriProfile,
  upsertOwnNatoriProfile,
  type NatoriUserProfile,
} from "@/features/natori/data/supabaseProfile";
import { fetchNatoriProjects } from "@/features/natori/data/supabaseProjects";
import { isPreworkStatus } from "@/features/natori/lib/projects";
import { Button } from "@/components/ui/button";
import Footer from "@/features/natori/components/Footer";

type DashboardCard = {
  href: string;
  title: string;
  description: string;
  icon: LucideIcon;
  accent: string;
  hrefKey?: "portfolio" | "links";
};

const CARDS: DashboardCard[] = [
  {
    href: "/natori/inquiries",
    title: "問い合わせ管理",
    description: "フォームから来た依頼の内容確認・見積もり/支払いメール送信・経過チェック",
    icon: Inbox,
    accent: "from-orange-100 to-orange-50 text-orange-700",
  },
  {
    href: "/natori/projects",
    title: "案件管理",
    description: "カレンダー・スケジュール・タスクチェック",
    icon: FolderOpen,
    accent: "from-pink-100 to-pink-50 text-pink-700",
  },
  {
    href: "/natori/estimate",
    title: "見積もり",
    description: "依頼文から概算見積もりと返信文のたたき台を作る内部ツール",
    icon: Calculator,
    accent: "from-rose-100 to-rose-50 text-rose-700",
  },
  {
    href: "/natori/results",
    title: "実績",
    description: "納品済み案件の件数・売上・月別/タイプ別の推移",
    icon: Trophy,
    accent: "from-emerald-100 to-emerald-50 text-emerald-700",
  },
  {
    href: "/natori",
    title: "ポートフォリオ（VGen）",
    description: "未ログインでも閲覧できる公開ページ・ギャラリー",
    icon: ImageIcon,
    accent: "from-fuchsia-100 to-fuchsia-50 text-fuchsia-700",
    hrefKey: "portfolio",
  },
  {
    href: "/natori/portfolio",
    title: "ポートフォリオ（コミッション）",
    description: "やわらかく可愛いイラストのコミッション受付ページ（VGenページとは別の独立ページ）",
    icon: Palette,
    accent: "from-violet-100 to-violet-50 text-violet-700",
  },
  {
    href: "/natori/portfolio/edit",
    title: "ポートフォリオ編集",
    description: "コミッションページの文章・料金・作品画像をブラウザから編集",
    icon: PenLine,
    accent: "from-sky-100 to-sky-50 text-sky-700",
  },
  {
    href: "/natori/links",
    title: "リンク集",
    description: "X / TikTok / つなぐ / Skeb など",
    icon: Link2,
    accent: "from-amber-100 to-amber-50 text-amber-700",
    hrefKey: "links",
  },
];

export default function NatoriDashboardPage() {
  const [email, setEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [signingOut, setSigningOut] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState<NatoriUserProfile | null>(null);
  // 問い合わせカードのバッジ用。未対応 = 依頼受付のまま止まっている件数、
  // 対応中 = 見積もり中〜入金待ちの件数。未認可などで取れなければ非表示
  const [inquiryCounts, setInquiryCounts] = useState<{
    pending: number;
    inProgress: number;
  } | null>(null);

  const refresh = useCallback(async () => {
    try {
      // セッションが無いのは正常系（合言葉キーでのアクセス）。エラー表示は
      // しない。プロフィールは認可込みのサーバー API から取得する。
      const supabase = createClient();
      const { data } = await supabase.auth.getUser().catch(() => ({
        data: { user: null },
      }));
      setEmail(data.user?.email ?? null);
      try {
        const p = await fetchOwnNatoriProfile();
        setProfile(p);
      } catch (err) {
        console.error("[dashboard] profile fetch failed", err);
      }
      try {
        const projects = await fetchNatoriProjects();
        const prework = projects.filter((project) => isPreworkStatus(project.status));
        const pending = prework.filter(
          (project) => project.status === "inquiry" || project.status === "consulting"
        ).length;
        setInquiryCounts({ pending, inProgress: prework.length - pending });
      } catch (err) {
        console.error("[dashboard] inquiry count fetch failed", err);
        setInquiryCounts(null);
      }
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
      // プロフィールはセッションの有無に依らずサーバー API から取れるので、
      // ここではログイン表示用の email だけ追従させる。
      setEmail(session?.user.email ?? null);
    });
    return () => {
      sub.subscription.unsubscribe();
    };
  }, [refresh]);

  const handleLogout = async () => {
    setSigningOut(true);
    setError(null);
    try {
      const supabase = createClient();
      const { error: signOutErr } = await supabase.auth.signOut();
      if (signOutErr) throw signOutErr;
      setEmail(null);
      setProfile(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSigningOut(false);
    }
  };

  const displayName = profile?.displayName?.trim() || email || null;

  const resolvedCards = useMemo(
    () =>
      CARDS.map((card) => {
        if (card.hrefKey === "portfolio" && profile?.portfolioUrl) {
          return { ...card, href: profile.portfolioUrl };
        }
        if (card.hrefKey === "links" && profile?.linksUrl) {
          return { ...card, href: profile.linksUrl };
        }
        return card;
      }),
    [profile]
  );

  return (
    <main className="min-h-screen bg-gradient-to-b from-pink-50/70 via-white to-white">
      <section className="border-b border-pink-100 bg-white/70 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3 sm:px-6">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-pink-600">Dashboard</p>
          <p className="hidden text-sm font-bold text-gray-900 sm:inline">仕事用ダッシュボード</p>
          <div className="ml-auto flex items-center gap-2">
            {loading ? (
              <span className="text-xs text-gray-500">確認中…</span>
            ) : email ? (
              <>
                <span className="hidden items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-800 sm:inline-flex">
                  <User2 className="h-3.5 w-3.5" aria-hidden />
                  {displayName ?? email}
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
            ) : null}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-pink-500 text-white shadow-sm">
            <Sparkles className="h-5 w-5" aria-hidden />
          </div>
          <div className="min-w-0">
            <h1 className="text-2xl font-black text-gray-900 sm:text-3xl">
              {displayName ? `${displayName} のダッシュボード` : "仕事用ダッシュボード"}
            </h1>
            <p className="mt-1 text-sm leading-6 text-gray-600">
              案件管理・見積もり・ポートフォリオ導線をまとめた管理ダッシュボードです。
            </p>
            <p className="mt-1 text-sm leading-6 text-gray-600">
              案件管理と見積もりは関係者専用ページです。リンク集と作品ページは公開ページです。
            </p>
          </div>
        </div>

        {error ? (
          <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold text-red-700 sm:text-sm">
            {error}
          </div>
        ) : null}

        <ul className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
          {resolvedCards.map((card) => {
            const Icon = card.icon;
            return (
              <li key={card.title}>
                <Link
                  href={card.href}
                  className={`group flex items-start gap-3 rounded-2xl border border-pink-100 bg-gradient-to-br ${card.accent} bg-white/80 p-4 shadow-sm transition hover:shadow-md sm:p-5`}
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white shadow-sm">
                    <Icon className="h-5 w-5" aria-hidden />
                  </div>
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2 text-base font-black leading-6 text-gray-900">
                      {card.title}
                      {card.href === "/natori/inquiries" && inquiryCounts ? (
                        <>
                          {inquiryCounts.pending > 0 ? (
                            <span className="inline-flex items-center rounded-full bg-red-500 px-2 py-0.5 text-[11px] font-bold text-white">
                              未対応 {inquiryCounts.pending}件
                            </span>
                          ) : null}
                          {inquiryCounts.inProgress > 0 ? (
                            <span className="inline-flex items-center rounded-full border border-orange-300 bg-white px-2 py-0.5 text-[11px] font-bold text-orange-700">
                              対応中 {inquiryCounts.inProgress}件
                            </span>
                          ) : null}
                        </>
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

        <ProfileSettingsPanel
          profile={profile}
          onSaved={(next) => setProfile(next)}
        />

      </section>

      <Footer />
    </main>
  );
}

function ProfileSettingsPanel({
  profile,
  onSaved,
}: {
  profile: NatoriUserProfile | null;
  onSaved: (next: NatoriUserProfile) => void;
}) {
  const [open, setOpen] = useState(false);
  const [displayName, setDisplayName] = useState(profile?.displayName ?? "");
  const [handle, setHandle] = useState(profile?.handle ?? "");
  const [portfolioUrl, setPortfolioUrl] = useState(profile?.portfolioUrl ?? "");
  const [linksUrl, setLinksUrl] = useState(profile?.linksUrl ?? "");
  const [dailyCapacity, setDailyCapacity] = useState<string>(
    profile?.dailyCapacityHours != null ? String(profile.dailyCapacityHours) : ""
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setDisplayName(profile?.displayName ?? "");
    setHandle(profile?.handle ?? "");
    setPortfolioUrl(profile?.portfolioUrl ?? "");
    setLinksUrl(profile?.linksUrl ?? "");
    setDailyCapacity(
      profile?.dailyCapacityHours != null ? String(profile.dailyCapacityHours) : ""
    );
  }, [profile]);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const dailyNum = dailyCapacity.trim() === "" ? null : Number(dailyCapacity);
      if (dailyNum !== null && (!Number.isFinite(dailyNum) || dailyNum < 0 || dailyNum > 24)) {
        throw new Error("1日の作業時間は0〜24の範囲で入力してください。");
      }
      const next = await upsertOwnNatoriProfile({
        handle: handle.trim() || null,
        displayName: displayName.trim() || null,
        portfolioUrl: portfolioUrl.trim() || null,
        linksUrl: linksUrl.trim() || null,
        dailyCapacityHours: dailyNum,
      });
      onSaved(next);
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="mt-6 rounded-2xl border border-pink-100 bg-white shadow-sm">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 rounded-2xl p-3 text-left hover:bg-pink-50/40 sm:p-4"
      >
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-gray-900 text-white">
            <Settings className="h-4 w-4" aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-bold text-gray-900">プロフィール設定</p>
            <p className="mt-0.5 text-xs text-gray-600">
              表示名・ポートフォリオ・リンク集のリンク先・1日の作業時間など、自分の情報を保存します。
            </p>
          </div>
        </div>
        <span className="shrink-0 text-gray-500">
          {open ? <ChevronUp className="h-5 w-5" aria-hidden /> : <ChevronDown className="h-5 w-5" aria-hidden />}
        </span>
      </button>

      {open ? (
        <div className="border-t border-pink-100 px-3 pb-3 pt-3 sm:px-4 sm:pb-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="block text-[11px] font-bold uppercase tracking-wide text-pink-700">表示名</span>
              <input
                type="text"
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                placeholder="例: ナトリ"
                className="mt-1 h-10 w-full rounded-lg border border-pink-200 bg-white px-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-pink-300"
              />
            </label>
            <label className="block text-sm">
              <span className="block text-[11px] font-bold uppercase tracking-wide text-pink-700">
                ハンドル（任意 / 将来のURL用）
              </span>
              <input
                type="text"
                value={handle}
                onChange={(event) => setHandle(event.target.value)}
                placeholder="例: natori"
                className="mt-1 h-10 w-full rounded-lg border border-pink-200 bg-white px-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-pink-300"
              />
            </label>
            <label className="block text-sm sm:col-span-2">
              <span className="block text-[11px] font-bold uppercase tracking-wide text-pink-700">
                ポートフォリオのリンク先
              </span>
              <input
                type="text"
                value={portfolioUrl}
                onChange={(event) => setPortfolioUrl(event.target.value)}
                placeholder="/natori または https://..."
                className="mt-1 h-10 w-full rounded-lg border border-pink-200 bg-white px-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-pink-300"
              />
            </label>
            <label className="block text-sm sm:col-span-2">
              <span className="block text-[11px] font-bold uppercase tracking-wide text-pink-700">
                リンク集のリンク先
              </span>
              <input
                type="text"
                value={linksUrl}
                onChange={(event) => setLinksUrl(event.target.value)}
                placeholder="/natori/links または https://..."
                className="mt-1 h-10 w-full rounded-lg border border-pink-200 bg-white px-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-pink-300"
              />
            </label>
            <label className="block text-sm">
              <span className="block text-[11px] font-bold uppercase tracking-wide text-pink-700">
                1日の作業時間（h）
              </span>
              <input
                type="number"
                min={0}
                max={24}
                step="0.5"
                value={dailyCapacity}
                onChange={(event) => setDailyCapacity(event.target.value)}
                placeholder="例: 5"
                className="mt-1 h-10 w-full rounded-lg border border-pink-200 bg-white px-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-pink-300"
              />
            </label>
          </div>

          {error ? (
            <p className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold text-red-700">
              {error}
            </p>
          ) : null}
          {saved ? (
            <p className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700">
              保存しました。
            </p>
          ) : null}

          <div className="mt-4 flex flex-wrap justify-end gap-2">
            <Button
              onClick={handleSave}
              disabled={saving}
              className="h-10 rounded-full bg-pink-500 px-4 text-xs font-bold text-white hover:bg-pink-600 disabled:opacity-60"
            >
              {saving ? "保存中…" : "保存"}
            </Button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
