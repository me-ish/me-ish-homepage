"use client";

import { natoriAdminUi } from "@/features/natori/constants/adminUi";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Calculator,
  ChevronDown,
  ChevronUp,
  FolderOpen,
  Inbox,
  KeyRound,
  Link2,
  LogOut,
  Palette,
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

const ICON_FRAME_CLASS =
  "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#FFF8FA] text-[#BE185D]";

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
          ) : (
            // ここまで表示できている時点で認可済みなので、email が無い = 合言葉キー
            <span className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-xs font-bold text-gray-600">
              <KeyRound className="h-3.5 w-3.5" aria-hidden />
              合言葉キーでアクセス中
            </span>
          )}
        </>
      }
    >
      <div>
        {error ? (
          <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold text-red-700 sm:text-sm">
            {error}
          </div>
        ) : null}

        {projects ? (
          <DashboardTodaySummary projects={projects} today={new Date()} />
        ) : loading ? (
          <div className="mt-4">
            <NatoriSkeleton heightClassName="h-24" />
          </div>
        ) : null}
        <ConsultationAttentionPanel projects={allProjects} loading={loading} onRefresh={() => void refresh()} />

        <section aria-labelledby="dashboard-tools-heading" className="mt-6">
          <h2 id="dashboard-tools-heading" className={natoriAdminUi.sectionTitle}>
            管理ツール
          </h2>
          <ul className="mt-2 grid grid-cols-2 gap-2.5 lg:grid-cols-4">
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
                    className={`${natoriAdminUi.card} flex h-full min-h-20 items-center gap-3 !p-3 transition hover:border-pink-200 hover:shadow-md sm:!p-4`}
                  >
                    <span className={ICON_FRAME_CLASS}>
                      <Icon className="h-5 w-5" aria-hidden />
                    </span>
                    <span className="min-w-0">
                      <span id={titleId} className="block text-sm font-black leading-5 text-gray-900">
                        {card.title}
                      </span>
                      <span id={descriptionId} className={`${natoriAdminUi.caption} block`}>{card.description}</span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>

        <section aria-labelledby="dashboard-public-heading" className="mt-6">
          <h2 id="dashboard-public-heading" className={natoriAdminUi.sectionTitle}>
            公開ページ
          </h2>
          <ul className="mt-2 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            {publicPages.map((card) => {
              const Icon = card.icon;
              return (
                <li key={card.title} className={`${natoriAdminUi.card} flex flex-col gap-3`}>
                  <div className="flex items-center gap-3">
                    <span className={ICON_FRAME_CLASS}>
                      <Icon className="h-5 w-5" aria-hidden />
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-black leading-5 text-gray-900">{card.title}</p>
                      <p className={natoriAdminUi.caption}>{card.description}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Link
                      href={card.viewHref}
                      aria-label={`${card.title}の公開ページを見る`}
                      className={natoriAdminUi.btnLink}
                    >
                      公開ページを見る
                    </Link>
                    <Link
                      href={card.editHref}
                      aria-label={`${card.title}を編集する`}
                      className={natoriAdminUi.btnSecondary}
                    >
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
      </div>
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
