"use client";

import { natoriAdminUi } from "@/features/natori/constants/adminUi";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  Calculator,
  ChevronDown,
  ChevronRight,
  FolderOpen,
  Inbox,
  KeyRound,
  Link2,
  LogOut,
  Palette,
  PenLine,
  Settings,
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
import { fetchNatoriProjectCollection } from "@/features/natori/data/supabaseProjects";
import ConsultationAttentionPanel from "@/features/natori/components/dashboard/ConsultationAttentionPanel";
import { Button } from "@/components/ui/button";
import DashboardTodaySummary from "@/features/natori/components/dashboard/DashboardTodaySummary";
import NotificationStatusPanel from "@/features/natori/components/dashboard/NotificationStatusPanel";
import PageEventsPanel from "@/features/natori/components/dashboard/PageEventsPanel";
import { NatoriSkeleton } from "@/features/natori/components/admin/NatoriSkeleton";
import { NatoriPageShell } from "@/features/natori/components/admin/NatoriPageShell";
import type { NatoriProject } from "@/features/natori/types/projects";

type ToolCard = {
  href: string;
  title: string;
  description: string;
  icon: LucideIcon;
};

type PublicPageCard = {
  title: string;
  description: string;
  icon: LucideIcon;
  viewHref: string;
  viewHrefKey: "portfolio" | "links";
  editHref: string;
};

const TOOL_CARDS: ToolCard[] = [
  {
    href: "/natori/inquiries",
    title: "問い合わせ",
    description: "受付〜入金待ちの対応",
    icon: Inbox,
  },
  {
    href: "/natori/projects",
    title: "案件管理",
    description: "制作スケジュールと工程",
    icon: FolderOpen,
  },
  {
    href: "/natori/estimate",
    title: "見積もり",
    description: "正式見積りと概算",
    icon: Calculator,
  },
  {
    href: "/natori/results",
    title: "売上・実績",
    description: "売上・CSV",
    icon: Trophy,
  },
];

const PUBLIC_PAGE_CARDS: PublicPageCard[] = [
  {
    title: "ポートフォリオ",
    description: "依頼者が最初に見るページ",
    icon: Palette,
    viewHref: "/natori/portfolio",
    viewHrefKey: "portfolio",
    editHref: "/natori/portfolio/edit",
  },
  {
    title: "リンク集",
    description: "SNSや各ページへの入口",
    icon: Link2,
    viewHref: "/natori/links",
    viewHrefKey: "links",
    editHref: "/natori/links/edit",
  },
];


