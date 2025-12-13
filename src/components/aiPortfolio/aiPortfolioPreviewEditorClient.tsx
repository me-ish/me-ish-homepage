"use client";

import { useEffect, useState } from "react";
import type { Content } from "@/lib/aiPortfolio/aiPortfolio.schema";

type Section = {
  type: string;
  headings?: string[];
  paragraphs?: string[];
  items?: any[];
  cta?: { label?: string; href?: string };
};

type Props = {
  requestId: string;
  initialContent: Content;
  /** デザイン側で決まっているセクション順（任意） */
  initialSectionOrder?: string[];
};

/**
 * Content を deep clone する安全ヘルパー
 */
function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

function sectionLabel(type: string): string {
  switch (type) {
    case "hero":
      return "HERO（トップ）";
    case "about":
      return "ABOUT（自己紹介）";
    case "works":
      return "WORKS（作品）";
    case "services":
      return "SERVICES（募集している仕事）";
    case "skills":
      return "SKILLS（スキル）";
    case "contact":
      return "CONTACT（お問い合わせ）";
    case "cta":
      return "CTA（締め）";
    default:
      return type.toUpperCase();
  }
}

export default function AiPortfolioPreviewEditorClient({
  requestId,
  initialContent,
  initialSectionOrder,
}: Props) {
  const [content, setContent] = useState<Content>(initialContent);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  // === セクション順序 state ===========================================
  const [sectionOrder, setSectionOrder] = useState<string[]>(() => {
    if (initialSectionOrder && initialSectionOrder.length > 0) {
      return initialSectionOrder;
    }
    // content.sections から type の一覧をとり、その順で初期化
    const fromContent = initialContent.sections.map((s) => s.type);
    // 万一重複があっても一意にしておく
    return Array.from(new Set(fromContent));
  });

  // initialContent / initialSectionOrder が変わったときの同期キー
  const stableKey = JSON.stringify({
    content: initialContent,
    order: initialSectionOrder ?? [],
  });

  useEffect(() => {
    setContent(initialContent);
    if (initialSectionOrder && initialSectionOrder.length > 0) {
      setSectionOrder(initialSectionOrder);
    } else {
      const fromContent = initialContent.sections.map((s) => s.type);
      setSectionOrder(Array.from(new Set(fromContent)));
    }
  }, [stableKey]);

  // セクション取得
  const getSection = (type: string) =>
    content.sections.find((s) => s.type === type);

  const hero = getSection("hero");
  const about = getSection("about");
  const contact = getSection("contact");
  const cta = getSection("cta");

  // 編集用 state
  const [heroTitle, setHeroTitle] = useState(hero?.headings?.[0] ?? "");
  const [heroSubtitle, setHeroSubtitle] = useState(
    hero?.paragraphs?.[0] ?? "",
  );
  const [aboutText, setAboutText] = useState(about?.paragraphs?.[0] ?? "");
  const [contactLabel, setContactLabel] = useState(
    contact?.cta?.label ?? "お問い合わせ",
  );
  const [ctaLabel, setCtaLabel] = useState(
    cta?.cta?.label ?? "この内容で相談する",
  );

  // AI再生成後の state 同期
  useEffect(() => {
    const hero = getSection("hero");
    const about = getSection("about");
    const contact = getSection("contact");
    const cta = getSection("cta");

    setHeroTitle(hero?.headings?.[0] ?? "");
    setHeroSubtitle(hero?.paragraphs?.[0] ?? "");
    setAboutText(about?.paragraphs?.[0] ?? "");

    setContactLabel(contact?.cta?.label ?? "お問い合わせ");
    setCtaLabel(cta?.cta?.label ?? "この内容で相談する");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stableKey]);

  // === 並び替え操作 ====================================================
  const moveSection = (index: number, dir: "up" | "down") => {
    setSectionOrder((prev) => {
      const next = [...prev];
      const target = index + (dir === "up" ? -1 : 1);
      if (target < 0 || target >= next.length) return prev;
      const tmp = next[index];
      next[index] = next[target];
      next[target] = tmp;
      return next;
    });
  };

  /**
   * 保存処理
   */
  const handleSave = async () => {
    setSaving(true);
    setMessage(null);

    // 深いコピー
    const next = deepClone(content);

    const patch = (type: string, fn: (s: Section) => void) => {
      const s = next.sections.find((sec) => sec.type === type);
      if (s) fn(s);
    };

    // hero
    patch("hero", (s) => {
      s.headings = [heroTitle];
      s.paragraphs = [heroSubtitle];
    });

    // about
    patch("about", (s) => {
      s.paragraphs = [aboutText];
    });

    // contact CTA（label を必ず埋める）
    patch("contact", (s) => {
      s.cta = {
        href: s.cta?.href ?? "/contact",
        label: contactLabel || "お問い合わせ",
      };
    });

    // bottom CTA
    patch("cta", (s) => {
      s.cta = {
        href: s.cta?.href ?? "/contact",
        label: ctaLabel || "この内容で相談する",
      };
    });

    try {
      const res = await fetch(`/api/aiPortfolio/save/${requestId}`, {
        method: "POST",
        body: JSON.stringify({
          content: next,
          // ★ ここでセクション順序も一緒に送っておく
          sectionOrder,
        }),
      });

      if (!res.ok) {
        setMessage("保存に失敗しました。時間をおいて再度お試しください。");
        setSaving(false);
        return;
      }

      const json = await res.json();
      if (json?.ok && json.slug) {
        window.location.href = `/aiPortfolio/u/${json.slug}`;
      } else {
        setMessage("保存は完了しましたが、公開URLの取得に失敗しました。");
        setSaving(false);
      }
    } catch (e) {
      console.error(e);
      setMessage("通信エラーが発生しました。");
      setSaving(false);
    }
  };

  return (
    <section className="mt-8 rounded-lg border p-6">
      <h2 className="text-lg font-medium">テキストとセクション配置を調整する</h2>
      <p className="mt-1 text-sm text-gray-600">
        セクションの並び順とテキストを調整して、「この内容で確定して公開」を押してください。
      </p>

      {/* セクション並び替え UI */}
      <div className="mt-4 rounded-md border border-dashed bg-gray-50 p-4">
        <h3 className="text-sm font-medium">セクションの表示順</h3>
        <p className="mt-1 text-xs text-gray-600">
          HERO / ABOUT / WORKS などの順番を上下ボタンで入れ替えできます。
          （保存後、順序情報も一緒に記録されます）
        </p>

        <ul className="mt-3 space-y-2 text-sm">
          {sectionOrder.map((type, index) => (
            <li
              key={`${type}-${index}`}
              className="flex items-center justify-between rounded bg-white px-3 py-2 shadow-sm"
            >
              <span className="text-xs font-medium tracking-wide">
                {sectionLabel(type)}
              </span>
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => moveSection(index, "up")}
                  disabled={index === 0}
                  className="rounded border px-2 py-1 text-[11px] disabled:opacity-40"
                >
                  ↑ 上へ
                </button>
                <button
                  type="button"
                  onClick={() => moveSection(index, "down")}
                  disabled={index === sectionOrder.length - 1}
                  className="rounded border px-2 py-1 text-[11px] disabled:opacity-40"
                >
                  ↓ 下へ
                </button>
              </div>
            </li>
          ))}
        </ul>
      </div>

      {/* テキスト編集ブロック */}
      <div className="mt-6 grid gap-4">
        {/* HERO TITLE */}
        <label className="grid gap-1">
          <span className="text-sm font-medium">
            ヒーロー見出し（ページ最上部）
          </span>
          <input
            className="rounded border px-3 py-2 text-sm"
            value={heroTitle}
            onChange={(e) => setHeroTitle(e.target.value)}
          />
        </label>

        {/* HERO SUB */}
        <label className="grid gap-1">
          <span className="text-sm font-medium">
            ヒーローサブテキスト / キャッチコピー
          </span>
          <textarea
            className="min-h-[72px] rounded border px-3 py-2 text-sm"
            value={heroSubtitle}
            onChange={(e) => setHeroSubtitle(e.target.value)}
          />
        </label>

        {/* ABOUT */}
        <label className="grid gap-1">
          <span className="text-sm font-medium">自己紹介テキスト（About）</span>
          <textarea
            className="min-h-[120px] rounded border px-3 py-2 text-sm"
            value={aboutText}
            onChange={(e) => setAboutText(e.target.value)}
          />
        </label>

        {/* CONTACT */}
        <label className="grid gap-1">
          <span className="text-sm font-medium">
            お問い合わせボタンの文言（Contact）
          </span>
          <input
            className="rounded border px-3 py-2 text-sm"
            value={contactLabel}
            onChange={(e) => setContactLabel(e.target.value)}
          />
        </label>

        {/* CTA */}
        <label className="grid gap-1">
          <span className="text-sm font-medium">
            最下部のCTAボタンの文言（締めの一言）
          </span>
          <input
            className="rounded border px-3 py-2 text-sm"
            value={ctaLabel}
            onChange={(e) => setCtaLabel(e.target.value)}
          />
        </label>
      </div>

      <div className="mt-6 flex items-center gap-3">
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
    </section>
  );
}
