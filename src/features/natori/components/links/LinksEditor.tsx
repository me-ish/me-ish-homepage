"use client";

// features/natori/components/links/LinksEditor.tsx
// /natori/links の掲載リンクをブラウザから編集する画面。
// 追加・削除・ドラッグ並び替え・表示名/サブテキスト/URL の編集ができる。
import { useEffect, useState } from "react";
import Link from "next/link";
import { ExternalLink, Loader2, Save } from "lucide-react";
import { CSRF_HEADERS } from "@/lib/auth/csrf";
import type { NatoriLinksContent } from "@/features/natori/types/links";
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

export default function LinksEditor() {
  const [content, setContent] = useState<NatoriLinksContent | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/natori/links/content");
        if (!res.ok) throw new Error(`load failed: ${res.status}`);
        const json = (await res.json()) as { content: NatoriLinksContent };
        if (!cancelled) setContent(json.content);
      } catch (err) {
        console.error("[links-edit] load failed", err);
        if (!cancelled) setLoadError(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

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
      setDirty(false);
      setSaveState("saved");
    } catch (err) {
      console.error("[links-edit] save failed", err);
      setSaveState("error");
    }
  };

  if (loadError) {
    return (
      <main className="grid min-h-screen place-items-center bg-pink-50/50 px-4">
        <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
          読み込みに失敗しました。ページを再読み込みしてください。
        </p>
      </main>
    );
  }

  if (!content) {
    return (
      <main className="grid min-h-screen place-items-center bg-pink-50/50">
        <p className="flex items-center gap-2 text-sm font-bold text-gray-600">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          読み込み中…
        </p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-pink-50/70 via-white to-white pb-28">
      {/* 上部バー */}
      <div className="sticky top-0 z-40 border-b border-pink-100 bg-white/85 backdrop-blur">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center gap-2 px-4 py-3">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-pink-600">
              Links Editor
            </p>
            <h1 className="text-lg font-black text-gray-900">リンク集編集</h1>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Link
              href="/natori/links"
              target="_blank"
              className="inline-flex items-center gap-1.5 rounded-full border border-gray-300 bg-white px-4 py-2 text-xs font-bold text-gray-800 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-pink-300"
            >
              <ExternalLink className="h-3.5 w-3.5" aria-hidden />
              公開ページを見る
            </Link>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-3xl space-y-5 px-4 pt-5">
        <p className="rounded-2xl border border-sky-100 bg-sky-50 px-4 py-3 text-xs leading-5 text-sky-900">
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
            renderRow={(link, index, handle) => (
              <div className="rounded-xl border border-pink-100 bg-pink-50/40 p-3">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <p className="text-xs font-bold text-pink-700">リンク {index + 1}</p>
                  <RowControls
                    handle={handle}
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
                    placeholder="例: @natonato_o"
                  />
                </div>
                <div className="mt-3">
                  <TextInput
                    label="リンク先URL"
                    value={link.href}
                    onChange={(v) => patch(updateItem(content.links, index, { href: v }))}
                    placeholder="https://... または /natori/portfolio"
                  />
                </div>
              </div>
            )}
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
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-pink-100 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center gap-3 px-4 py-3">
          <div className="min-w-0 text-xs font-bold">
            {saveState === "saved" ? (
              <span className="text-emerald-600">保存しました！公開ページに反映されています。</span>
            ) : saveState === "error" ? (
              <span className="text-red-600">保存に失敗しました。もう一度お試しください。</span>
            ) : dirty ? (
              <span className="text-amber-600">未保存の変更があります</span>
            ) : (
              <span className="text-gray-400">変更はありません</span>
            )}
          </div>
          <button
            type="button"
            onClick={handleSave}
            disabled={saveState === "saving" || !dirty}
            className="ml-auto inline-flex items-center gap-2 rounded-full bg-pink-500 px-6 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-pink-600 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-pink-300"
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