export default function NatoriDashboardPage() {
  const [email, setEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [signingOut, setSigningOut] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState<NatoriUserProfile | null>(null);
  const [projects, setProjects] = useState<NatoriProject[] | null>(null);
  const [allProjects, setAllProjects] = useState<NatoriProject[] | null>(null);

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
        const collection = await fetchNatoriProjectCollection();
        setProjects(collection.projects);
        setAllProjects([...collection.projects, ...collection.archivedProjects]);
      } catch (err) {
        console.error("[dashboard] inquiry count fetch failed", err);
        setAllProjects(null);
        setProjects(null);
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

  const publicPages = useMemo(
    () =>
      PUBLIC_PAGE_CARDS.map((card) => {
        const override =
          card.viewHrefKey === "portfolio" ? profile?.portfolioUrl : profile?.linksUrl;
        return { ...card, viewHref: override || card.viewHref };
      }),
    [profile]
  );

  return (
    <NatoriPageShell
      current="dashboard"
      title="ダッシュボード"
      headerRight={
        <>
          {loading ? (
            <span className="text-xs text-zinc-500">確認中…</span>
          ) : email ? (
            <>
              <span className="hidden items-center gap-1.5 rounded-full bg-zinc-100 py-1 pl-1 pr-3 text-xs font-semibold text-zinc-700 sm:inline-flex">
                <span className="grid h-6 w-6 place-items-center rounded-full bg-white text-[#DB2777] shadow-[0_1px_2px_rgba(24,24,27,0.08)]">
                  <User2 className="h-3.5 w-3.5" aria-hidden />
                </span>
                {displayName ?? email}
              </span>
              <Button
                onClick={handleLogout}
                disabled={signingOut}
                variant="outline"
                className="h-9 rounded-full border-zinc-200 bg-white px-3 text-xs font-semibold text-zinc-700 shadow-[0_1px_2px_rgba(24,24,27,0.05)] hover:border-zinc-300 hover:bg-zinc-50"
              >
                <LogOut className="h-3.5 w-3.5" aria-hidden />
                {signingOut ? "ログアウト中…" : "ログアウト"}
              </Button>
            </>
          ) : (
            // ここまで表示できている時点で認可済みなので、email が無い = 合言葉キー
            <span className="inline-flex items-center gap-1.5 rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-700">
              <KeyRound className="h-3.5 w-3.5 text-zinc-500" aria-hidden />
              合言葉キーでアクセス中
            </span>
          )}
        </>
      }
    >
      <>
        {error ? <div className={natoriAdminUi.alert.error}>{error}</div> : null}

        {projects ? (
          <DashboardTodaySummary projects={projects} today={new Date()} />
        ) : loading ? (
          <div className="mt-4">
            <NatoriSkeleton heightClassName="h-24" />
          </div>
        ) : null}
        <ConsultationAttentionPanel projects={allProjects} loading={loading} onRefresh={() => void refresh()} />

        <section aria-labelledby="dashboard-tools-heading">
          <h2 id="dashboard-tools-heading" className={natoriAdminUi.sectionTitle}>
            管理ツール
          </h2>
          <ul className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
            {TOOL_CARDS.map((card, index) => {
              const Icon = card.icon;
              // リンク名はタイトルだけにし、説明は補足（aria-describedby）として読ませる
              const titleId = `dashboard-tool-title-${index}`;
              const descriptionId = `dashboard-tool-description-${index}`;
              return (
                <li key={card.title}>
                  <Link
                    href={card.href}
                    aria-labelledby={titleId}
                    aria-describedby={descriptionId}
                    className={`group relative flex h-full min-h-20 flex-col gap-3 rounded-2xl ${natoriAdminUi.surface} p-3.5 ${natoriAdminUi.cardInteractive} focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#831843] sm:flex-row sm:items-center sm:p-4`}
                  >
                    <span className={natoriAdminUi.iconTile}>
                      <Icon className="h-5 w-5" aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span id={titleId} className="block text-sm font-semibold leading-5 text-zinc-900">
                        {card.title}
                      </span>
                      <span id={descriptionId} className={`${natoriAdminUi.caption} mt-0.5 block`}>{card.description}</span>
                    </span>
                    <ChevronRight
                      className="absolute right-3 top-3.5 h-4 w-4 text-zinc-300 transition-[color,transform] group-hover:translate-x-0.5 group-hover:text-zinc-500 sm:static"
                      aria-hidden
                    />
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>

        <section aria-labelledby="dashboard-public-heading">
          <h2 id="dashboard-public-heading" className={natoriAdminUi.sectionTitle}>
            公開ページ
          </h2>
          <ul className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {publicPages.map((card) => {
              const Icon = card.icon;
              return (
                <li
                  key={card.title}
                  className={`rounded-2xl ${natoriAdminUi.surface} flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:p-5`}
                >
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <span className={natoriAdminUi.iconTile}>
                      <Icon className="h-5 w-5" aria-hidden />
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold leading-5 text-zinc-900">{card.title}</p>
                      <p className={`${natoriAdminUi.caption} mt-0.5`}>{card.description}</p>
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 sm:justify-end">
                    <Link
                      href={card.viewHref}
                      aria-label={`${card.title}の公開ページを見る`}
                      className={`${natoriAdminUi.btnLink} px-1`}
                    >
                      公開ページを見る
                      <ArrowUpRight className="h-4 w-4" aria-hidden />
                    </Link>
                    <Link
                      href={card.editHref}
                      aria-label={`${card.title}を編集する`}
                      className={natoriAdminUi.btnSecondary}
                    >
                      <PenLine className="h-4 w-4 text-zinc-500" aria-hidden />
                      編集する
                    </Link>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>

        <NotificationStatusPanel />

        <PageEventsPanel />

        <ProfileSettingsPanel
          profile={profile}
          onSaved={(next) => setProfile(next)}
        />
      </>
    </NatoriPageShell>
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
    <section className={`mt-6 rounded-2xl ${natoriAdminUi.surface}`}>
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        className="group flex w-full items-center justify-between gap-3 rounded-2xl p-4 text-left transition-colors hover:bg-zinc-50/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#831843] sm:px-5"
      >
        <div className="flex min-w-0 items-center gap-3">
          <span className={natoriAdminUi.iconTileNeutral}>
            <Settings className="h-5 w-5" aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-zinc-900">プロフィール設定</p>
            <p className="mt-0.5 text-xs leading-5 text-zinc-600">
              表示名・ポートフォリオ・リンク集のリンク先・1日の作業時間など、自分の情報を保存します。
            </p>
          </div>
        </div>
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-zinc-500 transition-colors group-hover:bg-zinc-100">
          <ChevronDown
            className={`h-5 w-5 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
            aria-hidden
          />
        </span>
      </button>

      {open ? (
        <div className="border-t border-zinc-100 px-4 pb-4 pt-4 sm:px-5 sm:pb-5">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="block text-sm">
              <span className={natoriAdminUi.label}>表示名</span>
              <input
                type="text"
                value={displayName}
                onChange={(event) => {
                  setDisplayName(event.target.value);
                  setSaved(false);
                }}
                placeholder="例: ナトリ"
                className={`${natoriAdminUi.input} mt-1`}
              />
            </label>
            <label className="block text-sm">
              <span className={natoriAdminUi.label}>
                ハンドル（任意 / 将来のURL用）
              </span>
              <input
                type="text"
                value={handle}
                onChange={(event) => {
                  setHandle(event.target.value);
                  setSaved(false);
                }}
                placeholder="例: natori"
                className={`${natoriAdminUi.input} mt-1`}
              />
            </label>
            <label className="block text-sm sm:col-span-2">
              <span className={natoriAdminUi.label}>
                ポートフォリオのリンク先
              </span>
              <input
                type="text"
                value={portfolioUrl}
                onChange={(event) => {
                  setPortfolioUrl(event.target.value);
                  setSaved(false);
                }}
                inputMode="url"
                autoComplete="off"
                placeholder="/natori または https://..."
                className={`${natoriAdminUi.input} mt-1`}
              />
            </label>
            <label className="block text-sm sm:col-span-2">
              <span className={natoriAdminUi.label}>
                リンク集のリンク先
              </span>
              <input
                type="text"
                value={linksUrl}
                onChange={(event) => {
                  setLinksUrl(event.target.value);
                  setSaved(false);
                }}
                inputMode="url"
                autoComplete="off"
                placeholder="/natori/links または https://..."
                className={`${natoriAdminUi.input} mt-1`}
              />
            </label>
            <label className="block text-sm">
              <span className={natoriAdminUi.label}>
                1日の作業時間（h）
              </span>
              <input
                type="number"
                min={0}
                max={24}
                step="0.5"
                value={dailyCapacity}
                onChange={(event) => {
                  setDailyCapacity(event.target.value);
                  setSaved(false);
                }}
                placeholder="例: 5"
                aria-describedby="profile-daily-capacity-hint"
                className={`${natoriAdminUi.input} mt-1`}
              />
              <span id="profile-daily-capacity-hint" className={natoriAdminUi.hint}>
                0〜24の範囲、0.5刻み
              </span>
            </label>
          </div>

          {error ? <p className={`${natoriAdminUi.alert.error} mt-3`}>{error}</p> : null}
          {saved ? <p className={`${natoriAdminUi.alert.success} mt-3`}>保存しました。</p> : null}

          <div className="mt-4 flex flex-wrap justify-end gap-2">
            <Button
              onClick={handleSave}
              disabled={saving}
              className={natoriAdminUi.btnPrimary}
            >
              {saving ? "保存中…" : "保存"}
            </Button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
