"use client";

// features/natori/components/links/LinksEditor.tsx
// /natori/links の掲載リンクをブラウザから編集する画面。
// 追加・削除・ドラッグ並び替え・表示名/サブテキスト/URL の編集ができる。
import { natoriAdminUi } from "@/features/natori/constants/adminUi";
import { useNatoriConfirm } from "@/features/natori/components/admin/useNatoriConfirm";
import { NatoriSkeleton } from "@/features/natori/components/admin/NatoriSkeleton";
import { NatoriLoadError } from "@/features/natori/components/dashboard/NatoriLoadError";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ExternalLink, Loader2, Save } from "lucide-react";
import { CSRF_HEADERS } from "@/lib/auth/csrf";
import { LinkIcon } from "@/features/natori/components/links/LinksLanding";
import type { NatoriLinkItem, NatoriLinksContent } from "@/features/natori/types/links";
import {
  AddButton,
  RowControls,
  SectionCard,
  TextInput,
  removeItem,
  updateItem,
} from "../portfolio/edit/editorFields";
import SortableList from "../portfolio/edit/SortableList";

type SaveState = "idle" | "saving" | "saved" | "error";

/** 保存前の軽い整理: 前後スペースを除去し、表示名かURLが空の行は消す */
function sanitizeContent(content: NatoriLinksContent): NatoriLinksContent {
  return {
    links: content.links
      .map((link) => ({
        ...link,
        label: link.label.trim(),
        sub: link.sub.trim(),
        href: link.href.trim(),
      }))
      .filter((link) => link.label.length > 0 && link.href.length > 0),
  };
}

/** 表示名かURLが空の行は保存時に削除される（LNKE-01 の警告用） */
function isIncompleteLink(link: NatoriLinkItem): boolean {
  return link.label.trim().length === 0 || link.href.trim().length === 0;
}

/** URL 欄の形式の手がかり（表示のみ。保存は止めない） */
function hrefFormatError(href: string): string | undefined {
  const value = href.trim().toLowerCase();
  if (value.length === 0) return undefined;
  if (value.startsWith("https://") || value.startsWith("http://") || value.startsWith("/")) {
    return undefined;
  }
  return "https:// または / で始まるURLを入力してください";
}

type LinksEditorProps = {
  /**
   * エトリエのデモ環境用。渡すとサーバーへは一切アクセスせず、
   * 編集はローカル状態のみ・保存は成功をシミュレートする。
   */
  demoContent?: NatoriLinksContent;
  /** 「公開ページを見る」のリンク先（デモではデモ用公開ページへ） */
  publicHref?: string;
  /** タイトル左の「← ダッシュボード」のリンク先。未指定なら表示しない */
  dashboardHref?: string;
};

