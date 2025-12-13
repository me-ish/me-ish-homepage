// src/app/aiPortfolio/form/page.tsx
"use client";

import React, { useMemo, useState, useRef } from "react";
import type { Design, Content } from "@/lib/aiPortfolio/aiPortfolio.schema";
import type {
  VariantSpec,
  PatternId,
} from "@/lib/aiPortfolio/aiPortfolio.variant.base";
import AiPortfolioImageUploader, {
  type AiPortfolioImageItem,
} from "@/components/aiPortfolio/aiPortfolioImageUploader";
import { AiPortfolioHeroSwitcher } from "@/components/aiPortfolio/sections/AiPortfolioHeroSwitcher";
import {
  getWorldviewPreset,
  type WorldviewBase,
} from "@/lib/aiPortfolio/aiPortfolio.worldviewPresets";
import { AiDegreeSlider } from "@/components/aiPortfolio/AiDegreeSlider";

/* =========================================================
 * 送信 payload 型
 * ========================================================= */
type AiPortfolioPayload = {
  email: string;
  name: string;
  title: string;
  tagline: string;
  bio: string;
  tone: "ですます" | "フレンドリー";
  color: string;

  sections: {
    hero: boolean;
    about: boolean;
    works: boolean;
    services: boolean;
    skills: boolean;
    contact: boolean;
    cta: boolean;
  };

  social: {
    twitter?: string;
    instagram?: string;
    behance?: string;
    website?: string;
  };

  services: { name: string; price?: string; desc?: string }[];
  skills: string[];
  images: AiPortfolioImageItem[];

  designAnswers: {
    worldviewBase: WorldviewBase;
    patternBase: string;
    surfaceStyle: string;
    showcaseStyle: string;
    layoutPref: string;
    languageMode: string;
    fontPreset: string;
  };

  aiStrength: {
    worldview: number;
    pattern: number;
    surface: number;
    showcase: number;
    layout: number;
    language: number;
    font: number;
  };
};

/* =========================================================
 * 世界観テンプレ / デザイン初期値
 * ========================================================= */
type DesignDefaults = {
  worldviewBase: string;
  patternBase: string;
  surfaceStyle: string;
  showcaseStyle: string;
  layoutPref: string;
  languageMode: string;
  fontPreset: string;
};

const WORLDVIEWS = [
  "minimal",
  "modern",
  "business",
  "cute",
  "pop",
  "dark",
  "cyber",
  "natural",
  "luxury",
  "retro",
] as const;

const WORLDVIEW_COLORS: Record<
  (typeof WORLDVIEWS)[number],
  { primary: string; accent: string; bg: string }
> = {
  minimal: { primary: "#111827", accent: "#6B7280", bg: "#F9FAFB" },
  modern: { primary: "#38BDF8", accent: "#94A3B8", bg: "#020617" },
  business: { primary: "#2563EB", accent: "#0F172A", bg: "#EFF6FF" },
  cute: { primary: "#FB7185", accent: "#FDBA74", bg: "#FEF2F2" },
  pop: { primary: "#F97316", accent: "#EC4899", bg: "#FEF3C7" },
  dark: { primary: "#F97316", accent: "#E5E7EB", bg: "#020617" },
  cyber: { primary: "#22D3EE", accent: "#A855F7", bg: "#020617" },
  natural: { primary: "#22C55E", accent: "#A3E635", bg: "#ECFDF3" },
  luxury: { primary: "#FACC15", accent: "#FEFCE8", bg: "#020617" },
  retro: { primary: "#D97706", accent: "#78350F", bg: "#FFFBEB" },
};

// worldview ごとの Hero 背景グラデーション
const WORLDVIEW_GRADIENTS: Record<(typeof WORLDVIEWS)[number], string> = {
  minimal: "linear-gradient(145deg, #ffffff 0%, #f3f4f6 100%)",
  modern: "linear-gradient(145deg, #020617 0%, #0f172a 50%, #1e293b 100%)",
  business: "linear-gradient(145deg, #e2e8f0 0%, #f8fafc 100%)",
  cute: "linear-gradient(145deg, #fff1f2 0%, #ffe4e6 100%)",
  pop: "linear-gradient(145deg, #fff7ed 0%, #ffedd5 100%)",
  dark: "linear-gradient(145deg, #020617 0%, #020617 100%)",
  cyber:
    "linear-gradient(145deg, #020617 0%, #111827 40%, #312e81 75%, #4c1d95 100%)",
  natural: "linear-gradient(145deg, #ecfdf5 0%, #d1fae5 100%)",
  luxury: "linear-gradient(145deg, #fefce8 0%, #fef08a 100%)",
  retro: "linear-gradient(145deg, #fffbeb 0%, #fef3c7 100%)",
};

const illustratorSkillPresets = [
  "イラスト",
  "キャラクターデザイン",
  "一枚絵",
  "立ち絵",
  "背景イラスト",
  "SDキャラ",
  "アイコン制作",
  "SNSヘッダー",
  "ゲームイラスト",
  "TRPG立ち絵",
  "Live2Dモデル用イラスト",
  "カラーイラスト",
  "モノクロイラスト",
  "Clip Studio Paint",
  "Procreate",
  "Photoshop",
];

/* =========================================================
 * 進捗ゲージ
 * ========================================================= */
const DEFAULT_SECTIONS = ["hero", "about", "works", "contact", "cta"] as const;
const SECTION_LABELS: Record<keyof AiPortfolioPayload["sections"], string> = {
  hero: "Hero（最初の見せ場）",
  about: "About（自己紹介）",
  works: "Works（作品ギャラリー）",
  services: "Services（サービス/料金）",
  skills: "Skills（スキルタグ）",
  contact: "Contact（連絡先）",
  cta: "CTA（最後のひと押し）",
};

function calcProgress(
  payload: Partial<AiPortfolioPayload>,
  imagesCount: number
) {
  let score = 0;

  if (payload.email) score++;
  if (payload.name) score++;
  if (payload.title) score++;
  if (payload.tagline) score++;
  if (payload.bio) score++;
  if (imagesCount > 0) score++;

  // 6項目で100%になるように調整
  const maxScore = 6;
  return Math.min(100, Math.round((score / maxScore) * 100));
}

/* =========================================================
 * PREVIEW 背景生成ロジック
 *  - worldviewPreset (bgStyle / patternLayers / textureLayers) を利用
 *  - Renderer 側の buildBackgroundStyle と整合
 * ========================================================= */

