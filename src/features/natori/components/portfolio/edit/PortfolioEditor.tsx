"use client";

// features/natori/components/portfolio/edit/PortfolioEditor.tsx
// /natori/portfolio の掲載内容をブラウザから編集する画面。
// コードを触らずに、文章・料金・作品画像・SNSリンクをすべて変更できる。
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ExternalLink, Loader2, Save } from "lucide-react";
import { CSRF_HEADERS } from "@/lib/auth/csrf";
import type { PortfolioContent } from "@/features/natori/types/portfolio";
import {
  AddButton,
  ImageUploadField,
  RowControls,
  SectionCard,
  TextArea,
  TextInput,
  moveItem,
  removeItem,
  updateItem,
} from "./editorFields";

type SaveState = "idle" | "saving" | "saved" | "error";

/** 保存前の軽い整理（空行・前後スペースを除去。空になった行は消す） */
function sanitizeContent(content: PortfolioContent): PortfolioContent {
  const cleanList = (items: string[]) =>
    items.map((item) => item.trim()).filter((item) => item.length > 0);
  return {
    ...content,
    aboutParagraphs: cleanList(content.aboutParagraphs),
    services: cleanList(content.services),
    requests: cleanList(content.requests),
    works: content.works.map((work) => ({ ...work, title: work.title.trim(), tags: cleanList(work.tags) })),
    plans: content.plans.map((plan) => ({ ...plan, features: cleanList(plan.features) })),
    socialLinks: content.socialLinks.filter(
      (link) => link.label.trim().length > 0 && link.href.trim().length > 0
    ),
  };
}

