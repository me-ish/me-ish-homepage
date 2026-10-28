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
            setError("設定を読み込めませんでした。ログインが切れていないか見てください。");
          }
        });
    const { data } = createClient().auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT" && live) {
        reject();
        setError(
          "ログインが切れました。もう一度ログインしてください。",
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
        mode === "settings" ? "設定" : "ざっくり見積"
      }
      className="rounded-2xl border border-zinc-200 bg-white p-4 sm:p-6"
    >
      <h1 className="text-xl font-semibold">
        {mode === "settings" ? "設定" : "ざっくり見積"}
      </h1>
      {mode === "estimate" ? (
        <>
          <p className="my-3 text-sm">
            案件にする前に、金額の目安を出せます。お客さんには送られません。
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
            下のページは別のタブで開きます。
          </p>
          <nav
            aria-label="ほかのページ"
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
              </a> : <span key={l.href}>{l.label}：URLが正しくありません</span>;
            })}
          </nav>
          <PageEventsPanel showUnavailable onAccessRejected={reject}/>
          <button
            className={`${ui.btnSecondary} mt-4`}
            disabled={busy}
            onClick={() => {
              if (
                !window.confirm(
                  "ログアウトしますか？",
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
                    "ログアウトしました。",
                  );
                })
                .catch(() =>
                  setError(
                    "ログアウトできたか分かりません。ページを読み込み直してください。",
                  ),
                )
                .finally(() => setBusy(false));
            }}
          >
            ログアウト
          </button>
        </>
      )}
    </section>
  );
}
