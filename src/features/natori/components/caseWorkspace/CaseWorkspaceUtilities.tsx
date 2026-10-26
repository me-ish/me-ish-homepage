"use client";
import {CaseSystemControl} from "./CaseSystemControl";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  fetchOwnNatoriProfile,
  NatoriProfileLoadError,
  type NatoriUserProfile,
} from "../../data/supabaseProfile";
import { ProfileSettingsPanel } from "../dashboard/NatoriDashboardLegacy";
import PageEventsPanel from "../dashboard/PageEventsPanel";
import EstimateForm from "../dashboard/EstimateForm";
import { createClient } from "@/lib/supabase/client";
import { NATORI_PUBLIC_PAGE_LINKS } from "../admin/navItems";
import { natoriAdminUi as ui } from "../../constants/adminUi";
import { CasePublicPages } from "./CasePublicPages";
function publicPageHref(fallback: string, profile: NatoriUserProfile | null) {
  const raw = (fallback === "/natori/portfolio" ? profile?.portfolioUrl :
    fallback === "/natori/links" ? profile?.linksUrl : null)?.trim();
  if (!raw) return fallback;
  try {
    if (raw.startsWith("//") || raw.includes("\\")) return null;
    const url = new URL(raw, "https://profile-link.invalid");
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) return null;
    return url.origin === "https://profile-link.invalid" ? `${url.pathname}${url.search}${url.hash}` : url.href;
  } catch { return null; }
}
export function CaseWorkspaceUtilities({
  mode,
  readOnly,
  onDraftChange,
  onAccessRejected,
}: {
  mode: "settings" | "estimate" | "pages";
  readOnly: boolean;
  onDraftChange: (v: boolean) => void;
  onAccessRejected: () => void;
}) {
  const [profile, setProfile] = useState<NatoriUserProfile | null>(null),
    [ready, setReady] = useState(false),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const rejected = useRef(onAccessRejected),
    authEpoch = useRef(0);
  rejected.current = onAccessRejected;
  const reject = useCallback(() => {
    authEpoch.current++;
    setProfile(null);
    setReady(false);
    rejected.current();
  }, []);
  useEffect(() => {
    let live = true;
    const epoch = authEpoch.current;
    if (mode === "settings" || mode === "pages")
      void fetchOwnNatoriProfile()
        .then((p) => {
          if (live && epoch === authEpoch.current) {
            setProfile(p);
            setReady(true);
          }
        })
        .catch((e) => {
          if (live && epoch === authEpoch.current) {
            setProfile(null);
            if (e instanceof NatoriProfileLoadError && e.status === 401)
              reject();
            setError("設定を取得できません。ログイン状態を確認してください。");
          }
        });
    const { data } = createClient().auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT" && live) {
        reject();
        setError(
          "ログインセッションが終了しました。管理キーによる認可は別です。画面を再取得して確認してください。",
        );
      }
    });
    return () => {
      live = false;
      data.subscription.unsubscribe();
    };
  }, [mode, reject]);
  if (mode === "pages")
    return (
      <section aria-label="公開ページ">
        <h1 className="text-xl font-semibold">公開ページ</h1>
        <p className="mb-4 mt-1 text-sm text-zinc-600">お客さんが見るページです。</p>
        {error ? <p role="alert" className="mb-3 text-sm text-amber-900">{error}</p> : null}
        <CasePublicPages
          portfolioHref={publicPageHref("/natori/portfolio", profile)}
          linksHref={publicPageHref("/natori/links", profile)}
        />
      </section>
    );
  return (
    <section
      aria-label={
        mode === "settings" ? "設定と既存の管理機能" : "案件未登録の概算ツール"
      }
      className="rounded-2xl border border-zinc-200 bg-white p-4 sm:p-6"
    >
      <h1 className="text-xl font-semibold">
        {mode === "settings"
          ? "設定と既存の管理機能"
          : "案件未登録の概算ツール"}
      </h1>
      {mode === "estimate" ? (
        <>
          <p className="my-3 text-sm">
            概算の下書きです。正式な提示・送信・承諾は、登録した案件内で確認します。
          </p>
          <EstimateForm
            workspaceOnly
            readOnly={readOnly}
            onDraftChange={onDraftChange}
            onAccessRejected={reject}
          />
        </>
      ) : (
        <>
          <CaseSystemControl onAccessRejected={reject}/>
          {error ? <p role="alert">{error}</p> : null}
          {ready ? (
            <ProfileSettingsPanel
              profile={profile}
              onSaved={setProfile}
              onDraftChange={onDraftChange}
              onAccessRejected={reject}
              readOnly={readOnly}
              validateLinks
            />
          ) : null}
          <p className="mt-4 text-sm">
            次の管理画面は別タブで開きます。このタブの案件・絞り込み・選択を残して戻れます。
          </p>
          <nav
            aria-label="既存の公開管理"
            className="my-4 flex flex-wrap gap-4"
          >
            <a
              href="/natori/results"
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
            >
              実績
            </a>
            {NATORI_PUBLIC_PAGE_LINKS.map((l) => {
              const href = publicPageHref(l.href, profile);
              return href ? <a
                key={l.href}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="underline"
              >
                {l.label}
              </a> : <span key={l.href}>{l.label}：保存済みURLを確認してください</span>;
            })}
          </nav>
          <PageEventsPanel showUnavailable onAccessRejected={reject}/>
          <button
            className={`${ui.btnSecondary} mt-4`}
            disabled={busy}
            onClick={() => {
              if (
                !window.confirm(
                  "ログインセッションを終了しますか？ 合言葉キーによるアクセスは別です。",
                )
              )
                return;
              setBusy(true);
              void createClient()
                .auth.signOut()
                .then(({ error }) => {
                  if (error) throw error;
                  setProfile(null);
                  setReady(false);
                  setError(
                    "ログインセッションを終了しました。共有キーがある場合の管理アクセスは継続します。",
                  );
                })
                .catch(() =>
                  setError(
                    "セッション終了を確認できません。認証状態を再確認してください。",
                  ),
                )
                .finally(() => setBusy(false));
            }}
          >
            ログインセッションを終了
          </button>
          <p className="mt-2 text-xs">
            共有キーの失効・管理権限の変更を行う操作ではありません。
          </p>
        </>
      )}
    </section>
  );
}