export default function PortfolioEditor() {
  const [content, setContent] = useState<PortfolioContent | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/natori/portfolio/content");
        if (!res.ok) throw new Error(`load failed: ${res.status}`);
        const json = (await res.json()) as { content: PortfolioContent };
        if (!cancelled) setContent(json.content);
      } catch (err) {
        console.error("[portfolio-edit] load failed", err);
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

  const patch = useCallback((update: Partial<PortfolioContent>) => {
    setContent((current) => (current ? { ...current, ...update } : current));
    setDirty(true);
    setSaveState("idle");
  }, []);

  const handleSave = async () => {
    if (!content || saveState === "saving") return;
    setSaveState("saving");
    try {
      const sanitized = sanitizeContent(content);
      const res = await fetch("/api/natori/portfolio/content", {
        method: "PUT",
        headers: { ...CSRF_HEADERS, "Content-Type": "application/json" },
        body: JSON.stringify({ content: sanitized }),
      });
      if (!res.ok) throw new Error(`save failed: ${res.status}`);
      setContent(sanitized);
      setDirty(false);
      setSaveState("saved");
    } catch (err) {
      console.error("[portfolio-edit] save failed", err);
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
              Portfolio Editor
            </p>
            <h1 className="text-lg font-black text-gray-900">ポートフォリオ編集</h1>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Link
              href="/natori/portfolio"
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
          ここで編集した内容は、下の「保存する」ボタンを押すとすぐに公開ページ（
          /natori/portfolio ）に反映されます。保存するまでは公開されないので、安心して
          書き換えてOKです。
        </p>

        {/* 受付状態 */}
        <SectionCard
          emoji="🚪"
          title="受付状態"
          description="コミッションの受付中・停止中を切り替えます。停止中はフォームから送信できなくなります。"
        >
          <div className="flex gap-2">
            {[
              { value: true, label: "● 受付中", active: "bg-emerald-500 text-white border-emerald-500" },
              { value: false, label: "受付停止中", active: "bg-gray-700 text-white border-gray-700" },
            ].map((choice) => (
              <button
                key={String(choice.value)}
                type="button"
                onClick={() => patch({ commissionOpen: choice.value })}
                className={`rounded-full border px-5 py-2 text-sm font-bold transition focus:outline-none focus:ring-2 focus:ring-pink-300 ${
                  content.commissionOpen === choice.value
                    ? choice.active
                    : "border-gray-200 bg-white text-gray-500 hover:bg-gray-50"
                }`}
              >
                {choice.label}
              </button>
            ))}
          </div>
        </SectionCard>

        {/* 基本情報 */}
        <SectionCard
          emoji="✏️"
          title="基本情報・キャッチコピー"
          description="ページ最上部に表示される内容です。"
        >
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <TextInput
                label="サイト名（ヘッダーのロゴ部分）"
                value={content.artistName}
                onChange={(v) => patch({ artistName: v })}
              />
              <TextInput
                label="英字の肩書き"
                value={content.roleEn}
                onChange={(v) => patch({ roleEn: v })}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <TextInput
                label="キャッチコピー（ピンク色になる部分）"
                value={content.heroTitleAccent}
                onChange={(v) => patch({ heroTitleAccent: v })}
              />
              <TextInput
                label="キャッチコピー（続き）"
                value={content.heroTitleTail}
                onChange={(v) => patch({ heroTitleTail: v })}
              />
            </div>
            <TextArea
              label="トップの紹介文"
              value={content.heroDescription}
              onChange={(v) => patch({ heroDescription: v })}
              rows={3}
            />
            <TextInput
              label="コピーライト表記（ページ最下部）"
              value={content.copyright}
              onChange={(v) => patch({ copyright: v })}
            />
          </div>
        </SectionCard>

        {/* 画像 */}
        <SectionCard
          emoji="🖼️"
          title="画像"
          description="どちらも丸い枠に表示されます。正方形に近い画像がおすすめです。"
        >
          <div className="grid gap-5 sm:grid-cols-2">
            <ImageUploadField
              label="トップのメインビジュアル"
              value={content.heroImage}
              onChange={(v) => patch({ heroImage: v })}
              shape="circle"
              hint="代表作や看板イラストなど"
            />
            <ImageUploadField
              label="プロフィールのアイコン"
              value={content.aboutImage}
              onChange={(v) => patch({ aboutImage: v })}
              shape="circle"
              hint="SNSと同じアイコンがおすすめ"
            />
          </div>
        </SectionCard>

        {/* プロフィール */}
        <SectionCard
          emoji="💬"
          title="プロフィール文"
          description="1枠 = 1段落として表示されます。"
        >
          <div className="space-y-3">
            {content.aboutParagraphs.map((paragraph, index) => (
              <div key={index} className="flex items-start gap-2">
                <TextArea
                  value={paragraph}
                  onChange={(v) =>
                    patch({
                      aboutParagraphs: content.aboutParagraphs.map((p, i) => (i === index ? v : p)),
                    })
                  }
                  rows={2}
                />
                <RowControls
                  index={index}
                  total={content.aboutParagraphs.length}
                  onMove={(from, to) => patch({ aboutParagraphs: moveItem(content.aboutParagraphs, from, to) })}
                  onRemove={(i) => patch({ aboutParagraphs: removeItem(content.aboutParagraphs, i) })}
                />
              </div>
            ))}
          </div>
          <AddButton
            label="段落を追加"
            onClick={() => patch({ aboutParagraphs: [...content.aboutParagraphs, ""] })}
          />
        </SectionCard>

        {/* 対応内容 */}
        <SectionCard
          emoji="🏷️"
          title="対応内容バッジ"
          description="プロフィール欄のバッジと、ご依頼フォームの「ご依頼の種類」の選択肢になります。"
        >
          <div className="space-y-2">
            {content.services.map((service, index) => (
              <div key={index} className="flex items-center gap-2">
                <TextInput
                  value={service}
                  onChange={(v) =>
                    patch({ services: content.services.map((s, i) => (i === index ? v : s)) })
                  }
                />
                <RowControls
                  index={index}
                  total={content.services.length}
                  onMove={(from, to) => patch({ services: moveItem(content.services, from, to) })}
                  onRemove={(i) => patch({ services: removeItem(content.services, i) })}
                />
              </div>
            ))}
          </div>
          <AddButton label="バッジを追加" onClick={() => patch({ services: [...content.services, ""] })} />
        </SectionCard>

        {/* 作品ギャラリー */}
        <SectionCard
          emoji="🎨"
          title="作品ギャラリー"
          description="コルクボードに表示される作品です。タグは「、」区切りで複数つけられます。同じ言葉を使うと絞り込みボタンにまとまります（例: つなぐ、立ち絵）。"
        >
          <div className="space-y-4">
            {content.works.map((work, index) => (
              <div
                key={work.id}
                className="rounded-xl border border-pink-100 bg-pink-50/40 p-3"
              >
                <div className="mb-3 flex items-center justify-between gap-2">
                  <p className="text-xs font-bold text-pink-700">作品 {index + 1}</p>
                  <RowControls
                    index={index}
                    total={content.works.length}
                    onMove={(from, to) => patch({ works: moveItem(content.works, from, to) })}
                    onRemove={(i) => patch({ works: removeItem(content.works, i) })}
                  />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <ImageUploadField
                    label="作品画像"
                    value={work.image}
                    onChange={(v) => patch({ works: updateItem(content.works, index, { image: v }) })}
                    shape="square"
                  />
                  <div className="space-y-3">
                    <TextInput
                      label="タイトル"
                      value={work.title}
                      onChange={(v) => patch({ works: updateItem(content.works, index, { title: v }) })}
                    />
                    <TextInput
                      label="タグ（「、」区切りで複数OK）"
                      value={work.tags.join("、")}
                      onChange={(v) =>
                        // 入力中の末尾「、」を消さないよう、trim/空除去は保存時 (sanitizeContent) に行う
                        patch({ works: updateItem(content.works, index, { tags: v.split(/[、,]/) }) })
                      }
                      placeholder="例: つなぐ、立ち絵"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
          <AddButton
            label="作品を追加"
            onClick={() =>
              patch({
                works: [
                  ...content.works,
                  { id: crypto.randomUUID(), title: "新しい作品", tags: ["一枚絵"], image: null },
                ],
              })
            }
          />
        </SectionCard>

        {/* 基本料金 */}
        <SectionCard
          emoji="💰"
          title="基本料金"
          description="料金カードとして表示されます。「含まれるもの」は1行に1つずつ書いてください。"
        >
          <div className="space-y-4">
            {content.plans.map((plan, index) => (
              <div key={index} className="rounded-xl border border-pink-100 bg-pink-50/40 p-3">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <p className="text-xs font-bold text-pink-700">プラン {index + 1}</p>
                  <RowControls
                    index={index}
                    total={content.plans.length}
                    onMove={(from, to) => patch({ plans: moveItem(content.plans, from, to) })}
                    onRemove={(i) => patch({ plans: removeItem(content.plans, i) })}
                  />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <TextInput
                    label="プラン名"
                    value={plan.name}
                    onChange={(v) => patch({ plans: updateItem(content.plans, index, { name: v }) })}
                  />
                  <TextInput
                    label="料金"
                    value={plan.price}
                    onChange={(v) => patch({ plans: updateItem(content.plans, index, { price: v }) })}
                    placeholder="例: 4,000円"
                  />
                </div>
                <div className="mt-3 space-y-3">
                  <TextInput
                    label="説明"
                    value={plan.desc}
                    onChange={(v) => patch({ plans: updateItem(content.plans, index, { desc: v }) })}
                  />
                  <TextArea
                    label="含まれるもの（1行に1つ）"
                    value={plan.features.join("\n")}
                    onChange={(v) =>
                      patch({ plans: updateItem(content.plans, index, { features: v.split("\n") }) })
                    }
                    rows={3}
                  />
                </div>
              </div>
            ))}
          </div>
          <AddButton
            label="プランを追加"
            onClick={() =>
              patch({
                plans: [
                  ...content.plans,
                  { name: "新しいプラン", price: "0円", desc: "", features: [] },
                ],
              })
            }
          />
        </SectionCard>

        {/* 追加オプション */}
        <SectionCard
          emoji="➕"
          title="追加オプション"
          description="料金セクションの表と、ご依頼フォームのチェックボックスになります。"
        >
          <div className="space-y-2">
            {content.options.map((option, index) => (
              <div key={index} className="flex items-center gap-2">
                <TextInput
                  value={option.name}
                  onChange={(v) => patch({ options: updateItem(content.options, index, { name: v }) })}
                  placeholder="オプション名"
                />
                <div className="w-44 shrink-0">
                  <TextInput
                    value={option.price}
                    onChange={(v) => patch({ options: updateItem(content.options, index, { price: v }) })}
                    placeholder="+500円"
                  />
                </div>
                <RowControls
                  index={index}
                  total={content.options.length}
                  onMove={(from, to) => patch({ options: moveItem(content.options, from, to) })}
                  onRemove={(i) => patch({ options: removeItem(content.options, i) })}
                />
              </div>
            ))}
          </div>
          <AddButton
            label="オプションを追加"
            onClick={() => patch({ options: [...content.options, { name: "", price: "" }] })}
          />
        </SectionCard>

        {/* 納期について */}
        <SectionCard emoji="📅" title="納期について">
          <div className="space-y-4">
            <TextArea
              label="納期の説明文"
              value={content.deliveryLead}
              onChange={(v) => patch({ deliveryLead: v })}
              rows={3}
            />
            <div className="space-y-3">
              {content.deliveryNotes.map((note, index) => (
                <div key={index} className="rounded-xl border border-pink-100 bg-pink-50/40 p-3">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <p className="text-xs font-bold text-pink-700">補足 {index + 1}</p>
                    <RowControls
                      index={index}
                      total={content.deliveryNotes.length}
                      onMove={(from, to) => patch({ deliveryNotes: moveItem(content.deliveryNotes, from, to) })}
                      onRemove={(i) => patch({ deliveryNotes: removeItem(content.deliveryNotes, i) })}
                    />
                  </div>
                  <div className="space-y-3">
                    <TextInput
                      label="見出し"
                      value={note.title}
                      onChange={(v) => patch({ deliveryNotes: updateItem(content.deliveryNotes, index, { title: v }) })}
                    />
                    <TextArea
                      label="内容"
                      value={note.body}
                      onChange={(v) => patch({ deliveryNotes: updateItem(content.deliveryNotes, index, { body: v }) })}
                      rows={3}
                    />
                  </div>
                </div>
              ))}
            </div>
            <AddButton
              label="補足を追加"
              onClick={() => patch({ deliveryNotes: [...content.deliveryNotes, { title: "", body: "" }] })}
            />
          </div>
        </SectionCard>

        {/* 制作の流れ */}
        <SectionCard
          emoji="🪄"
          title="制作の流れ"
          description="番号は上から自動で付きます。"
        >
          <div className="space-y-3">
            {content.workflow.map((step, index) => (
              <div key={index} className="rounded-xl border border-pink-100 bg-pink-50/40 p-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="text-xs font-bold text-pink-700">ステップ {index + 1}</p>
                  <RowControls
                    index={index}
                    total={content.workflow.length}
                    onMove={(from, to) => patch({ workflow: moveItem(content.workflow, from, to) })}
                    onRemove={(i) => patch({ workflow: removeItem(content.workflow, i) })}
                  />
                </div>
                <div className="space-y-3">
                  <TextInput
                    label="見出し"
                    value={step.title}
                    onChange={(v) => patch({ workflow: updateItem(content.workflow, index, { title: v }) })}
                  />
                  <TextArea
                    label="内容"
                    value={step.body}
                    onChange={(v) => patch({ workflow: updateItem(content.workflow, index, { body: v }) })}
                    rows={2}
                  />
                </div>
              </div>
            ))}
          </div>
          <AddButton
            label="ステップを追加"
            onClick={() => patch({ workflow: [...content.workflow, { title: "", body: "" }] })}
          />
        </SectionCard>

        {/* 購入者へのお願い */}
        <SectionCard emoji="🙏" title="購入者へのお願い" description="1枠 = 1項目として表示されます。">
          <div className="space-y-2">
            {content.requests.map((request, index) => (
              <div key={index} className="flex items-start gap-2">
                <TextArea
                  value={request}
                  onChange={(v) =>
                    patch({ requests: content.requests.map((r, i) => (i === index ? v : r)) })
                  }
                  rows={2}
                />
                <RowControls
                  index={index}
                  total={content.requests.length}
                  onMove={(from, to) => patch({ requests: moveItem(content.requests, from, to) })}
                  onRemove={(i) => patch({ requests: removeItem(content.requests, i) })}
                />
              </div>
            ))}
          </div>
          <AddButton label="項目を追加" onClick={() => patch({ requests: [...content.requests, ""] })} />
        </SectionCard>

        {/* SNSリンク */}
        <SectionCard emoji="🔗" title="SNSリンク" description="ページ最下部に表示されます。">
          <div className="space-y-2">
            {content.socialLinks.map((link, index) => (
              <div key={index} className="flex items-center gap-2">
                <div className="w-36 shrink-0">
                  <TextInput
                    value={link.label}
                    onChange={(v) => patch({ socialLinks: updateItem(content.socialLinks, index, { label: v }) })}
                    placeholder="表示名"
                  />
                </div>
                <TextInput
                  value={link.href}
                  onChange={(v) => patch({ socialLinks: updateItem(content.socialLinks, index, { href: v }) })}
                  placeholder="https://..."
                />
                <RowControls
                  index={index}
                  total={content.socialLinks.length}
                  onMove={(from, to) => patch({ socialLinks: moveItem(content.socialLinks, from, to) })}
                  onRemove={(i) => patch({ socialLinks: removeItem(content.socialLinks, i) })}
                />
              </div>
            ))}
          </div>
          <AddButton
            label="リンクを追加"
            onClick={() => patch({ socialLinks: [...content.socialLinks, { label: "", href: "" }] })}
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