export default function LinksEditor({ demoContent, publicHref, dashboardHref }: LinksEditorProps) {
  const isDemo = Boolean(demoContent);
  const { confirm, confirmDialog } = useNatoriConfirm();
  const [content, setContent] = useState<NatoriLinksContent | null>(null);
  // 「変更を取り消す」で戻す先。読み込み時と保存成功時に更新する
  const [loadedContent, setLoadedContent] = useState<NatoriLinksContent | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (demoContent) {
      setContent(demoContent);
      setLoadedContent(demoContent);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/natori/links/content");
        if (!res.ok) throw new Error(`load failed: ${res.status}`);
        const json = (await res.json()) as { content: NatoriLinksContent };
        if (!cancelled) {
          setContent(json.content);
          setLoadedContent(json.content);
        }
      } catch (err) {
        console.error("[links-edit] load failed", err);
        if (!cancelled) setLoadError(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [demoContent]);

  // 未保存の変更がある状態でページを閉じようとしたら警告
  useEffect(() => {
    if (!dirty) return;
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  const patch = (links: NatoriLinksContent["links"]) => {
    setContent({ links });
    setDirty(true);
    setSaveState("idle");
  };

  const handleSave = async () => {
    if (!content || saveState === "saving") return;
    if (isDemo) {
      // デモ: 実保存せず成功表示だけする
      const sanitizedForDemo = sanitizeContent(content);
      setContent(sanitizedForDemo);
      setLoadedContent(sanitizedForDemo);
      setDirty(false);
      setSaveState("saved");
      return;
    }
    setSaveState("saving");
    try {
      const sanitized = sanitizeContent(content);
      const res = await fetch("/api/natori/links/content", {
        method: "PUT",
        headers: { ...CSRF_HEADERS, "Content-Type": "application/json" },
        body: JSON.stringify({ content: sanitized }),
      });
      if (!res.ok) throw new Error(`save failed: ${res.status}`);
      setContent(sanitized);
      setLoadedContent(sanitized);
      setDirty(false);
      setSaveState("saved");
    } catch (err) {
      console.error("[links-edit] save failed", err);
      setSaveState("error");
    }
  };

  const handleDiscard = async () => {
    if (!loadedContent) return;
    const confirmed = await confirm({
      title: "変更を取り消しますか？",
      description: "保存していない変更をすべて破棄して、最後に読み込んだ（保存した）内容に戻します。",
      confirmLabel: "変更を取り消す",
      tone: "danger",
    });
    if (!confirmed) return;
    setContent(loadedContent);
    setDirty(false);
    setSaveState("idle");
  };

  if (loadError) {
    return (
      <main data-natori-admin className="grid min-h-screen place-items-center bg-[#F7F7F8] px-4">
        <div className="w-full max-w-md">
          <NatoriLoadError
            resourceLabel="リンク内容"
            error="サーバーから内容を取得できませんでした。"
            onRetry={() => window.location.reload()}
          />
        </div>
      </main>
    );
  }

  if (!content) {
    return (
      <main data-natori-admin className="grid min-h-screen place-items-center bg-[#F7F7F8] px-4">
        <div className="w-full max-w-md space-y-3">
          <p role="status" className={natoriAdminUi.caption}>
            読み込んでいます
          </p>
          <NatoriSkeleton heightClassName="h-12" />
          <NatoriSkeleton heightClassName="h-64" />
        </div>
      </main>
    );
  }

  const incompleteCount = content.links.filter(isIncompleteLink).length;

  return (
    <main data-natori-admin className="min-h-screen bg-[#F7F7F8] pb-28">
      {confirmDialog}
      {/* 上部バー */}
      <div className="sticky top-0 z-40 border-b border-zinc-200/80 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3">
          {dashboardHref ? (
            <Link href={dashboardHref} className={natoriAdminUi.btnLink}>
              ← ダッシュボード
            </Link>
          ) : null}
          <h1 className="min-w-0 text-lg font-bold tracking-tight text-zinc-900">リンク集編集</h1>
          <div className="ml-auto flex items-center gap-2">
            <Link
              href={publicHref ?? "/natori/links"}
              target="_blank"
              className={natoriAdminUi.btnSecondary}
            >
              <ExternalLink className="h-4 w-4" aria-hidden />
              公開ページを見る
            </Link>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-3xl space-y-5 px-4 pt-5">
        <p className="rounded-xl bg-sky-50 px-4 py-3 text-xs leading-5 text-sky-900 ring-1 ring-inset ring-sky-600/15">
          ここで編集した内容は、下の「保存する」ボタンを押すとすぐに公開ページ（ /natori/links ）に反映されます。
          アイコンはリンク先のURLから自動で決まり、判定できないサービスは表示名の頭文字が使われます。
        </p>

        <SectionCard
          emoji="🔗"
          title="掲載リンク"
          description="上から順に表示されます。サイト内ページは「/natori/portfolio」のように「/」始まりで書くと同じタブで開きます。"
        >
          <SortableList
            items={content.links}
            getId={(link) => link.id}
            onReorder={(next) => patch(next)}
            className="space-y-3"
            renderRow={(link, index, handle) => {
              const hasContent = link.label.trim().length > 0 || link.href.trim().length > 0;
              return (
                <div className="rounded-xl border border-zinc-200/80 bg-zinc-50/60 p-3 sm:p-4">
                  {isIncompleteLink(link) ? (
                    <p className={`${natoriAdminUi.alert.warning} mb-3`}>
                      表示名とURLの両方が入っていない行は、保存時に削除されます
                    </p>
                  ) : null}
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className={natoriAdminUi.iconTile}>
                        <LinkIcon link={link} />
                      </span>
                      <p className="text-xs font-semibold text-zinc-600">リンク {index + 1}</p>
                    </div>
                    <RowControls
                      handle={handle}
                      confirmMessage={
                        hasContent
                          ? `「${link.label.trim() || link.href.trim()}」を削除しますか？（保存するまで公開ページは変わりません）`
                          : undefined
                      }
                      onRemove={() => patch(removeItem(content.links, index))}
                    />
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <TextInput
                      label="表示名"
                      value={link.label}
                      onChange={(v) => patch(updateItem(content.links, index, { label: v }))}
                      placeholder="例: X（Twitter）"
                    />
                    <TextInput
                      label="サブテキスト（任意）"
                      value={link.sub}
                      onChange={(v) => patch(updateItem(content.links, index, { sub: v }))}
                      placeholder="例: @account_id"
                    />
                  </div>
                  <div className="mt-3">
                    <TextInput
                      label="リンク先URL"
                      value={link.href}
                      onChange={(v) => patch(updateItem(content.links, index, { href: v }))}
                      placeholder="https://... または /natori/portfolio"
                      inputMode="url"
                      error={hrefFormatError(link.href)}
                    />
                  </div>
                </div>
              );
            }}
          />
          <AddButton
            label="リンクを追加"
            onClick={() =>
              patch([
                ...content.links,
                { id: crypto.randomUUID(), label: "", sub: "", href: "" },
              ])
            }
          />
        </SectionCard>
      </div>

      {/* 保存バー（画面下に固定） */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-zinc-200/80 bg-white/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center gap-3 px-4 py-3">
          <div className="min-w-0 text-xs font-semibold" aria-live="polite">
            {saveState === "saved" ? (
              <span className="text-emerald-700">
                {isDemo
                  ? "保存しました（デモのため実際には反映されません）。"
                  : "保存しました！公開ページに反映されています。"}
              </span>
            ) : saveState === "error" ? (
              <span className="text-red-700">保存に失敗しました。もう一度お試しください。</span>
            ) : dirty ? (
              <span className="text-amber-700">未保存の変更があります</span>
            ) : (
              <span className="text-zinc-600">変更はありません</span>
            )}
            {incompleteCount > 0 ? (
              <span className="ml-3 text-amber-700">
                {incompleteCount}件の未完成の行は保存されません
              </span>
            ) : null}
          </div>
          {dirty ? (
            <button
              type="button"
              onClick={() => void handleDiscard()}
              disabled={saveState === "saving"}
              className={`${natoriAdminUi.btnSecondary} ml-auto`}
            >
              変更を取り消す
            </button>
          ) : null}
          <button
            type="button"
            onClick={handleSave}
            disabled={saveState === "saving" || !dirty}
            className={`${natoriAdminUi.btnPrimary} ${dirty ? "" : "ml-auto"}`}
          >
            {saveState === "saving" ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <Save className="h-4 w-4" aria-hidden />
            )}
            {saveState === "saving" ? "保存中…" : "保存する"}
          </button>
        </div>
      </div>
    </main>
  );
}
