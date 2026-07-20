// src/components/aura/AuraPreviewEditorClient.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { Content } from "@/lib/aura/aura.schema";

type Section = {
  type: string;
  headings?: string[];
  paragraphs?: string[];
  items?: Record<string, unknown>[];
  cta?: { label?: string; href?: string };
};

type Props = {
  requestId: string;

  /** ★編集中のContent（Shellが唯一保持する） */
  draftContent: Content;

  /** ★編集結果をShellへ返す（即時同期） */
  onDraftContentChange: (next: Content) => void;

  /** ★現在のセクション順（Shellが唯一保持する） */
  sectionOrder: string[];
};

/* ---------------- helpers ---------------- */

function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

function getSection(content: Content, type: string) {
  return content.sections.find((s) => s.type === type);
}

/**
 * UI入力値を content に反映
 * - CTA は廃止
 * - Contact のみ残す
 */
function patchContent(params: {
  base: Content;
  heroTitle: string;
  heroSubtitle: string;
  aboutText: string;
  contactLabel: string;
}): Content {
  const { base, heroTitle, heroSubtitle, aboutText, contactLabel } = params;

  const next = deepClone(base);

  const patch = (type: string, fn: (s: Section) => void) => {
    const s = next.sections.find((sec) => sec.type === type);
    if (s) fn(s);
  };

  patch("hero", (s) => {
    s.headings = [heroTitle];
    s.paragraphs = [heroSubtitle];
  });

  patch("about", (s) => {
    s.paragraphs = [aboutText];
  });

  patch("contact", (s) => {
    s.cta = {
      href: "/contact",
      label: contactLabel || "お問い合わせ",
    };
  });

  return next;
}

/**
 * X 共有文（固定1パターン）
 * - 公開者目線の「営業・実績」寄り
 * - AI文言はデフォルトでは出さない
 */
// [AURA_SHARE_V1]
const AURA_SHARE_HASHTAG = "#meishAURA";

// [AURA_SHARE_V1]
function buildShareText(opts?: { heroTitle?: string; includeAI?: boolean }) {
  const hero = (opts?.heroTitle ?? "").trim();
  const aiNote = opts?.includeAI ? "（一部、制作支援ツールを活用しています）" : "";

  const line1 = "ポートフォリオを公開しました。";
  const line2 = "お仕事のご相談・ご依頼はお気軽にどうぞ。";
  const line3 = AURA_SHARE_HASHTAG;

  return [line1, line2, line3, aiNote,].filter(Boolean).join("\n");
}

/* public_slug utils */
const RESERVED_SLUGS = new Set([
  "p",
  "api",
  "admin",
  "login",
  "logout",
  "signup",
  "auth",
  "assets",
  "static",
  "favicon",
  "robots",
  "sitemap",
]);

function normalizePublicSlug(raw: string) {
  return (raw ?? "")
    .trim()
    .toLowerCase()
    .replace(/[_\s]+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-+/, "")
    .replace(/-+$/, "")
    .slice(0, 32);
}

function validatePublicSlug(slug: string): { ok: boolean; reason?: string } {
  if (!slug) return { ok: false, reason: "未入力です。" };
  if (slug.length < 3) return { ok: false, reason: "3文字以上にしてください。" };
  if (slug.length > 32) return { ok: false, reason: "32文字以内にしてください。" };
  if (!/^[a-z0-9-]+$/.test(slug)) {
    return { ok: false, reason: "小文字英数字とハイフンのみ使用できます。" };
  }
  if (slug.startsWith("-") || slug.endsWith("-")) {
    return { ok: false, reason: "先頭・末尾にハイフンは使えません。" };
  }
  if (RESERVED_SLUGS.has(slug)) {
    return { ok: false, reason: "この文字列は予約されています。" };
  }
  return { ok: true };
}

/* ---------------- component ---------------- */

