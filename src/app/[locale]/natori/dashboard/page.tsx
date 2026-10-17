"use client";

import { useRevisionedEdit } from "@/features/natori/components/dashboard/useRevisionedEdit";
import EditConflictReview from "@/features/natori/components/dashboard/EditConflictReview";
import { natoriAdminUi } from "@/features/natori/constants/adminUi";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  ChevronDown,
  KeyRound,
  Link2,
  LogOut,
  Palette,
  PenLine,
  Settings,
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
import NotificationAlertBanner from "@/features/natori/components/dashboard/NotificationAlertBanner";
import PageEventsPanel from "@/features/natori/components/dashboard/PageEventsPanel";
import { NatoriSkeleton } from "@/features/natori/components/admin/NatoriSkeleton";
import { NatoriPageShell } from "@/features/natori/components/admin/NatoriPageShell";
import type { NatoriProject } from "@/features/natori/types/projects";

type PublicPageCard = {
  title: string;
  description: string;
  icon: LucideIcon;
  viewHref: string;
  viewHrefKey: "portfolio" | "links";
  editHref: string;
};

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
  const generation = useRef(0);
  const renderedGeneration = generation.current;
  const [email, setEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [signingOut, setSigningOut] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState<NatoriUserProfile | null | undefined>(undefined);
  const [projects, setProjects] = useState<NatoriProject[] | null>(null);
  const [allProjects, setAllProjects] = useState<NatoriProject[] | null>(null);

  const refresh = useCallback(async () => {
    const requestedGeneration = generation.current;
    try {
      // セッションが無いのは正常系（合言葉キーでのアクセス）。エラー表示は
      // しない。プロフィールは認可込みのサーバー API から取得する。
      const supabase = createClient();
      const { data } = await supabase.auth.getUser().catch(() => ({
        data: { user: null },
      }));
      if (requestedGeneration !== generation.current) return;
      setEmail(data.user?.email ?? null);
      try {
        const p = await fetchOwnNatoriProfile();
        if (requestedGeneration !== generation.current) return;
        setProfile(current => current && (!p || current.mutationRevision > p.mutationRevision) ? current : p);
      } catch (err) {
        console.error("[dashboard] profile fetch failed", err);
      }
      try {
        const collection = await fetchNatoriProjectCollection();
        if (requestedGeneration !== generation.current) return;
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
    generation.current += 1;
    setSigningOut(true);
    setError(null);
    try {
      const supabase = createClient();
      const { error: signOutErr } = await supabase.auth.signOut();
      if (signOutErr) throw signOutErr;
      generation.current += 1;
      setEmail(null);
      setProfile(undefined);
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

        <NotificationAlertBanner />

        {projects ? (
          <DashboardTodaySummary projects={projects} today={new Date()} />
        ) : loading ? (
          <div className="mt-4">
            <NatoriSkeleton heightClassName="h-24" />
          </div>
        ) : null}
        <ConsultationAttentionPanel projects={allProjects} loading={loading} onRefresh={() => void refresh()} />

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

        {profile !== undefined ? <ProfileSettingsPanel
          profile={profile}
          onSaved={(next) => { if (generation.current === renderedGeneration) setProfile(current => current && current.mutationRevision > next.mutationRevision ? current : next); }}
        /> : <button type="button" className={natoriAdminUi.btnSecondary} onClick={() => void refresh()} disabled={loading}>{loading ? "プロフィールを読み込み中…" : "プロフィールを再取得"}</button>}
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
  const profileValues = (value: NatoriUserProfile | null) => ({ displayName: value?.displayName ?? "", handle: value?.handle ?? "", portfolioUrl: value?.portfolioUrl ?? "", linksUrl: value?.linksUrl ?? "", dailyCapacity: value?.dailyCapacityHours != null ? String(value.dailyCapacityHours) : "" });
  const session = useRevisionedEdit({ revision: profile?.mutationRevision ?? null, values: profileValues(profile) });
  const { displayName, handle, portfolioUrl, linksUrl, dailyCapacity } = session.values;
  const { saving, error } = session;
  const [saved, setSaved] = useState(false);
  const handleSave = async () => {
    const dailyNum = dailyCapacity.trim() === "" ? null : Number(dailyCapacity);
    if (dailyNum !== null && (!Number.isFinite(dailyNum) || dailyNum < 0 || dailyNum > 24)) { session.setError("1日の作業時間は0〜24の範囲で入力してください。"); return; }
    setSaved(false);
    const success = await session.save(async (changes, revision) => {
      const patch: Parameters<typeof upsertOwnNatoriProfile>[0] = {};
      if (changes.handle !== undefined) patch.handle = changes.handle.trim() || null;
      if (changes.displayName !== undefined) patch.displayName = changes.displayName.trim() || null;
      if (changes.portfolioUrl !== undefined) patch.portfolioUrl = changes.portfolioUrl.trim() || null;
      if (changes.linksUrl !== undefined) patch.linksUrl = changes.linksUrl.trim() || null;
      if (changes.dailyCapacity !== undefined) patch.dailyCapacityHours = dailyNum;
      const next = await upsertOwnNatoriProfile(patch, revision);
      onSaved(next);
      return { revision: next.mutationRevision, values: profileValues(next) };
    });
    if (success) setSaved(true);
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
          <fieldset disabled={saving || session.reading} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="block text-sm">
              <span className={natoriAdminUi.label}>表示名</span>
              <input
                type="text"
                value={displayName}
                onChange={(event) => {
                  session.setField("displayName", event.target.value);
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
                  session.setField("handle", event.target.value);
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
                  session.setField("portfolioUrl", event.target.value);
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
                  session.setField("linksUrl", event.target.value);
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
                  session.setField("dailyCapacity", event.target.value);
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
          </fieldset>

          {session.needsReview ? <EditConflictReview initial={session.initial.values} latest={session.latest?.values ?? null} current={session.values} labels={{ displayName: "表示名", handle: "ハンドル", portfolioUrl: "ポートフォリオのリンク先", linksUrl: "リンク集のリンク先", dailyCapacity: "1日の作業時間" }} reading={session.reading} onCompare={() => void session.compare(async () => { const latest = await fetchOwnNatoriProfile(); return { revision: latest?.mutationRevision ?? null, values: profileValues(latest) }; })} onAcknowledge={session.acknowledge} /> : null}
          {error ? <p className={`${natoriAdminUi.alert.error} mt-3`}>{error}</p> : null}
          {saved ? <p className={`${natoriAdminUi.alert.success} mt-3`}>保存しました。</p> : null}

          <div className="mt-4 flex flex-wrap justify-end gap-2">
            <Button
              onClick={handleSave}
              disabled={saving || session.needsReview || session.reading}
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