// PatternId → CSS 生成（Renderer と共通ロジック）
function previewPatternStyle(
  pattern: PatternId | "none",
  color: string
): React.CSSProperties {
  switch (pattern) {
    case "dot-soft":
      return {
        backgroundImage: `radial-gradient(${color}18 2px, transparent 2px)`,
        backgroundSize: "18px 18px",
      };
    case "dot-retro":
      return {
        backgroundImage: `radial-gradient(${color}33 6px, transparent 6px)`,
        backgroundSize: "40px 40px",
      };
    case "dot-dense-noise":
      return {
        backgroundImage: `radial-gradient(${color}1a 1.5px, transparent 1.5px)`,
        backgroundSize: "10px 10px",
      };

    case "stripe-vertical-soft":
      return {
        backgroundImage: `repeating-linear-gradient(
          90deg,
          ${color}12,
          ${color}12 2px,
          transparent 2px,
          transparent 16px
        )`,
      };
    case "stripe-vertical-bold":
      return {
        backgroundImage: `repeating-linear-gradient(
          90deg,
          ${color}26,
          ${color}26 6px,
          transparent 6px,
          transparent 22px
        )`,
      };
    case "stripe-diagonal":
      return {
        backgroundImage: `repeating-linear-gradient(
          135deg,
          ${color}18,
          ${color}18 3px,
          transparent 3px,
          transparent 15px
        )`,
      };

    case "grid-thin":
      return {
        backgroundImage: `
          linear-gradient(${color}12 1px, transparent 1px),
          linear-gradient(90deg, ${color}12 1px, transparent 1px)
        `,
        backgroundSize: "32px 32px",
      };
    case "grid-neon":
      return {
        backgroundImage: `
          linear-gradient(${color}40 1px, transparent 1px),
          linear-gradient(90deg, ${color}40 1px, transparent 1px)
        `,
        backgroundSize: "32px 32px",
      };

    case "texture-paper":
      return {
        backgroundImage: `
          radial-gradient(circle at 0 0, ${color}08 0, transparent 60%),
          radial-gradient(circle at 100% 100%, ${color}08 0, transparent 60%)
        `,
        backgroundSize: "80px 80px",
      };
    case "texture-noise":
      return {
        backgroundImage:
          "radial-gradient(circle at 1px 1px, rgba(0,0,0,0.05) 1px, transparent 0)",
        backgroundSize: "6px 6px",
      };

    case "none":
    default:
      return {};
  }
}

// worldview ごとの grid ラインカラー（Renderer の簡易版）
function previewGridLineColor(
  worldview: WorldviewBase,
  theme: { colorPrimary: string; colorAccent: string }
): string {
  switch (worldview) {
    case "minimal":
    case "business":
      return "#e5e7eb"; // slate-200
    case "dark":
    case "cyber":
    case "luxury":
      return theme.colorAccent || theme.colorPrimary;
    default:
      return theme.colorPrimary;
  }
}

// PREVIEW 用の背景 style を構築
function buildPreviewBackgroundStyle(
  worldview: WorldviewBase
): React.CSSProperties {
  const preset = getWorldviewPreset(worldview);
  const colors = WORLDVIEW_COLORS[worldview];

  const baseColor = colors.bg;
  const anyPreset = preset as any;

  // 1) worldview 側で bgStyle が指定されていれば、それを優先
  const presetBgStyle = anyPreset.bgStyle as
    | React.CSSProperties
    | undefined;

  if (presetBgStyle && Object.keys(presetBgStyle).length > 0) {
    return {
      backgroundColor: baseColor,
      ...presetBgStyle,
    };
  }

  // 2) bgStyle がなければ patternLayers / textureLayers / bgGradient を合成
  const patternLayers: (PatternId | "none")[] =
    (anyPreset.patternLayers as (PatternId | "none")[]) ??
    ((preset.patternBase
      ? [preset.patternBase as PatternId]
      : ["none"]) as (PatternId | "none")[]);

  const textureLayers: string[] =
    (anyPreset.textureLayers as string[]) ?? [];

  const bgGradient: string | undefined = anyPreset.bgGradient;

  const themeLike = {
    colorPrimary: colors.primary,
    colorAccent: colors.accent,
  };

  const images: string[] = [];
  const sizes: string[] = [];

  // 柄レイヤー
  for (const p of patternLayers) {
    let colorToUse = colors.primary;

    if (typeof p === "string" && p.startsWith("grid-")) {
      colorToUse = previewGridLineColor(worldview, themeLike);
    }

    const pat = previewPatternStyle(p, colorToUse);
    if (!pat.backgroundImage) continue;

    images.push(pat.backgroundImage as string);
    sizes.push((pat.backgroundSize as string) || "auto");
  }

  // テクスチャレイヤー
  for (const layer of textureLayers) {
    if (layer === "noise-soft") {
      images.push(
        "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.06) 1px, transparent 0)"
      );
      sizes.push("4px 4px");
    } else if (layer === "paper-grain") {
      images.push(
        "radial-gradient(circle at 0 0, rgba(255,255,255,0.30) 0, transparent 60%)"
      );
      sizes.push("120px 120px");
    }
  }

  // グラデーションレイヤー
  if (bgGradient) {
    images.push(bgGradient);
    sizes.push("auto");
  }

  const style: React.CSSProperties = {
    backgroundColor: baseColor,
  };

  if (images.length > 0) {
    style.backgroundImage = images.join(",");
    style.backgroundSize = sizes.join(",");
  }

  return style;
}

/* =========================================================
 * MAIN COMPONENT
 * ========================================================= */