export default function AuraPreviewEditorClient({
  requestId,
  draftContent,
  onDraftContentChange,
  sectionOrder,
}: Props) {
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  // 公開後UI
  const [publishedUrl, setPublishedUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // 公開識別子（URL組み立て用）
  const [publishedPublicId, setPublishedPublicId] = useState<string | null>(null);
  const [publishedPublicSlug, setPublishedPublicSlug] = useState<string | null>(null);

  // public_slug 編集UI
  const [slugDraft, setSlugDraft] = useState("");
  const [slugStatus, setSlugStatus] = useState<
    null | {
      type: "idle" | "checking" | "available" | "unavailable" | "saved" | "error";
      msg?: string;
    }
  >(null);
  const [slugSaving, setSlugSaving] = useState(false);

  /* ---------- 初期値 ---------- */

  const initial = useMemo(() => {
    const hero = getSection(draftContent, "hero");
    const about = getSection(draftContent, "about");
    const contact = getSection(draftContent, "contact");

    return {
      heroTitle: hero?.headings?.[0] ?? "",
      heroSubtitle: hero?.paragraphs?.[0] ?? "",
      aboutText: about?.paragraphs?.[0] ?? "",
      contactLabel: (contact as any)?.cta?.label ?? "お問い合わせ",
    };
  }, [draftContent]);

  const [heroTitle, setHeroTitle] = useState(initial.heroTitle);
  const [heroSubtitle, setHeroSubtitle] = useState(initial.heroSubtitle);
  const [aboutText, setAboutText] = useState(initial.aboutText);
  const [contactLabel, setContactLabel] = useState(initial.contactLabel);

  /* ---------- 同期 ---------- */

  useEffect(() => {
    setHeroTitle(initial.heroTitle);
    setHeroSubtitle(initial.heroSubtitle);
    setAboutText(initial.aboutText);
    setContactLabel(initial.contactLabel);

    setPublishedUrl(null);
    setPublishedPublicId(null);
    setPublishedPublicSlug(null);

    setCopied(false);

    setSlugDraft("");
    setSlugStatus(null);
    setSlugSaving(false);
  }, [initial]);

  useEffect(() => {
    const next = patchContent({
      base: draftContent,
      heroTitle,
      heroSubtitle,
      aboutText,
      contactLabel,
    });
    onDraftContentChange(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [heroTitle, heroSubtitle, aboutText, contactLabel]);

  /* ---------- utils ---------- */

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      window.prompt("このURLをコピーしてください", text);
    }
  };

  // [AURA_SHARE_V1]
  const openXShare = (url: string) => {
    const text = buildShareText({
      heroTitle,
      includeAI: false, // デフォルトはAI文言なし
    });

    const shareUrl =
      "https://twitter.com/intent/tweet?" + new URLSearchParams({ text, url }).toString();
    window.open(shareUrl, "_blank", "noopener,noreferrer");
  };

  const buildPublicUrl = (publicId: string | null, publicSlug: string | null) => {
    const base = window.location.origin;
    if (publicSlug && publicSlug.trim()) return `${base}/aura/p/${publicSlug.trim()}`;
    if (publicId && publicId.trim()) return `${base}/aura/p/${publicId.trim()}`;
    return null;
  };

  /* ---------- save ---------- */

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);

    const next = patchContent({
      base: draftContent,
      heroTitle,
      heroSubtitle,
      aboutText,
      contactLabel,
    });

    try {
      const res = await fetch(`/api/aura/save/${requestId}`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-requested-with": "me-ish" },
        body: JSON.stringify({
          content: next,
          sectionOrder,
        }),
      });

      // ✅ 支払い要求（サーバーが checkoutUrl を返す想定）
      if (res.status === 402) {
        const j = await res.json().catch(() => null);
        const url = (j?.checkoutUrl as string | undefined) ?? null;

        if (url) {
          window.location.href = url;
          return;
        }

        setMessage("お支払いが必要です。");
        setSaving(false);
        return;
      }

      if (!res.ok) {
        setMessage("保存に失敗しました。時間をおいて再度お試しください。");
        setSaving(false);
        return;
      }

      const json = await res.json().catch(() => null);

      // ✅ publicSlug が無くても publicId で確実に開ける
      if (json?.ok && (json.publicId || json.publicSlug)) {
        const pid = (json.publicId as string | undefined) ?? null;
        const pslug = (json.publicSlug as string | undefined) ?? null;

        setPublishedPublicId(pid);
        setPublishedPublicSlug(pslug);

        const url = buildPublicUrl(pid, pslug);
        setPublishedUrl(url);

        // slugDraft 初期反映（slugがあるなら入力欄に入れる）
        setSlugDraft(pslug ?? "");
        setSlugStatus(null);

        setMessage("公開が完了しました。");
        setSaving(false);
        return;
      }

      setMessage("公開URLの取得に失敗しました。");
      setSaving(false);
    } catch (e) {
      console.error(e);
      setMessage("通信エラーが発生しました。");
      setSaving(false);
    }
  };

  /* ---------- public_slug actions ---------- */

  const handleCheckSlug = async () => {
    if (!publishedPublicId) {
      setSlugStatus({ type: "error", msg: "公開後に設定できます。" });
      return;
    }

    const normalized = normalizePublicSlug(slugDraft);
    setSlugDraft(normalized);

    const v = validatePublicSlug(normalized);
    if (!v.ok) {
      setSlugStatus({ type: "unavailable", msg: v.reason });
      return;
    }

    setSlugStatus({ type: "checking", msg: "確認中..." });

    try {
      const res = await fetch(`/api/aura/public-slug`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-requested-with": "me-ish" },
        body: JSON.stringify({
          requestId,
          mode: "check",
          publicSlug: normalized,
        }),
      });

      const json = await res.json().catch(() => null);

      if (!res.ok || !json?.ok) {
        setSlugStatus({
          type: "error",
          msg: json?.message ?? "確認に失敗しました。",
        });
        return;
      }

      if (json.available === true) {
        setSlugStatus({ type: "available", msg: "使用できます。" });
      } else {
        setSlugStatus({ type: "unavailable", msg: "既に使用されています。" });
      }
    } catch {
      setSlugStatus({ type: "error", msg: "通信エラーが発生しました。" });
    }
  };

  const handleSaveSlug = async () => {
    if (!publishedPublicId) {
      setSlugStatus({ type: "error", msg: "公開後に設定できます。" });
      return;
    }

    const normalized = normalizePublicSlug(slugDraft);
    setSlugDraft(normalized);

    const v = validatePublicSlug(normalized);
    if (!v.ok) {
      setSlugStatus({ type: "unavailable", msg: v.reason });
      return;
    }

    setSlugSaving(true);
    setSlugStatus({ type: "checking", msg: "保存中..." });

    try {
      const res = await fetch(`/api/aura/public-slug`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-requested-with": "me-ish" },
        body: JSON.stringify({
          requestId,
          mode: "save",
          publicSlug: normalized,
        }),
      });

      const json = await res.json().catch(() => null);

      if (!res.ok || !json?.ok) {
        setSlugSaving(false);
        setSlugStatus({
          type: "error",
          msg: json?.message ?? "保存に失敗しました。",
        });
        return;
      }

      // 反映
      const newSlug = (json.publicSlug as string | undefined) ?? normalized;
      setPublishedPublicSlug(newSlug);

      const url = buildPublicUrl(publishedPublicId, newSlug);
      setPublishedUrl(url);
      setSlugStatus({ type: "saved", msg: "保存しました。" });
      setSlugSaving(false);
    } catch {
      setSlugSaving(false);
      setSlugStatus({ type: "error", msg: "通信エラーが発生しました。" });
    }
  };

  /* ---------- render ---------- */

  return (
    <section className="mt-8 rounded-lg border p-6">
      <h2 className="text-lg font-medium">テキストを調整する</h2>
      <p className="mt-1 text-sm text-gray-600">
        入力はプレビューに即反映されます。最後に「この内容で確定して公開」を押してください。
      </p>

      <div className="mt-6 grid gap-4">
        <label className="grid gap-1">
          <span className="text-sm font-medium">ヒーロー見出し</span>
          <input
            className="rounded border px-3 py-2 text-sm"
            value={heroTitle}
            onChange={(e) => setHeroTitle(e.target.value)}
          />
        </label>

        <label className="grid gap-1">
          <span className="text-sm font-medium">ヒーローサブテキスト</span>
          <textarea
            className="min-h-[72px] rounded border px-3 py-2 text-sm"
            value={heroSubtitle}
            onChange={(e) => setHeroSubtitle(e.target.value)}
          />
        </label>

        <label className="grid gap-1">
          <span className="text-sm font-medium">自己紹介（About）</span>
          <textarea
            className="min-h-[120px] rounded border px-3 py-2 text-sm"
            value={aboutText}
            onChange={(e) => setAboutText(e.target.value)}
          />
        </label>
      </div>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="rounded bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {saving ? "保存中..." : "この内容で確定して公開"}
        </button>
        {message && <p className="text-sm text-red-600">{message}</p>}
      </div>

      {/* -------- 公開後 -------- */}
      {publishedUrl && (
        <div className="mt-6 rounded-lg border bg-white p-5">
          <p className="text-sm font-medium">公開URL</p>
          <p className="text-xs text-gray-600">このURLがあなたのポートフォリオです。</p>

          <div className="mt-3 flex flex-col gap-3 sm:flex-row">
            <input readOnly value={publishedUrl} className="w-full rounded border px-3 py-2 text-sm" />
            <button onClick={() => copyToClipboard(publishedUrl)} className="rounded border px-4 py-2 text-sm">
              コピー
            </button>
            <button
              onClick={() => window.open(publishedUrl, "_blank")}
              className="rounded bg-black px-4 py-2 text-sm text-white"
            >
              開く
            </button>
          </div>

          {copied && <p className="mt-2 text-xs text-gray-600">コピーしました。</p>}

          {/* public_slug 編集 */}
          <div className="mt-5 border-t pt-4">
            <p className="text-sm font-medium">公開アドレスをカスタム</p>
            <p className="mt-1 text-xs text-gray-600">
              例: <span className="font-mono">my-portfolio</span> →{" "}
              <span className="font-mono">/aura/p/my-portfolio</span>
              （小文字英数字とハイフン、3〜32文字）
            </p>

            <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="flex w-full items-center gap-2">
                <span className="text-xs text-gray-500 font-mono">/aura/p/</span>
                <input
                  value={slugDraft}
                  onChange={(e) => {
                    setSlugDraft(e.target.value);
                    setSlugStatus(null);
                  }}
                  placeholder="my-portfolio"
                  className="w-full rounded border px-3 py-2 text-sm font-mono"
                />
              </div>

              <div className="flex gap-2">
                <button type="button" onClick={handleCheckSlug} className="rounded border px-4 py-2 text-sm">
                  使えるか確認
                </button>
                <button
                  type="button"
                  onClick={handleSaveSlug}
                  disabled={slugSaving}
                  className="rounded bg-black px-4 py-2 text-sm text-white disabled:opacity-60"
                >
                  {slugSaving ? "保存中..." : "保存"}
                </button>
              </div>
            </div>

            {slugStatus?.msg && (
              <p
                className={`mt-2 text-xs ${
                  slugStatus.type === "available" || slugStatus.type === "saved"
                    ? "text-green-700"
                    : slugStatus.type === "checking"
                      ? "text-gray-600"
                      : "text-red-600"
                }`}
              >
                {slugStatus.msg}
              </p>
            )}
          </div>

          {/* [AURA_SHARE_V1] */}
          <div className="mt-5 border-t pt-4">
            <p className="text-sm font-medium">SNSで共有</p>
            <div className="mt-3">
              <button onClick={() => openXShare(publishedUrl)} className="rounded border px-4 py-2 text-sm">
                Xで共有
              </button>
            </div>
          </div>

          <div className="mt-5 border-t pt-4 flex justify-between items-center">
            <p className="text-xs text-gray-600">困ったら me-ish に相談できます。</p>
            <Link href="/contact" className="text-sm underline">
              お問い合わせへ
            </Link>
          </div>
        </div>
      )}
    </section>
  );
}