export default function AiPortfolioFormPage() {
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [images, setImages] = useState<AiPortfolioImageItem[]>([]);
  const formRef = useRef<HTMLFormElement | null>(null);

  // プロフィール画像プレビュー用
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState<string | null>(null);
  const [avatarInputUrl, setAvatarInputUrl] = useState<string>("");

  // ★ モバイル用プレビューモーダルの開閉
  const [previewOpen, setPreviewOpen] = useState(false);

  // D&D / ファイル選択用ハンドラ
  const handleAvatarFile = (file: File | null) => {
    if (!file) return;
    const objectUrl = URL.createObjectURL(file);
    setAvatarPreviewUrl(objectUrl);
    // 使い道ができたとき用に一応名前も保持しておく
    setAvatarInputUrl(file.name);
  };

  const handleAvatarFileChange = (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0] ?? null;
    handleAvatarFile(file);
  };

  const handleAvatarDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0] ?? null;
    handleAvatarFile(file);
  };

  const handleAvatarDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  // 世界観 preset 由来のデザイン初期値
  const [selectedWorldview, setSelectedWorldview] =
    useState<WorldviewBase>("business");

  const [designDefaults, setDesignDefaults] = useState<DesignDefaults>(() => {
    const preset = getWorldviewPreset("business");
    return {
      worldviewBase: preset.id,
      patternBase: preset.patternBase,
      surfaceStyle: preset.surfaceStyle,
      showcaseStyle: preset.showcaseStyle,
      layoutPref: preset.layoutPref,
      languageMode: preset.languageMode,
      fontPreset: preset.fontPreset,
    };
  });

  // AI自由度 (0-100)
  const [aiSwing, setAiSwing] = useState<number>(40);

  // ★ スキルプリセット選択状態
  const [selectedSkillPresets, setSelectedSkillPresets] = useState<string[]>([]);

  function toggleSkillPreset(tag: string) {
    setSelectedSkillPresets((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  }
    // ★ サービスカードの動的追加用
  const [serviceIds, setServiceIds] = useState<number[]>([1]);

  const handleAddService = () => {
    setServiceIds((prev) => {
      const nextId = (prev[prev.length - 1] ?? 0) + 1;
      return [...prev, nextId];
    });
  };

  const handleRemoveService = (id: number) => {
    setServiceIds((prev) => {
      // 最低 1 件は残す
      if (prev.length <= 1) return prev;
      return prev.filter((x) => x !== id);
    });
  };


  // 入力の「ざっくりライブ値」
  const [live, setLive] = useState<Partial<AiPortfolioPayload>>({});
  const progress = useMemo(
    () => calcProgress(live, images.length),
    [live, images.length]
  );

  // ---------------------------------------------
  // Hero プレビュー用 Mock (AI連動)
  // ---------------------------------------------
  const colors = WORLDVIEW_COLORS[selectedWorldview];
  const mockAiFactor = aiSwing / 100;

  const mockTheme: Design["theme"] = useMemo(() => {
    // 50%以上で柄が出るダミー演出
    const pattern = mockAiFactor > 0.5 ? "dot" : "none";

    return {
      colorPrimary: colors.primary,
      colorAccent: colors.accent,
      colorBG: colors.bg,
      colorText:
        selectedWorldview === "minimal" ||
        selectedWorldview === "business" ||
        selectedWorldview === "cute" ||
        selectedWorldview === "pop" ||
        selectedWorldview === "retro"
          ? "#111827"
          : "#E5E7EB",

      backgroundPattern: pattern,
      patternLayers: pattern === "dot" ? ["dot-soft"] : [],
      textureLayers: mockAiFactor > 0.8 ? ["noise"] : [],

      patternColor: undefined,
      languageMode: designDefaults.languageMode as any,
      fontPreset: designDefaults.fontPreset as any,
      // worldview 固有の Hero グラデーションを渡す
      bgGradient: WORLDVIEW_GRADIENTS[selectedWorldview],
    };
  }, [selectedWorldview, aiSwing, colors, mockAiFactor, designDefaults]);

  // AI自由度に応じてバリアント（構造・質感）をダミー変化させる
  const mockVariant: VariantSpec = useMemo(() => {
    const layout = aiSwing > 70 ? "split" : "centerBasic";
    const surface = aiSwing > 40 ? "glass" : "card";

    return {
      worldview: selectedWorldview,
      layout: layout as any,
      surface: surface as any,
      pattern: "none" as any, // patternはthemeで制御
      showcase: "gallery" as any,
      variantId: "mock",
      shadow: aiSwing > 80 ? "deep" : "soft",
      radius: aiSwing > 90 ? "extraLarge" : "large",
    } as any;
  }, [selectedWorldview, aiSwing]);

  const mockContent: Content = {
    sections: [
      {
        type: "hero",
        headings: [
          live.name || "田中太郎",
          live.title || "Webデザイナー / イラストレーター",
        ],
        paragraphs: [
          live.tagline ||
            "クリエイティビティと技術を組み合わせた、ユーザー中心のデジタル表現をつくります。",
        ],
      },
    ],
  };

  /* ---------------------------------------------
   * Submit Handler
   * --------------------------------------------- */
  // ★ 追加：カンマ区切り文字列を配列にする共通ヘルパー
  function splitSkills(raw?: string | null): string[] {
    if (!raw) return [];
    return raw
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setMsg(null);

    try {
      const data = new FormData(e.currentTarget);

      const getString = (name: string): string =>
        (data.get(name) as string | null) ?? "";
      const getNum = (name: string, fallback = 0): number => {
        const v = data.get(name);
        const n = typeof v === "string" ? Number(v) : Number.NaN;
        return Number.isFinite(n) ? n : fallback;
      };

      // services（動的に追加されたカードを state から集計）
      const services: { name: string; price?: string; desc?: string }[] = [];

      serviceIds.forEach((id) => {
        const name = getString(`svc${id}_name`).trim();
        const priceRaw = getString(`svc${id}_price`).trim();
        const descRaw = getString(`svc${id}_desc`).trim();

        if (!name) return; // 名前がないカードは無視

        services.push({
          name,
          price: priceRaw || undefined,
          desc: descRaw || undefined,
        });
      });



      const presetRaw = data.get("skill_presets") as string | null;
      const manualRaw = data.get("skills") as string | null;

      const presetSkills = splitSkills(presetRaw);
      const manualSkills = splitSkills(manualRaw);

      // 重複を除いて統合
      const skills = Array.from(new Set([...presetSkills, ...manualSkills]));


      const aiSwingVal = getNum("aiSwing", aiSwing);

      const aiStrength = {
        worldview: aiSwingVal,
        pattern: aiSwingVal,
        surface: aiSwingVal,
        showcase: aiSwingVal,
        layout: aiSwingVal,
        font: aiSwingVal,
        language: Math.round(aiSwingVal * 0.6),
      };

      const payload: AiPortfolioPayload = {
        email: getString("email"),
        name: getString("name"),
        title: getString("title"),
        tagline: getString("tagline"),
        bio: getString("bio"),
        tone: (getString("tone") as any) || "ですます",
        color: getString("color") || "#111827",

        sections: {
          hero: data.get("sec_hero") === "on",
          about: data.get("sec_about") === "on",
          works: data.get("sec_works") === "on",
          services: data.get("sec_services") === "on",
          skills: data.get("sec_skills") === "on",
          contact: data.get("sec_contact") === "on",
          cta: data.get("sec_cta") === "on",
        },

        social: {
          twitter: getString("tw") || undefined,
          instagram: getString("ig") || undefined,
          behance: getString("be") || undefined,
          website: getString("site") || undefined,
        },

        services,
        skills,
        images,

        designAnswers: {
          worldviewBase: getString("worldviewBase") as any,
          patternBase: getString("patternBase") as any,
          surfaceStyle: getString("surfaceStyle") as any,
          showcaseStyle: getString("showcaseStyle") as any,
          layoutPref: getString("layoutPref") as any,
          languageMode: getString("languageMode") as any,
          fontPreset: getString("fontPreset") as any,
        },

        aiStrength,
      };

      const res = await fetch("/api/aiPortfolio/form/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => null);
        console.error("submit error:", err);
        setMsg("送信に失敗しました。入力内容をご確認ください。");
        return;
      }

      const json = await res.json();
      if (json?.id) {
        window.location.href = `/aiPortfolio/preview/${json.id}`;
      } else {
        setMsg("送信に失敗しました。");
      }
    } catch (error) {
      console.error(error);
      setMsg("通信エラーが発生しました。時間をおいて再度お試しください。");
    } finally {
      setLoading(false);
    }
  }

  // live 更新 helper
  // live 更新 helper
  function bindLive(name: keyof AiPortfolioPayload) {
    return {
      onChange: (
        e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
      ) =>
        setLive((prev) => ({
          ...prev,
          [name]: e.target.value,
        })),
    };
  }

  // ★ Magic Fill：サンプル自動入力
  function handleMagicFill() {
    const form = formRef.current;
    if (!form) return;

    // 架空の猫好きイラストレーター例
    const sample = {
      email: "neko-artist@example.com",
      name: "ねこ山 みけ",
      title: "イラストレーター / キャラクターデザイナー",
      tagline: "あたたかくて、ちょっと不思議な世界を描きます",
      bio: [
        "フリーランスのイラストレーターとして、SNSアイコンやキャラクターデザイン、同人誌表紙などを中心に活動しています。",
        "「見る人の心が少しだけ軽くなる」ような、やさしい色彩と物語性のあるイラストが得意です。",
        "猫・レトロ・喫茶店モチーフが特に好きです。",
      ].join("\n"),
      tone: "ですます",
      color: "#FB7185",

      tw: "@neko_mike",
      ig: "neko_mike_art",
      be: "",
      site: "https://nekomike-portfolio.example.com",

      svc1_name: "SNSアイコンイラスト制作",
      svc1_price_value: "8000",
      svc1_desc:
        "SNSや配信用のアイコンを制作します。デフォルメ / 等身どちらでも対応可能です。商用利用もご相談ください。",

      svc2_name: "キャラクターデザイン",
      svc2_price_value: "25000",
      svc2_desc:
        "ゲーム・動画・個人観賞用などのキャラクターデザインを一からご提案します。設定テキストからの起こしも可能です。",

      skillsInput:
        "猫イラスト, キャラクターデザイン, パステルカラー, SDキャラ, 背景付きイラスト",
    } as const;

    // 指定 name の input/textarea に値を入れるヘルパー
    const setValue = (name: string, value: string) => {
      const el = form.elements.namedItem(name) as
        | HTMLInputElement
        | HTMLTextAreaElement
        | null;
      if (el) el.value = value;
    };

    // 基本情報
    setValue("email", sample.email);
    setValue("name", sample.name);
    setValue("title", sample.title);
    setValue("tagline", sample.tagline);
    setValue("bio", sample.bio);
    setValue("color", sample.color);

    // SNS
    setValue("tw", sample.tw);
    setValue("ig", sample.ig);
    setValue("be", sample.be);
    setValue("site", sample.site);

    // サービス
    setValue("svc1_name", sample.svc1_name);
    setValue("svc1_price_value", sample.svc1_price_value);
    setValue("svc1_desc", sample.svc1_desc);

    setValue("svc2_name", sample.svc2_name);
    setValue("svc2_price_value", sample.svc2_price_value);
    setValue("svc2_desc", sample.svc2_desc);

    // スキル自由入力
    setValue("skills", sample.skillsInput);

    // 世界観テンプレも cute に寄せる
    setSelectedWorldview("cute");
    const cutePreset = getWorldviewPreset("cute");
    setDesignDefaults({
      worldviewBase: cutePreset.id,
      patternBase: cutePreset.patternBase,
      surfaceStyle: cutePreset.surfaceStyle,
      showcaseStyle: cutePreset.showcaseStyle,
      layoutPref: cutePreset.layoutPref,
      languageMode: cutePreset.languageMode,
      fontPreset: cutePreset.fontPreset,
    });

    // 進捗ゲージ用の live も更新
    setLive((prev) => ({
      ...prev,
      email: sample.email,
      name: sample.name,
      title: sample.title,
      tagline: sample.tagline,
      bio: sample.bio,
    }));
  }


  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-50 via-slate-50 to-slate-100">
      <div className="mx-auto max-w-6xl px-4 py-10">
        {/* ================= HEADER ================= */}
        <header className="mb-10 rounded-3xl border border-slate-200 bg-white/95 p-6 shadow-sm">
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            {/* 左：ブランド＋説明 */}
            <div>
              {/* me-ish AURA バッジ */}
              <div className="mb-3 inline-flex items-center gap-3">
                <div className="inline-flex items-center rounded-full border border-cyan-300/70 bg-white px-3 py-1 shadow-sm">
                  <span className="font-lilita text-sm leading-none">
                    <span className="text-[#00a1e9]">me-ish</span>{" "}
                    <span className="bg-gradient-to-r from-pink-400 via-purple-500 to-sky-400 bg-clip-text text-transparent">
                      AURA
                    </span>
                  </span>
                </div>
                <span className="text-[11px] font-medium uppercase tracking-[0.16em] text-slate-500">
                  Premium Portfolio Generator
                </span>
              </div>

              <h1 className="text-2xl font-semibold tracking-tight text-slate-900 md:text-3xl">
                AIポートフォリオ作成フォーム
              </h1>
              <p className="mt-1 text-xs text-slate-500 md:text-sm">
                テンプレートとAI自由度を選ぶだけで、数分で“それっぽい”ポートフォリオを自動生成します。
                まずは基本情報と作品画像を入れてみてください。
              </p>
            </div>

            {/* 右：進捗ゲージ ＋ Magic Fill */}
            <div className="w-full max-w-xs space-y-2">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                <div className="mb-1 flex items-center justify-between text-[11px] text-slate-500">
                  <span>入力の完成度</span>
                  <span className="tabular-nums font-medium text-slate-800">
                    {progress}%
                  </span>
                </div>
                <div className="h-2 w-full rounded-full bg-slate-200">
                  <div
                    className="h-2 rounded-full bg-gradient-to-r from-cyan-500 to-sky-400 transition-all"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <p className="mt-1 text-[10px] text-slate-500">
                  メール・名前・肩書き・タグライン・自己紹介・画像・サービスなどの入力で100%に近づきます。
                </p>
              </div>

              {/* ★ Magic Fill ボタン */}
              <button
                type="button"
                onClick={handleMagicFill}
                className="w-full rounded-xl border border-dashed border-sky-300 bg-sky-50/70 px-3 py-2 text-[11px] font-medium text-sky-700 shadow-sm hover:border-sky-400 hover:bg-sky-100"
              >
                ✨ サンプルを自動入力してみる
              </button>
            </div>

          </div>
        </header>

        <form
          ref={formRef}
          onSubmit={onSubmit}
          className="grid gap-6"
          autoComplete="off"
          noValidate
        >
{/* ================= STEP1 基本情報 ================= */}
<section className="rounded-3xl border border-slate-200 bg-white/95 p-6 shadow-[0_18px_45px_rgba(15,23,42,0.08)]">
  <div className="flex items-center justify-between gap-3">
    <div className="inline-flex items-center gap-2 rounded-full border border-sky-300/60 bg-gradient-to-r from-sky-50 to-cyan-50 px-3 py-1">
      <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-sky-500">
        STEP 1
      </span>
      <span className="text-[11px] font-medium text-slate-700">
        基本情報
      </span>
    </div>
  </div>

  <div className="mt-4 grid gap-4 md:grid-cols-2">
    <label className="grid gap-1 text-xs">
      <span className="font-medium text-slate-700">
        メールアドレス *
      </span>
      <input
        name="email"
        type="email"
        required
        placeholder="example@gmail.com"
        className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-sky-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-sky-300"
        {...bindLive("email")}
      />
    </label>

    <label className="grid gap-1 text-xs">
      <span className="font-medium text-slate-700">
        お名前 / ペンネーム *
      </span>
      <input
        name="name"
        required
        placeholder="あなたの活動名"
        className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-sky-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-sky-300"
        {...bindLive("name")}
      />
    </label>

    <label className="grid gap-1 text-xs">
      <span className="font-medium text-slate-700">肩書き *</span>
      <input
        name="title"
        required
        placeholder="例：Illustrator / Web Designer"
        className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-sky-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-sky-300"
        {...bindLive("title")}
      />
    </label>

    <label className="grid gap-1 text-xs">
      <span className="font-medium text-slate-700">
        一言（タグライン） *
      </span>
      <input
        name="tagline"
        required
        placeholder="例：やさしい世界を描きます"
        className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-sky-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-sky-300"
        {...bindLive("tagline")}
      />
    </label>
    {/* プロフィール画像アップロード＋プレビュー */}
<div className="mt-4 grid gap-4 md:grid-cols-[auto,1fr] items-center">
  {/* プレビュー（左） */}
  <div className="flex flex-col items-center gap-2">
    <div className="relative">
      <div className="absolute -inset-1 rounded-full bg-gradient-to-br from-sky-300/40 to-cyan-400/40 blur-md" />
      <div
        className="relative flex h-20 w-20 items-center justify-center overflow-hidden rounded-full border-4 border-white bg-slate-100 text-sm font-semibold text-slate-500 shadow-sm md:h-24 md:w-24"
      >
        {avatarPreviewUrl ? (
          // 選択した画像プレビュー
          <img
            src={avatarPreviewUrl}
            alt="プロフィール画像プレビュー"
            className="h-full w-full object-cover"
          />
        ) : (
          // まだ画像がないときのプレースホルダー
          <span className="px-3 text-center leading-tight">
            No Image
          </span>
        )}
      </div>
    </div>
    <p className="text-[11px] text-slate-500">
      丸くトリミングされた状態でプレビュー表示されます。
    </p>
  </div>

  {/* アップロードエリア（右） */}
  <div className="space-y-3">
    {/* D&D + ファイル選択 */}
    <div
      onDrop={handleAvatarDrop}
      onDragOver={handleAvatarDragOver}
      className="group flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50/60 px-4 py-5 text-center transition hover:border-sky-400 hover:bg-sky-50/80"
    >
      <input
        id="avatar-file-input"
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleAvatarFileChange}
      />
      <label
        htmlFor="avatar-file-input"
        className="flex flex-col items-center gap-1"
      >
        <span className="text-xs font-medium text-slate-700">
          画像をドラッグ＆ドロップ or クリックして選択
        </span>
        <span className="text-[11px] text-slate-500">
          正方形の画像推奨（2MB程度まで）。今はローカルプレビューのみです。
        </span>
      </label>
    </div>
  </div>
</div>
  </div>

  <label className="mt-4 block text-xs">
    <span className="font-medium text-slate-700">自己紹介</span>
    <textarea
      name="bio"
      rows={5}
      placeholder="あなたのこと、活動のこと、好きなこと。ざっくりでOK。"
      className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-sky-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-sky-300"
      {...bindLive("bio")}
    />
  </label>

  <div className="mt-4 grid gap-4 md:grid-cols-2">
    <label className="grid gap-1 text-xs">
      <span className="font-medium text-slate-700">文章トーン</span>
      <select
        name="tone"
        className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 focus:border-sky-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-sky-300"
      >
        <option value="ですます">丁寧（ですます）</option>
        <option value="フレンドリー">
          フレンドリー（やわらかめ）
        </option>
      </select>
    </label>

    <label className="grid gap-1 text-xs">
      <span className="font-medium text-slate-700">
        あなたの好きな色（任意）
      </span>
      <div className="flex items-center gap-2">
        <input
          name="color"
          type="color"
          defaultValue="#111827"
          className="h-10 w-14 cursor-pointer rounded border border-slate-200 bg-white"
        />
        <span className="text-[11px] text-slate-500">
          好きな色はボタンやライン、背景柄の色など“差し色”として使われます。
        </span>
      </div>
    </label>
  </div>
</section>

          {/* ================= STEP2 DESIGN / TEMPLATE & AI自由度 ================= */}
          <section className="rounded-3xl border border-slate-200 bg-white/95 p-6 shadow-[0_18px_45px_rgba(15,23,42,0.08)]">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-sky-300/60 bg-gradient-to-r from-sky-50 to-cyan-50 px-3 py-1">
              <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-sky-500">
                STEP 2
              </span>
              <span className="text-[11px] font-medium text-slate-700">
                デザインテンプレート &amp; AI自由度
              </span>
            </div>

            <div className="flex flex-col gap-6 lg:flex-row">
              {/* 左：テンプレ＋AIスライダー */}
              <div className="flex-1 space-y-5">
                <p className="text-[11px] text-slate-500">
                  好みのテンプレートを選んで、AI自由度のスライダーを動かすだけ。
                  右に寄せるほど、レイアウトや世界観の“おまかせ度”が上がります。
                </p>

                {/* WORLDVIEW BUTTONS（カラーチップ付き） */}
                <div>
                  <p className="mb-2 text-[11px] font-medium text-slate-700">
                    世界観テンプレート
                  </p>
                  <div className="grid grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-5">
                    {WORLDVIEWS.map((wv) => {
                      const c = WORLDVIEW_COLORS[wv];
                      const isActive =
                        selectedWorldview === (wv as WorldviewBase);

                      return (
                        <button
                          key={wv}
                          type="button"
                          onClick={() => {
                            setSelectedWorldview(wv as WorldviewBase);
                            const preset = getWorldviewPreset(
                              wv as WorldviewBase
                            );
                            setDesignDefaults({
                              worldviewBase: preset.id,
                              patternBase: preset.patternBase,
                              surfaceStyle: preset.surfaceStyle,
                              showcaseStyle: preset.showcaseStyle,
                              layoutPref: preset.layoutPref,
                              languageMode: preset.languageMode,
                              fontPreset: preset.fontPreset,
                            });
                          }}
                          className={[
                            "relative flex flex-col gap-1 overflow-hidden rounded-lg border px-3 py-2 text-left text-xs font-medium transition-all",
                            isActive
                              ? "scale-[1.02] border-sky-400 bg-sky-50 text-slate-900 shadow-sm shadow-sky-200"
                              : "border-slate-200 bg-white text-slate-700 hover:bg-sky-50/60",
                          ].join(" ")}
                        >
                          {/* カラーチップ3つ */}
                          <div className="flex items-center gap-1">
                            <span
                              className="h-2.5 w-2.5 rounded-full"
                              style={{ backgroundColor: c.primary }}
                            />
                            <span
                              className="h-2.5 w-2.5 rounded-full"
                              style={{ backgroundColor: c.accent }}
                            />
                            <span
                              className="h-2.5 w-2.5 rounded-full border border-slate-200"
                              style={{ backgroundColor: c.bg }}
                            />
                          </div>
                          <span className="capitalize">
                            {wv.charAt(0).toUpperCase() + wv.slice(1)}
                          </span>
                          {isActive && (
                            <span className="pointer-events-none absolute inset-0 bg-gradient-to-r from-cyan-500/5 to-sky-400/5" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* AI自由度 1 本スライダー */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1">
                      <label className="text-xs font-medium text-slate-900">
                        AI自由度
                      </label>
                      <span
                        className="inline-flex h-4 w-4 cursor-default items-center justify-center rounded-full border border-slate-300 text-[10px] text-slate-500"
                        title={
                          "0〜20%：テンプレートをほぼ忠実に再現\n" +
                          "21〜60%：色やレイアウトをほどよく調整\n" +
                          "61〜100%：構成や文章を大胆にアレンジ"
                        }
                      >
                        ?
                      </span>
                    </div>
                    <span className="tabular-nums text-[11px] text-slate-600">
                      {aiSwing}%
                    </span>
                  </div>

                  <AiDegreeSlider
                    name="aiSwing"
                    value={aiSwing}
                    onChange={(val) => setAiSwing(val)}
                  />

                  {/* フォーム送信用 hidden（fallback との二重ガード） */}
                  <input
                    type="hidden"
                    name="aiSwing"
                    value={aiSwing}
                  />

                  <div className="mt-1 flex justify-between text-[10px] text-slate-500">
                    <span>0%：ほぼそのまま</span>
                    <span>50%：ほどよくAI調整</span>
                    <span>100%：かなり攻める</span>
                  </div>
                </div>

                {/* hidden fields */}
                <input
                  type="hidden"
                  name="worldviewBase"
                  value={designDefaults.worldviewBase}
                />
                <input
                  type="hidden"
                  name="patternBase"
                  value={designDefaults.patternBase}
                />
                <input
                  type="hidden"
                  name="surfaceStyle"
                  value={designDefaults.surfaceStyle}
                />
                <input
                  type="hidden"
                  name="showcaseStyle"
                  value={designDefaults.showcaseStyle}
                />
                <input
                  type="hidden"
                  name="layoutPref"
                  value={designDefaults.layoutPref}
                />
                <input
                  type="hidden"
                  name="languageMode"
                  value={designDefaults.languageMode}
                />
                <input
                  type="hidden"
                  name="fontPreset"
                  value={designDefaults.fontPreset}
                />
              </div>

              {/* 右：Hero プレビューエリア（雰囲気重視・ミニチュア版） */}
              <div className="hidden flex-1 md:block">
                <div className="sticky top-6">
                  {/* ヘッダー情報 */}
                  <div className="mb-3 flex items-center justify-between px-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-bold tracking-wider text-slate-400">
                        PREVIEW
                      </span>
                      <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-medium text-slate-500 capitalize">
                        {selectedWorldview}
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-400">
                      AI Strength: {aiSwing}%
                    </span>
                  </div>

                  {/* 柄付きのコンテナ */}
                  <div
                    className="relative overflow-hidden rounded-2xl border border-slate-200 shadow-xl transition-all duration-500"
                    style={{
                      height: "420px",
                      ...buildPreviewBackgroundStyle(selectedWorldview),
                    }}
                  >
                    {/* 内側の「ミニブラウザ」ウィンドウ */}
                    <div className="absolute inset-x-6 bottom-0 top-8 overflow-hidden rounded-t-xl bg-white shadow-2xl ring-1 ring-slate-900/5">
                      {/* ブラウザのアドレスバー風装飾 */}
                      <div className="flex items-center gap-1.5 border-b border-slate-100 bg-slate-50/80 px-4 py-3 backdrop-blur-sm">
                        <div className="flex gap-1.5">
                          <span className="h-2.5 w-2.5 rounded-full bg-rose-400/80" />
                          <span className="h-2.5 w-2.5 rounded-full bg-amber-400/80" />
                          <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/80" />
                        </div>
                        <div className="ml-3 h-2 w-32 rounded-full bg-slate-200/60" />
                      </div>

                      {/* サイトの中身（縮小表示） */}
                      <div className="h-full w-full overflow-hidden bg-white">
                        <div className="origin-top-left h-[153.8%] w-[153.8%] scale-[0.65]">
                          <AiPortfolioHeroSwitcher
                            section={mockContent.sections[0]}
                            theme={mockTheme}
                            variant={mockVariant}
                          />

                          {/* 続きのセクションがある雰囲気を出すダミー */}
                          <div className="px-6 py-8 md:px-10">
                            <div className="mb-4 h-4 w-1/3 rounded bg-slate-100" />
                            <div className="space-y-2">
                              <div className="h-2 w-full rounded bg-slate-50" />
                              <div className="h-2 w-5/6 rounded bg-slate-50" />
                              <div className="h-2 w-4/6 rounded bg-slate-50" />
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Webサイト上の「マウスカーソル」演出 */}
                      <div className="pointer-events-none absolute bottom-10 right-10 drop-shadow-md">
                        <svg
                          width="24"
                          height="24"
                          viewBox="0 0 24 24"
                          fill="none"
                          xmlns="http://www.w3.org/2000/svg"
                          className="fill-current text-slate-800"
                        >
                          <path d="M5.5 3.21V20.8C5.5 21.61 6.52 22.01 7.1 21.43L10.37 18.16C10.65 17.88 11.03 17.72 11.43 17.72H19.2C20.27 17.72 20.8 16.42 20.05 15.67L5.5 3.21Z" />
                        </svg>
                      </div>
                    </div>
                  </div>

                  <p className="mt-3 text-center text-[10px] text-slate-400">
                    世界観ごとの「空気感」をシミュレーションしています
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* ================= STEP3 掲載セクション ================= */}
          <section className="rounded-3xl border border-slate-200 bg-white/95 p-6 shadow-[0_18px_45px_rgba(15,23,42,0.08)]">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-emerald-300/60 bg-gradient-to-r from-emerald-50 to-sky-50 px-3 py-1">
              <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-emerald-500">
                STEP 3
              </span>
              <span className="text-[11px] font-medium text-slate-700">
                掲載セクション
              </span>
            </div>
            <p className="text-[11px] text-slate-500">
              チェックしたものだけ出力されます。迷ったら全部ONでもOKです。
            </p>

            <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
              {(
                Object.keys(
                  SECTION_LABELS
                ) as (keyof AiPortfolioPayload["sections"])[]
              ).map((key) => (
                <label
                  key={key}
                  className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 transition-colors hover:border-sky-300 hover:bg-white"
                >
                  <input
                    type="checkbox"
                    name={`sec_${key}`}
                    defaultChecked={DEFAULT_SECTIONS.includes(
                      key as (typeof DEFAULT_SECTIONS)[number]
                    )}
                    className="h-4 w-4 rounded border-slate-300 text-sky-500 focus:ring-sky-400"
                  />
                  <span className="text-xs">{SECTION_LABELS[key]}</span>
                </label>
              ))}
            </div>
          </section>

          {/* ================= STEP4 作品画像 ================= */}
          <section className="rounded-3xl border border-slate-200 bg-white/95 p-6 shadow-[0_18px_45px_rgba(15,23,42,0.08)]">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-sky-300/60 bg-gradient-to-r from-sky-50 to-cyan-50 px-3 py-1">
              <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-sky-500">
                STEP 4
              </span>
              <span className="text-[11px] font-medium text-slate-700">
                作品画像（最大5枚）
              </span>
            </div>
            <p className="text-[11px] text-slate-500">
              画像が多いほどギャラリーがリッチになります（5枚推奨）。
            </p>

            {/* 枠の視覚的強化 */}
            <div
              className={`mt-4 rounded-2xl border bg-slate-50/80 p-4 transition-colors ${
                images.length > 0
                  ? "border-sky-300/50 shadow-sm"
                  : "border-dashed border-slate-500"
              }`}
            >
              <AiPortfolioImageUploader
                value={images}
                onChange={setImages}
                max={6}
              />
            </div>
          </section>

{/* ================= STEP5 SNS & リンク ================= */}
<section className="rounded-3xl border border-slate-200 bg-white/95 p-6 shadow-[0_18px_45px_rgba(15,23,42,0.08)]">
  <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-indigo-300/60 bg-gradient-to-r from-indigo-50 to-sky-50 px-3 py-1">
    <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-indigo-500">
      STEP 5
    </span>
    <span className="text-[11px] font-medium text-slate-700">
      SNS &amp; リンク
    </span>
  </div>

  <p className="text-[11px] text-slate-500">
    ポートフォリオに表示したいSNSやWebサイトがあれば入力してください。
    アカウントIDだけでもOKです（@なしでも大丈夫です）。
  </p>

  <div className="mt-4 space-y-3">
    {/* X（旧Twitter） */}
    <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-800 shadow-[0_1px_2px_rgba(15,23,42,0.03)] transition-colors focus-within:border-sky-400 focus-within:bg-white">
      <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-slate-900 text-[11px] font-semibold text-white">
        X
      </div>
      <div className="flex-1">
        <div className="flex items-center justify-between">
          <span className="font-medium text-slate-700">X（旧Twitter）</span>
          <span className="text-[10px] text-slate-400">任意</span>
        </div>
        <input
          name="tw"
          type="text"
          autoComplete="off"
          placeholder="例：@your_id または https://x.com/your_id"
          className="mt-1 w-full border-none bg-transparent px-0 py-1 text-[12px] text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-0"
        />
      </div>
    </label>

    {/* Instagram */}
    <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-800 shadow-[0_1px_2px_rgba(15,23,42,0.03)] transition-colors focus-within:border-sky-400 focus-within:bg-white">
      <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-pink-500 to-amber-400 text-[11px] font-semibold text-white">
        IG
      </div>
      <div className="flex-1">
        <div className="flex items-center justify-between">
          <span className="font-medium text-slate-700">Instagram</span>
          <span className="text-[10px] text-slate-400">任意</span>
        </div>
        <input
          name="ig"
          type="text"
          autoComplete="off"
          placeholder="例：@your_id または https://www.instagram.com/your_id"
          className="mt-1 w-full border-none bg-transparent px-0 py-1 text-[12px] text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-0"
        />
      </div>
    </label>

    {/* Behance */}
    <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-800 shadow-[0_1px_2px_rgba(15,23,42,0.03)] transition-colors focus-within:border-sky-400 focus-within:bg-white">
      <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-slate-900 text-[11px] font-semibold text-white">
        Be
      </div>
      <div className="flex-1">
        <div className="flex items-center justify-between">
          <span className="font-medium text-slate-700">Behance</span>
          <span className="text-[10px] text-slate-400">任意</span>
        </div>
        <input
          name="be"
          type="text"
          autoComplete="off"
          placeholder="例：your_id または https://www.behance.net/your_id"
          className="mt-1 w-full border-none bg-transparent px-0 py-1 text-[12px] text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-0"
        />
      </div>
    </label>

    {/* Webサイト */}
    <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-800 shadow-[0_1px_2px_rgba(15,23,42,0.03)] transition-colors focus-within:border-sky-400 focus-within:bg-white">
      <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-sky-500 text-[11px] font-semibold text-white">
        WWW
      </div>
      <div className="flex-1">
        <div className="flex items-center justify-between">
          <span className="font-medium text-slate-700">Webサイト</span>
          <span className="text-[10px] text-slate-400">任意</span>
        </div>
        <input
          name="site"
          type="text"
          autoComplete="off"
          placeholder="例：your-site.com または https://your-site.com"
          className="mt-1 w-full border-none bg-transparent px-0 py-1 text-[12px] text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-0"
        />
        <p className="mt-0.5 text-[10px] text-slate-400">
          「example.com」のようにドメインだけでもOKです（https:// は自動補完）。
        </p>
      </div>
    </label>
  </div>

  <p className="mt-2 text-[10px] text-slate-500">
    入力したリンクは、生成されたポートフォリオのフッター付近に
    アイコン付きのボタンとして表示されます。
  </p>
</section>


{/* ================= STEP6 提供サービス ================= */}
<section className="rounded-3xl border border-slate-200 bg-white/95 p-6 shadow-[0_18px_45px_rgba(15,23,42,0.08)]">
  <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-amber-300/60 bg-gradient-to-r from-amber-50 to-sky-50 px-3 py-1">
    <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-amber-500">
      STEP 6
    </span>
    <span className="text-[11px] font-medium text-slate-700">
      提供サービス（任意）
    </span>
  </div>

  <p className="text-[11px] text-slate-500 leading-relaxed">
    依頼を受けられるメニューがあれば入力してください。<br />
    例：イラスト制作、アイコン制作、表紙デザイン、ロゴ制作など。<br />
    空欄の場合は「Services」セクションは自動的に非表示になります。
  </p>

  {/* 動的サービスカード群 */}
  <div className="mt-4 grid gap-4 md:grid-cols-3">
    {serviceIds.map((id, index) => (
      <div
        key={id}
        className="relative rounded-xl border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-4 shadow-sm transition-colors focus-within:border-sky-400"
      >
        <div className="mb-2 flex items-center justify-between">
          <span className="text-[11px] font-medium text-slate-600">
            サービス {index + 1}
          </span>
          {serviceIds.length > 1 && (
            <button
              type="button"
              onClick={() => handleRemoveService(id)}
              className="rounded-full p-1 text-[11px] text-slate-400 transition hover:bg-slate-200 hover:text-slate-700"
              aria-label="このサービスを削除"
            >
              ✕
            </button>
          )}
        </div>

        {/* サービス名 */}
        <label className="block text-[11px] font-medium text-slate-600 mb-1">
          サービス名
        </label>
        <input
          name={`svc${id}_name`}
          placeholder="例：キャラクターイラスト制作"
          className="mb-3 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-sky-400 focus:outline-none focus:ring-1 focus:ring-sky-300"
        />

        {/* 価格（数値 × 単位） */}
        <label className="block text-[11px] font-medium text-slate-600 mb-1">
          価格（目安）
        </label>
        <div className="relative mb-3">
          <input
            type="number"
            min={0}
            inputMode="numeric"
            name={`svc${id}_price`}
            placeholder="例：20000"
            className="w-full rounded-lg border border-slate-200 bg-white pr-16 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-sky-400 focus:outline-none focus:ring-1 focus:ring-sky-300"
          />
          <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[12px] text-slate-500">
            円〜
          </div>
        </div>

        {/* 説明（任意） */}
        <label className="block text-[11px] font-medium text-slate-600 mb-1">
          サービス説明（任意）
        </label>
        <textarea
          name={`svc${id}_desc`}
          placeholder="例：等身・ミニキャラどちらにも対応可能です。背景追加や小物追加もご相談ください。"
          rows={3}
          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-sky-400 focus:outline-none focus:ring-1 focus:ring-sky-300"
        />
      </div>
    ))}
  </div>

  {/* 追加ボタン */}
  <div className="mt-4">
    <button
      type="button"
      onClick={handleAddService}
      className="inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-50 px-3 py-1.5 text-[11px] font-medium text-amber-700 shadow-sm hover:bg-amber-100"
    >
      ＋ サービスを追加する
    </button>
  </div>

  <p className="mt-3 text-[10px] text-slate-500 leading-relaxed">
    書いた内容は、ポートフォリオでは「サービスカード」として美しく整形されて表示されます。<br />
    価格は目安でOKです。説明文は短くても構いません。
  </p>
</section>

{/* ================= STEP7 スキルタグ ================= */}

<section className="rounded-3xl border border-slate-200 bg-white/95 p-6 shadow-[0_18px_45px_rgba(15,23,42,0.08)]">
  <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-fuchsia-300/60 bg-gradient-to-r from-fuchsia-50 to-sky-50 px-3 py-1">
    <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-fuchsia-500">
      STEP 7
    </span>
    <span className="text-[11px] font-medium text-slate-700">
      スキルタグ（任意）
    </span>
  </div>

  <p className="text-[11px] text-slate-500 leading-relaxed">
    得意なジャンルや使用ツールをタグとして選択してください。<br />
    さらに細かいスキルは、下の入力欄にカンマ区切りで追加できます。
  </p>

  {/* プリセットスキルタグ（クリックでON/OFF） */}
  <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50/70 px-3 py-3">
    <div className="mb-1 text-[10px] font-medium text-slate-500">
      よく使われるスキル：
    </div>
    <div className="flex flex-wrap gap-2">
      {illustratorSkillPresets.map((tag) => {
        const active = selectedSkillPresets.includes(tag);
        return (
          <button
            key={tag}
            type="button"
            onClick={() => toggleSkillPreset(tag)}
            className={[
              "rounded-full border px-2.5 py-1 text-[11px] transition-colors",
              active
                ? "border-fuchsia-400 bg-white text-fuchsia-700 shadow-[0_1px_4px_rgba(217,70,239,0.35)]"
                : "border-slate-200 bg-white/80 text-slate-700 hover:border-fuchsia-300 hover:text-fuchsia-700",
            ].join(" ")}
          >
            {tag}
          </button>
        );
      })}
    </div>
  </div>

  {/* プリセット選択結果を hidden で送る */}
  <input
    type="hidden"
    name="skill_presets"
    value={selectedSkillPresets.join(",")}
  />

  {/* 自由入力欄はそのまま残す */}
  <input
    name="skills"
    placeholder="例: SDキャラ, ロゴデザイン, アニメ塗り, 背景, ローファイテイスト など"
    className="mt-3 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-sky-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-sky-300"
  />
  <p className="mt-1 text-[11px] text-slate-500">
    カンマ区切りで入力してください（目安: 合計で 5〜12個程度）。<br />
    プリセットで選んだタグと自由入力は、送信時にまとめてスキルタグとして扱われます。
  </p>
</section>



          {/* ================= Submit ================= */}
          <div className="flex items-center justify-between gap-4">
            <div className="text-[11px] text-slate-500">
              ※ 送信後、数秒でプレビューへ移動します
            </div>
            <button
              disabled={loading}
              className="inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-sky-500 to-cyan-400 px-5 py-3 text-sm font-semibold text-white shadow-md shadow-sky-300/40 hover:opacity-95 hover:shadow-lg hover:shadow-sky-300/60 disabled:opacity-60"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  生成中...
                  <svg
                    className="h-4 w-4 animate-spin text-white"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                </span>
              ) : (
                "送信してプレビューを見る"
              )}
            </button>
          </div>

        {msg && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {msg}
          </div>
        )}
        </form>

        {/* ================= モバイル専用：プレビュー FAB ================= */}
        <button
          type="button"
          onClick={() => setPreviewOpen(true)}
          className="fixed bottom-4 right-4 z-40 inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-slate-50 shadow-lg shadow-slate-900/40 hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-400 focus:ring-offset-2 focus:ring-offset-slate-900 md:hidden"
        >
          <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-sky-400 text-[10px] text-slate-900">
            ⚡
          </span>
          <span>プレビューを見る</span>
        </button>

        {/* ================= モバイル専用：プレビューモーダル ================= */}
{previewOpen && (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm px-4">
    {/* モーダルパネル */}
    <div className="w-full max-w-md max-h-[90vh] rounded-3xl overflow-hidden bg-slate-900 text-slate-50 shadow-2xl">
      
      {/* モーダルヘッダー */}
      <div className="flex items-center justify-between border-b border-slate-800 px-5 py-3">
        <div className="flex flex-col">
          <span className="text-[11px] font-semibold tracking-[0.16em] text-slate-400">
            PREVIEW
          </span>
          <span className="text-[11px] text-sky-300">
            {selectedWorldview} ・ AI Strength {aiSwing}%
          </span>
        </div>

        <button
          type="button"
          onClick={() => setPreviewOpen(false)}
          className="rounded-full p-1 text-slate-400 transition hover:bg-slate-700 hover:text-white"
        >
          ✕
        </button>
      </div>

      {/* モーダル本体 */}
      <div className="overflow-auto p-4">
        <div
          className="mx-auto max-w-sm rounded-xl border border-slate-700 shadow-xl"
          style={{
            overflow: "hidden",
            backgroundColor: mockTheme.colorBG,
            backgroundImage: buildPreviewBackgroundStyle(selectedWorldview).backgroundImage,
            backgroundSize: buildPreviewBackgroundStyle(selectedWorldview).backgroundSize,
          }}
        >
          {/* ミニブラウザ */}
          <div className="flex items-center gap-1.5 border-b border-slate-700 bg-slate-800/70 px-4 py-3">
            <div className="flex gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-rose-400/80" />
              <span className="h-2.5 w-2.5 rounded-full bg-amber-400/80" />
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/80" />
            </div>
          </div>

          {/* Hero本体（縮小） */}
          <div className="h-full w-full overflow-hidden bg-white">
            <div className="origin-top-left h-[153.8%] w-[153.8%] scale-[0.65]">
              <AiPortfolioHeroSwitcher
                section={mockContent.sections[0]}
                theme={mockTheme}
                variant={mockVariant}
              />
            </div>
          </div>
        </div>

        <p className="mt-3 text-center text-[10px] text-slate-400">
          世界観テンプレに応じた背景柄で、スマホサイズの見え方をシミュレーションしています
        </p>
      </div>
    </div>
  </div>

          
        )}
      </div>
    </main>
  );
}
