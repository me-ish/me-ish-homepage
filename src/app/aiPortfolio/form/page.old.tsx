// src/app/aiPortfolio/form/page.tsx
"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import type { Design, Content } from "@/lib/aiPortfolio/aiPortfolio.schema";
import type { VariantSpec, PatternId } from "@/lib/aiPortfolio/aiPortfolio.variant.base";
import AiPortfolioImageUploader, {
  type AiPortfolioImageItem,
} from "@/components/aiPortfolio/aiPortfolioImageUploader";
import { AiPortfolioHeroSwitcher } from "@/components/aiPortfolio/sections/AiPortfolioHeroSwitcher";
import {
  getWorldviewPreset,
  type WorldviewBase,
} from "@/lib/aiPortfolio/aiPortfolio.worldviewPresets";
import { AiDegreeSlider } from "@/components/aiPortfolio/AiDegreeSlider";

// ✅ 追加：Rendererと同じ背景合成関数を参照（プレビューと本番のズレを撲滅）
import { buildBackgroundStyle } from "@/lib/aiPortfolio/aiPortfolio.background";

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

  avatarUrl?: string;

  sections: {
    hero: boolean;
    about: boolean;
    works: boolean;
    services: boolean;
    skills: boolean;
    contact: boolean;
    // ✅ CTAは廃止
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

  // ※内部互換のため aiStrength は残す（UI文言だけ非AI化）
  aiStrength: {
    worldview: number;
    pattern: number;
    surface: number;
    showcase: number;
    layout: number;
    language: number;
    font: number;

    // ✅ 追加（互換）
    overall?: number;
    copywriting?: number;
    color?: number;
    structure?: number;
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

// worldview ごとの Hero 背景グラデーション（※フォーム内mock用）
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
  // ※luxury は preset.bgGradient が無い場合のフォールバック。暗めに寄せたいならここを調整してもOK
  luxury: "linear-gradient(145deg, #020617 0%, #0b1220 55%, #111827 100%)",
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
const DEFAULT_SECTIONS = ["hero", "about", "works", "contact"] as const;

const SECTION_LABELS: Record<keyof AiPortfolioPayload["sections"], string> = {
  hero: "Hero（第一印象）",
  about: "About（自己紹介）",
  works: "Works（作品）",
  services: "Services（依頼内容・料金）",
  skills: "Skills（得意領域）",
  contact: "Contact（問い合わせ）",
};

function calcProgress(payload: Partial<AiPortfolioPayload>, imagesCount: number) {
  let score = 0;

  if (payload.email) score++;
  if (payload.name) score++;
  if (payload.title) score++;
  if (payload.tagline) score++;
  if (payload.bio) score++;
  if (imagesCount > 0) score++;

  const maxScore = 6;
  return Math.min(100, Math.round((score / maxScore) * 100));
}

/* =========================================================
 * MAIN COMPONENT
 * ========================================================= */

type DraftState = {
  requestId: string | null;
  status: "idle" | "creating" | "ready" | "error";
  error?: string | null;
};

export default function AiPortfolioFormPage() {
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [images, setImages] = useState<AiPortfolioImageItem[]>([]);
  const formRef = useRef<HTMLFormElement | null>(null);

  // draft（画像を選んだ瞬間アップロード用）
  const [draft, setDraft] = useState<DraftState>({
    requestId: null,
    status: "idle",
    error: null,
  });

  // プロフィール画像
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState<string | null>(null);
  const [avatarInputUrl, setAvatarInputUrl] = useState<string>("");
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarUploadUrl, setAvatarUploadUrl] = useState<string | null>(null);

  // ✅ Avatar input をリセットできるように ref 化
  const avatarInputRef = useRef<HTMLInputElement | null>(null);

  // ✅ アップロードの「世代ID」と「進行中Promise」
  const avatarUploadGenRef = useRef(0);
  const avatarUploadPromiseRef = useRef<Promise<void> | null>(null);

  // ✅ objectURL cleanup で確実に参照するための ref
  const avatarPreviewUrlRef = useRef<string | null>(null);

  // ★ モバイル用プレビューモーダル
  const [previewOpen, setPreviewOpen] = useState(false);

  // ===============================
  // AURA Intro (dev replay friendly)
  // ===============================
  const INTRO_KEY = "meish_aura_intro_seen";
  const [showIntro, setShowIntro] = useState(false);
  const [introNonce, setIntroNonce] = useState(0);

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

  // 調整度 (0-100) ※内部変数名は aiSwing のまま互換維持
  const [aiSwing, setAiSwing] = useState<number>(40);

  // 調整度ヘルプ（SP対応：タップで開く）
const [tuningHelpOpen, setTuningHelpOpen] = useState(false);


  // スキルプリセット選択状態
  const [selectedSkillPresets, setSelectedSkillPresets] = useState<string[]>([]);
  function toggleSkillPreset(tag: string) {
    setSelectedSkillPresets((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  }

  // サービスカード動的追加
  const [serviceIds, setServiceIds] = useState<number[]>([1]);
  const handleAddService = () => {
    setServiceIds((prev) => {
      const nextId = (prev[prev.length - 1] ?? 0) + 1;
      // ✅ 追加したidの入力状態も用意
      setServiceNames((m) => ({ ...m, [nextId]: "" }));
      return [...prev, nextId];
    });
  };

  const handleRemoveService = (id: number) => {
    setServiceIds((prev) => {
      if (prev.length <= 1) return prev;
      const next = prev.filter((x) => x !== id);
      // ✅ 削除したidの入力状態も消す
      setServiceNames((m) => {
        const copy = { ...m };
        delete copy[id];
        return copy;
      });
      return next;
    });
  };

    // ===============================
  // STEP3: 掲載セクション（controlled）
  // ===============================
  const [sectionChecked, setSectionChecked] = useState<AiPortfolioPayload["sections"]>({
    hero: true,
    about: true,
    works: true,
    services: false,
    skills: false,
    contact: true,
  });

  
  // ===============================
  // STEP6/7: 入力検知（自動でチェックONにするため）
  // ===============================
  const [serviceNames, setServiceNames] = useState<Record<number, string>>({ 1: "" });
  const [manualSkillsInput, setManualSkillsInput] = useState<string>("");


  // 入力のライブ値
  const [live, setLive] = useState<Partial<AiPortfolioPayload>>({});
  const progress = useMemo(() => calcProgress(live, images.length), [live, images.length]);

  // 初回だけ Intro を出す（localStorage で制御）
  useEffect(() => {
    try {
      const seen = localStorage.getItem(INTRO_KEY);
      if (!seen) {
        setShowIntro(true);
        setIntroNonce((n) => n + 1);
      }
    } catch {
      // localStorage が使えない環境でも壊さない
    }
  }, []);

  // ---------------------------------------------
  // Hero プレビュー用 Mock
  // ---------------------------------------------
  const colors = WORLDVIEW_COLORS[selectedWorldview];

  // ✅ プレビュー背景は「Rendererと同じ buildBackgroundStyle(theme, variant)」で作る
  // ✅ theme 側には worldviewPreset 由来の bgGradient / patternLayers / textureLayers / bgStyle を注入
  const presetForPreview = useMemo(() => getWorldviewPreset(selectedWorldview), [selectedWorldview]);

  const mockTheme: Design["theme"] = useMemo(() => {
    const anyPreset = presetForPreview as any;

    const presetPatternLayers: string[] = Array.isArray(anyPreset.patternLayers)
      ? anyPreset.patternLayers
      : [];

    const presetTextureLayers: string[] = Array.isArray(anyPreset.textureLayers)
      ? anyPreset.textureLayers
      : [];

    const presetBgStyle = (anyPreset.bgStyle as React.CSSProperties | undefined) ?? undefined;

    const bgGradient: string | undefined =
      (typeof anyPreset.bgGradient === "string" && anyPreset.bgGradient.trim()
        ? anyPreset.bgGradient
        : WORLDVIEW_GRADIENTS[selectedWorldview]) ?? undefined;

    const patternColor: string =
      typeof anyPreset.patternColor === "string" && anyPreset.patternColor.trim()
        ? anyPreset.patternColor
        : colors.primary;

    const backgroundPattern: PatternId | "none" = (presetForPreview.patternBase as any) ?? "none";

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

      // ✅ Rendererと整合させるキー群
      bgGradient,
      bgStyle: presetBgStyle,
      patternLayers:
        presetPatternLayers.length > 0
          ? presetPatternLayers
          : backgroundPattern === "none"
          ? []
          : [backgroundPattern],
      textureLayers: presetTextureLayers,

      patternColor,

      // その他（フォームプレビューで必要）
      backgroundPattern,
      languageMode: designDefaults.languageMode as any,
      fontPreset: designDefaults.fontPreset as any,
    } as any;
  }, [presetForPreview, selectedWorldview, colors, designDefaults]);

  // ✅ Generator (applyUiProfileToVariant) の閾値に合わせる: 0-20 base / 21-60 忠実 / 61-99 隣接 / 100 全世界観
  const mockVariant: VariantSpec = useMemo(() => {
    const layout = aiSwing > 60 ? "split" : "centerBasic";
    const surface = aiSwing > 20 ? "glass" : "card";

    return {
      worldview: selectedWorldview,
      layout: layout as any,
      surface: surface as any,
      pattern: "none" as any,
      showcase: "gallery" as any,
      variantId: "mock",
      shadow: aiSwing > 60 ? "deep" : "soft",
      radius: aiSwing >= 100 ? "extraLarge" : "large",
    } as any;
  }, [selectedWorldview, aiSwing]);

  const mockContent: Content = {
    sections: [
      {
        type: "hero",
        headings: [live.name || "田中太郎", live.title || "Webデザイナー / イラストレーター"],
        paragraphs: [
          live.tagline ||
            "クリエイティビティと技術を組み合わせた、ユーザー中心のデジタル表現をつくります。",
        ],
      },
    ],
  };

  // ✅ “共通関数参照” 本体：Rendererと同じ合成関数を使う
  const previewBgStyle = useMemo(
    () => buildBackgroundStyle(mockTheme as any, mockVariant as any),
    [mockTheme, mockVariant]
  );

  /* ---------------------------------------------
   * 小ユーティリティ
   * --------------------------------------------- */

  function bindLive(name: keyof AiPortfolioPayload) {
    return {
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
        setLive((prev) => ({
          ...prev,
          [name]: e.target.value,
        })),
    };
  }

  function getFormValue(name: string): string {
    const form = formRef.current;
    if (!form) return "";
    const el = form.elements.namedItem(name) as HTMLInputElement | HTMLTextAreaElement | null;
    return (el?.value ?? "").toString();
  }

  /* ---------------------------------------------
   * Draft 作成（画像アップロードのため）
   * --------------------------------------------- */

  async function createDraftIfNeeded(email: string, name: string) {
    if (!email) {
      setMsg("先にメールアドレスを入力してください（画像アップロードに必要です）。");
      throw new Error("email_required_for_draft");
    }

    if (draft.requestId) return draft.requestId;

    setDraft((p) => ({ ...p, status: "creating", error: null }));
    try {
      const res = await fetch("/api/aiPortfolio/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, name }),
      });

      const json = await res.json().catch(() => null);

      if (!res.ok || !json?.ok || !json?.requestId) {
        const message = json?.error ? String(json.error) : "draft_create_failed";
        setDraft({ requestId: null, status: "error", error: message });
        setMsg("下書き作成に失敗しました。時間をおいて再度お試しください。");
        throw new Error(message);
      }

      setDraft({
        requestId: String(json.requestId),
        status: "ready",
        error: null,
      });
      return String(json.requestId);
    } catch (e: any) {
      const message = e?.message ?? String(e);
      setDraft({ requestId: null, status: "error", error: message });
      throw e;
    }
  }

  // ---------------------------------------------
  // email入力後に draft を自動作成（作品画像アップロードの前提）
  // ---------------------------------------------
  useEffect(() => {
    if (draft.requestId || draft.status === "creating") return;

    const email = (live.email ?? "").trim();
    if (!email) return;

    const looksLikeEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    if (!looksLikeEmail) return;

    const name = (live.name ?? "").trim();

    createDraftIfNeeded(email, name).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live.email, live.name, draft.requestId, draft.status]);

  // ---------------------------------------------
  // Step6/7 入力があれば services/skills を自動ON
  // ---------------------------------------------
  useEffect(() => {
    const hasService = Object.values(serviceNames).some((v) => (v ?? "").trim().length > 0);
    if (!hasService) return;

    setSectionChecked((prev) => (prev.services ? prev : { ...prev, services: true }));
  }, [serviceNames]);

  useEffect(() => {
    const hasSkill =
      selectedSkillPresets.length > 0 || (manualSkillsInput ?? "").trim().length > 0;
    if (!hasSkill) return;

    setSectionChecked((prev) => (prev.skills ? prev : { ...prev, skills: true }));
  }, [selectedSkillPresets, manualSkillsInput]);


  /* ---------------------------------------------
   * Avatar アップロード（Public read / API write）
   * --------------------------------------------- */
  async function uploadAvatarToServer(file: File, requestId: string, uploadGen: number) {
    setAvatarUploading(true);
    setMsg(null);

    try {
      const fd = new FormData();
      fd.append("file", file);

      const res = await fetch(`/api/aiPortfolio/upload/avatar/${requestId}`, {
        method: "POST",
        body: fd,
      });

      const json = await res.json().catch(() => null);

      // ✅ 世代チェック
      if (avatarUploadGenRef.current !== uploadGen) return;

      if (!res.ok || !json?.ok || !json?.url) {
        console.error("[avatar upload] failed", json);
        setMsg("プロフィール画像のアップロードに失敗しました。");
        setAvatarUploadUrl(null);
        return;
      }

      setAvatarUploadUrl(String(json.url));
    } catch (e) {
      console.error(e);
      if (avatarUploadGenRef.current === uploadGen) {
        setMsg("プロフィール画像のアップロード中に通信エラーが発生しました。");
        setAvatarUploadUrl(null);
      }
    } finally {
      if (avatarUploadGenRef.current === uploadGen) {
        setAvatarUploading(false);
      }
    }
  }

  /* ---------------------------------------------
   * Avatar 選択/Drop ハンドラ
   * --------------------------------------------- */
  const handleAvatarFile = async (file: File | null) => {
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setMsg("画像ファイルを選択してください。");
      return;
    }

    // ✅ 既存 objectURL を確実に revoke
    if (avatarPreviewUrlRef.current) {
      URL.revokeObjectURL(avatarPreviewUrlRef.current);
    }

    const objectUrl = URL.createObjectURL(file);
    setAvatarPreviewUrl(objectUrl);
    avatarPreviewUrlRef.current = objectUrl;

    setAvatarInputUrl(file.name);

    // ✅ 新しいアップロード開始：世代を進める
    const uploadGen = avatarUploadGenRef.current + 1;
    avatarUploadGenRef.current = uploadGen;

    // ✅ 新規アップロード開始時は前の成功URLを落とす（誤送信防止）
    setAvatarUploadUrl(null);

    const email = getFormValue("email").trim();
    const name = getFormValue("name").trim();

    // input をリセット（同じファイルを選び直せるように）
    if (avatarInputRef.current) avatarInputRef.current.value = "";

    try {
      const requestId = await createDraftIfNeeded(email, name);

      const p = uploadAvatarToServer(file, requestId, uploadGen).then(() => undefined);
      avatarUploadPromiseRef.current = p;
      await p;
    } catch {
      // createDraftIfNeeded 側で msg を出すのでここは抑制
    }
  };

  const handleAvatarFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    await handleAvatarFile(file);
  };

  const handleAvatarDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0] ?? null;
    await handleAvatarFile(file);
  };

  const handleAvatarDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  // ✅ unmount cleanup（ref経由で確実に解放）
  useEffect(() => {
    return () => {
      const url = avatarPreviewUrlRef.current;
      if (url) URL.revokeObjectURL(url);
    };
  }, []);

  /* ---------------------------------------------
 * Magic Fill（イラストレーター｜汎用）
 * --------------------------------------------- */
function handleMagicFill() {
  const form = formRef.current;
  if (!form) return;

  const sample = {
    email: "sample.creator+illustrator@example.com",
    name: "サンプル イラスト",
    title: "イラストレーター / キャラクターデザイナー",
    tagline: "やさしい色づかいで、世界観のあるイラストを制作します",
    bio: [
      "フリーランスのイラストレーターとして、SNSアイコン、配信サムネイル、キャラクターデザインなどを中心に制作しています。",
      "ご依頼の目的や使用シーンを丁寧に伺い、世界観やトーンを揃えたイラストをご提案します。",
      "個人利用・商用利用どちらも対応可能です。まずはお気軽にご相談ください。",
    ].join("\n"),
    tone: "ですます" as const,
    color: "#FB7185",

    tw: "sample_illust",
    ig: "sample.illust",
    be: "",
    site: "https://portfolio.example.com",

    svc1_name: "SNSアイコン・ヘッダー制作",
    svc1_price: "8000",
    svc1_desc:
      "SNSや配信で使用できるアイコン・ヘッダーを制作します。用途に合わせて構図や表情をご提案します。",

    skillsInput:
      "イラスト制作, キャラクターデザイン, SNS向けイラスト, やさしい色彩, 世界観づくり",
  } as const;

  const setValue = (name: string, value: string) => {
    const el = form.elements.namedItem(name) as
      | HTMLInputElement
      | HTMLTextAreaElement
      | null;
    if (el) el.value = value;
  };

  // 基本情報（uncontrolled inputに流し込み）
  setValue("email", sample.email);
  setValue("name", sample.name);
  setValue("title", sample.title);
  setValue("tagline", sample.tagline);
  setValue("bio", sample.bio);
  setValue("color", sample.color);

  // SNS（uncontrolled）
  setValue("tw", sample.tw);
  setValue("ig", sample.ig);
  setValue("be", sample.be);
  setValue("site", sample.site);

  // services
  // ✅ svc1_name は controlled（serviceNames）なので state に入れる
  setServiceIds([1]);
  setServiceNames({ 1: sample.svc1_name });

  // svc1_price / svc1_desc は uncontrolled なので DOM に流し込みでOK
  setValue("svc1_price", sample.svc1_price);
  setValue("svc1_desc", sample.svc1_desc);

  // skills
  // ✅ skills は controlled（manualSkillsInput）なので state に入れる
  setManualSkillsInput(sample.skillsInput);
  // hidden の preset 側をクリアしたいならここでクリア（任意）
  setSelectedSkillPresets([]);

  // 世界観
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

  // live（進捗ゲージ・プレビュー文言用）
  setLive((prev) => ({
    ...prev,
    email: sample.email,
    name: sample.name,
    title: sample.title,
    tagline: sample.tagline,
    bio: sample.bio,
  }));
}

  /* ---------------------------------------------
   * Submit Handler
   * --------------------------------------------- */

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

      const getString = (name: string): string => (data.get(name) as string | null) ?? "";
      const getNum = (name: string, fallback = 0): number => {
        const v = data.get(name);
        const n = typeof v === "string" ? Number(v) : Number.NaN;
        return Number.isFinite(n) ? n : fallback;
      };

      // ★送信直前に draft が無ければ作る（最後の安全弁）
      if (!draft.requestId) {
        await createDraftIfNeeded(getString("email"), getString("name"));
      }

      // ✅ アバターアップロードが走っているなら待つ
      if (avatarUploadPromiseRef.current) {
        await avatarUploadPromiseRef.current;
      }

      const services: { name: string; price?: string; desc?: string }[] = [];
      serviceIds.forEach((id) => {
        const name = getString(`svc${id}_name`).trim();
        const priceRaw = getString(`svc${id}_price`).trim();
        const descRaw = getString(`svc${id}_desc`).trim();
        if (!name) return;

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

        // ✅ 互換
        overall: aiSwingVal,
        copywriting: aiSwingVal,
      } as const;

      const payload: AiPortfolioPayload & { requestId?: string } = {
        requestId: draft.requestId ?? undefined,

        email: getString("email"),
        name: getString("name"),
        title: getString("title"),
        tagline: getString("tagline"),
        bio: getString("bio"),
        tone: (getString("tone") as any) || "ですます",
        color: getString("color") || "#111827",

        avatarUrl: avatarUploadUrl ?? undefined,

sections: { ...sectionChecked },


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

      const json = await res.json().catch(() => null);

      if (!res.ok) {
        console.error("submit error:", json);
        setMsg("送信に失敗しました。入力内容をご確認ください。");
        return;
      }

      if (json?.id) {
        window.location.href = `/aiPortfolio/preview/${json.id}`;
        return;
      }

      setMsg("送信に失敗しました。");
    } catch (error) {
      console.error(error);
      setMsg("通信エラーが発生しました。時間をおいて再度お試しください。");
    } finally {
      setLoading(false);
    }
  }

  /* =========================================================
   * RENDER
   * ========================================================= */

// ✅ 文言置換：AIを前面に出さない表現へ
const tuningLabel = "調整度";
const tuningHintTitle =
  "0〜20%：テンプレートをほぼ忠実に再現\n" +
  "21〜60%：配色・余白・見出しを中心に読みやすく調整\n" +
  "61〜100%：レイアウトの最適化を強め、見せ方を整える（内容は保持）";

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-50 via-slate-50 to-slate-100">
      {/* ================= AURA Intro Overlay ================= */}
      {showIntro && (
        <AuraIntroOverlay
          key={introNonce}
          onDone={() => {
            try {
              localStorage.setItem(INTRO_KEY, "1");
            } catch {}
            setShowIntro(false);
          }}
        />
      )}

      <div className="mx-auto max-w-6xl px-4 py-10">
        {/* ================= HEADER ================= */}
        <header className="mb-10 rounded-3xl border border-slate-200 bg-white/95 p-6 shadow-sm">
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div>
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
                  Premium Portfolio Builder
                </span>
              </div>

              <h1 className="text-2xl font-semibold tracking-tight text-slate-900 md:text-3xl">
                ポートフォリオ作成フォーム
              </h1>
              <p className="mt-1 text-xs text-slate-500 md:text-sm">
テンプレートと調整度を選ぶだけで、
構成・配色・世界観が破綻しないポートフォリオを自動で組み立てます。
まずは基本情報と作品画像を入力してください。
生成後は、内容を自由に編集できます。
              </p>
            </div>

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
      <span className="text-[11px] font-medium text-slate-700">基本情報</span>
    </div>

    {/* draft 状態（デバッグ用に小さく） */}
    <div className="text-[10px] text-slate-400">
      {draft.status === "creating" && "draft: creating..."}
      {draft.status === "ready" &&
        draft.requestId &&
        `draft: ${draft.requestId.slice(0, 6)}...`}
      {draft.status === "error" && "draft: error"}
    </div>
  </div>

  <div className="mt-4 grid gap-4 md:grid-cols-2">
    <label className="grid gap-1 text-xs">
      <span className="font-medium text-slate-700">メールアドレス *</span>
      <input
        name="email"
        type="email"
        required
        placeholder="example@gmail.com"
        className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-sky-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-sky-300"
        {...bindLive("email")}
      />
      <span className="text-[11px] text-slate-500">
        ※ 保存・確認用に使用します。営業メール等は送信しません。
      </span>
    </label>

    <label className="grid gap-1 text-xs">
      <span className="font-medium text-slate-700">お名前 / ペンネーム *</span>
      <input
        name="name"
        required
        placeholder="あなたの活動名"
        className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-sky-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-sky-300"
        {...bindLive("name")}
      />
      <span className="text-[11px] text-slate-500">
        ポートフォリオ上の表示名として使用されます。
      </span>
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
      <span className="text-[11px] text-slate-500">
        トップやプロフィールに表示される肩書きです（複数ある場合は「/」区切りでOK）。
      </span>
    </label>

    <label className="grid gap-1 text-xs">
      <span className="font-medium text-slate-700">
        一言（トップに表示される紹介文） *
      </span>
      <input
        name="tagline"
        required
        placeholder="例：やさしい世界を描きます"
        className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-sky-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-sky-300"
        {...bindLive("tagline")}
      />
      <span className="text-[11px] text-slate-500">
        「何が得意か」「どんな雰囲気か」が一目で伝わる短い言葉がおすすめです。
      </span>
    </label>

    {/* プロフィール画像アップロード＋プレビュー */}
    <div className="mt-4 grid gap-4 md:col-span-2 md:grid-cols-[auto,1fr] items-center">
      <div className="flex flex-col items-center gap-2">
        <div className="relative">
          <div className="absolute -inset-1 rounded-full bg-gradient-to-br from-sky-300/40 to-cyan-400/40 blur-md" />
          <div className="relative flex h-20 w-20 items-center justify-center overflow-hidden rounded-full border-4 border-white bg-slate-100 text-sm font-semibold text-slate-500 shadow-sm md:h-24 md:w-24">
            {avatarPreviewUrl ? (
              <img
                src={avatarPreviewUrl}
                alt="プロフィール画像プレビュー"
                className="h-full w-full object-cover"
              />
            ) : (
              <span className="px-3 text-center leading-tight">No Image</span>
            )}
          </div>
        </div>

        <p className="text-[11px] text-slate-500">
          丸くトリミングされた状態で表示されます（第一印象に効きます）。
        </p>

        <p className="text-[10px] text-slate-400">
          {avatarUploading
            ? "アップロード中..."
            : avatarUploadUrl
            ? "アップロード完了"
            : "未アップロード"}
        </p>
      </div>

      <div className="space-y-3">
        <div
          onDrop={handleAvatarDrop}
          onDragOver={handleAvatarDragOver}
          className="group flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50/60 px-4 py-5 text-center transition hover:border-sky-400 hover:bg-sky-50/80"
        >
          <input
            ref={avatarInputRef}
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
              正方形の画像推奨（2MB程度まで）。写真・イラストどちらでもOKです。
            </span>
            <span className="text-[11px] text-slate-500">
              選択した瞬間にアップロードします。
            </span>
            {avatarInputUrl && (
              <span className="mt-1 text-[10px] text-slate-400">
                選択ファイル: {avatarInputUrl}
              </span>
            )}
          </label>
        </div>

        {/* ✅ render中にDOM参照を避け、live.emailで判断 */}
        {!(live.email ?? "").trim() && (
          <p className="text-[11px] text-amber-600">
            先にメールを入力すると、画像アップロードが即時反映されます。
          </p>
        )}
      </div>
    </div>
  </div>

  <label className="mt-4 block text-xs">
    <span className="font-medium text-slate-700">自己紹介</span>
    <span className="mt-1 block text-[11px] text-slate-500">
      プロフィール・About に表示されます。実績、対応範囲、仕事へのスタンスなどを軽く書くのがおすすめです。
    </span>
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
        <option value="フレンドリー">フレンドリー（やわらかめ）</option>
      </select>
      <span className="text-[11px] text-slate-500">
        表示される文章全体の口調に反映されます。
      </span>
    </label>

    <label className="grid gap-1 text-xs">
      <span className="font-medium text-slate-700">あなたの好きな色（任意）</span>
      <div className="flex items-center gap-2">
        <input
          name="color"
          type="color"
          defaultValue="#111827"
          className="h-10 w-14 cursor-pointer rounded border border-slate-200 bg-white"
        />
        <span className="text-[11px] text-slate-500">
          好きな色はボタンやラインなど、差し色として使われます。世界観テンプレートの雰囲気を壊さない範囲で反映されます。
        </span>
      </div>
    </label>
  </div>
</section>


 {/* ================= STEP2 DESIGN / TEMPLATE & 調整度 ================= */}
<section className="rounded-3xl border border-slate-200 bg-white/95 p-6 shadow-[0_18px_45px_rgba(15,23,42,0.08)]">
  <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-sky-300/60 bg-gradient-to-r from-sky-50 to-cyan-50 px-3 py-1">
    <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-sky-500">
      STEP 2
    </span>
    <span className="text-[11px] font-medium text-slate-700">
      デザインテンプレート &amp; {tuningLabel}
    </span>
  </div>

  <div className="flex flex-col gap-6 lg:flex-row">
    <div className="flex-1 space-y-5">
      <p className="text-[11px] text-slate-500">
        好みのテンプレートを選び、{tuningLabel}のスライダーで「整え方の強さ」を調整します。
        右に寄せるほど、配色・余白・レイアウトなどがテンプレートの雰囲気を保ったまま最適化されます。
      </p>

      <div>
        <p className="mb-2 text-[11px] font-medium text-slate-700">
          世界観テンプレート
        </p>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-5">
          {WORLDVIEWS.map((wv) => {
            const c = WORLDVIEW_COLORS[wv];
            const isActive = selectedWorldview === (wv as WorldviewBase);

            return (
              <button
                key={wv}
                type="button"
                onClick={() => {
                  setSelectedWorldview(wv as WorldviewBase);
                  const preset = getWorldviewPreset(wv as WorldviewBase);
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

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            <label className="text-xs font-medium text-slate-900">
              {tuningLabel}
            </label>
<div className="relative inline-flex">
  <button
    type="button"
    aria-label={`${tuningLabel}の説明を開く`}
    aria-haspopup="dialog"
    aria-expanded={tuningHelpOpen}
    onClick={() => setTuningHelpOpen((v) => !v)}
    onKeyDown={(e) => {
      if (e.key === "Escape") setTuningHelpOpen(false);
    }}
    className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-slate-300 text-[10px] text-slate-500 transition hover:border-sky-400 hover:text-slate-700 focus:outline-none focus:ring-1 focus:ring-sky-300"
    title={tuningHintTitle} // PCのhoverフォールバックも残す
  >
    ?
  </button>

  {tuningHelpOpen && (
  <div
    role="dialog"
    aria-label={`${tuningLabel}の説明`}
    className="absolute left-0 top-7 z-50 w-[260px] rounded-xl border border-slate-200 bg-white p-3 text-[11px] text-slate-700 shadow-xl"
  >
    {/* ヘッダー */}
    <div className="mb-2 flex items-center justify-between">
      <span className="text-[11px] font-semibold text-slate-800">
        {tuningLabel}とは
      </span>
      <button
        type="button"
        onClick={() => setTuningHelpOpen(false)}
        className="rounded-md border border-slate-200 px-2 py-0.5 text-[10px] text-slate-600 hover:bg-slate-50"
        aria-label="ヘルプを閉じる"
      >
        閉じる
      </button>
    </div>

    {/* 本文（差し替え可能） */}
    <div className="whitespace-pre-line leading-relaxed text-slate-600">
      {tuningHintTitle}
    </div>
  </div>
)}

</div>

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
        <input type="hidden" name="aiSwing" value={aiSwing} />

        <div className="mt-1 flex justify-between text-[10px] text-slate-500">
          <span>0%：テンプレートに忠実</span>
          <span>50%：読みやすく整える</span>
          <span>100%：最適化を強める</span>
        </div>

        <p className="text-[10px] text-slate-400">
          ※ 入力内容は保持したまま、見た目（余白・配色・見出しの組み方等）を中心に調整します。
        </p>
      </div>

      <input type="hidden" name="worldviewBase" value={designDefaults.worldviewBase} />
      <input type="hidden" name="patternBase" value={designDefaults.patternBase} />
      <input type="hidden" name="surfaceStyle" value={designDefaults.surfaceStyle} />
      <input type="hidden" name="showcaseStyle" value={designDefaults.showcaseStyle} />
      <input type="hidden" name="layoutPref" value={designDefaults.layoutPref} />
      <input type="hidden" name="languageMode" value={designDefaults.languageMode} />
      <input type="hidden" name="fontPreset" value={designDefaults.fontPreset} />
    </div>

    <div className="hidden flex-1 md:block">
      <div className="sticky top-6">
        <div className="mb-3 flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold tracking-wider text-slate-400">
              PREVIEW
            </span>
            <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-medium text-slate-500 capitalize">
              {selectedWorldview}
            </span>
          </div>
          <span className="text-[10px] text-slate-400">Tuning: {aiSwing}%</span>
        </div>

        <div
          className="relative overflow-hidden rounded-2xl border border-slate-200 shadow-xl transition-all duration-500"
          style={{
            height: "420px",
            ...previewBgStyle,
          }}
        >
          <div className="absolute inset-x-6 bottom-0 top-8 overflow-hidden rounded-t-xl bg-white shadow-2xl ring-1 ring-slate-900/5">
            <div className="flex items-center gap-1.5 border-b border-slate-100 bg-slate-50/80 px-4 py-3 backdrop-blur-sm">
              <div className="flex gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-rose-400/80" />
                <span className="h-2.5 w-2.5 rounded-full bg-amber-400/80" />
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/80" />
              </div>
              <div className="ml-3 h-2 w-32 rounded-full bg-slate-200/60" />
            </div>

            <div className="h-full w-full overflow-hidden bg-white">
              <div className="origin-top-left h-[153.8%] w-[153.8%] scale-[0.65]">
                <AiPortfolioHeroSwitcher
                  section={mockContent.sections[0]}
                  theme={mockTheme}
                  variant={mockVariant}
                />

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
          世界観ごとの「空気感」をプレビューで確認できます（内容はダミーです）
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
              チェックしたセクションだけが表示されます。
迷ったら「Hero / Works / Contact」が最小構成、標準は「+ About」です。
            </p>

            <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
              {(Object.keys(SECTION_LABELS) as (keyof AiPortfolioPayload["sections"])[]).map((key) => (
                <label
                  key={key}
                  className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 transition-colors hover:border-sky-300 hover:bg-white"
                >
<input
  type="checkbox"
  name={`sec_${key}`}
  checked={!!sectionChecked[key]}
  onChange={(e) => {
    const checked = e.currentTarget.checked;
    setSectionChecked((prev) => ({ ...prev, [key]: checked }));
  }}
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
                作品画像（最大6枚）
              </span>
            </div>
<p className="text-[11px] text-slate-500">
  まずメール入力を完了すると、すぐアップロードできます。
  作品は1枚でもOK。2〜6枚あるとギャラリーがよりリッチになります。
</p>


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
                requestId={draft.requestId}
                onRequireDraft={() => {
                  setMsg("先にメールを入力してください（作品画像アップロードに必要です）。");
                }}
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
  URLでもIDでもOKです（@や https:// はなくても構いません）。
</p>


            <div className="mt-4 space-y-3">
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
            </p>

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

                  <label className="block text-[11px] font-medium text-slate-600 mb-1">
                    サービス名
                  </label>
 <input
  name={`svc${id}_name`}
  placeholder="例：キャラクターイラスト制作"
  value={serviceNames[id] ?? ""}
  onChange={(e) => {
    const v = e.currentTarget.value;
    setServiceNames((m) => ({ ...m, [id]: v }));
  }}
  className="mb-3 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-sky-400 focus:outline-none focus:ring-1 focus:ring-sky-300"
/>


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
              書いた内容は、ポートフォリオでは「サービスカード」として美しく整形されて表示されます。
              <br />
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

            <input type="hidden" name="skill_presets" value={selectedSkillPresets.join(",")} />

<input
  name="skills"
  value={manualSkillsInput}
  onChange={(e) => setManualSkillsInput(e.currentTarget.value)}
  placeholder="例: SDキャラ, ロゴデザイン, アニメ塗り, 背景, ローファイテイスト など"
  className="mt-3 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-sky-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-sky-300"
/>

            <p className="mt-1 text-[11px] text-slate-500">
              カンマ区切りで入力してください（目安: 合計で 5〜12個程度）。
              <br />
              プリセットで選んだタグと自由入力は、送信時にまとめてスキルタグとして扱われます。
            </p>
          </section>

{/* ================= Submit ================= */}
<div className="flex items-center justify-between gap-4">
  <div className="text-[11px] text-slate-500">
    ※ 送信後、数秒〜十数秒でプレビューへ移動します
  </div>

  <button
    type="submit"
    disabled={loading || avatarUploading}
    className="inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-sky-500 to-cyan-400 px-5 py-3 text-sm font-semibold text-white shadow-md shadow-sky-300/40 hover:opacity-95 hover:shadow-lg hover:shadow-sky-300/60 disabled:opacity-60"
  >
    {loading
      ? "生成中..."
      : avatarUploading
      ? "画像アップロード中..."
      : "送信してプレビューを見る"}
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
            <div className="w-full max-w-md max-h-[90vh] rounded-3xl overflow-hidden bg-slate-900 text-slate-50 shadow-2xl">
              <div className="flex items-center justify-between border-b border-slate-800 px-5 py-3">
                <div className="flex flex-col">
                  <span className="text-[11px] font-semibold tracking-[0.16em] text-slate-400">
                    PREVIEW
                  </span>
                  <span className="text-[11px] text-sky-300">
                    {selectedWorldview} ・ Tuning {aiSwing}%
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

              <div className="overflow-auto p-4">
                <div
                  className="mx-auto max-w-sm rounded-xl border border-slate-700 shadow-xl"
                  style={{
                    overflow: "hidden",
                    ...previewBgStyle,
                  }}
                >
                  <div className="flex items-center gap-1.5 border-b border-slate-700 bg-slate-800/70 px-4 py-3">
                    <div className="flex gap-1.5">
                      <span className="h-2.5 w-2.5 rounded-full bg-rose-400/80" />
                      <span className="h-2.5 w-2.5 rounded-full bg-amber-400/80" />
                      <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/80" />
                    </div>
                  </div>

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

      {/* ================= DEV: Intro replay buttons ================= */}
      {process.env.NODE_ENV !== "production" && (
        <div className="fixed bottom-4 left-4 z-[60] flex flex-col gap-2">
          <button
            type="button"
            onClick={() => {
              try {
                localStorage.removeItem(INTRO_KEY);
              } catch {}
              setShowIntro(true);
              setIntroNonce((n) => n + 1);
            }}
            className="rounded-full border border-slate-300 bg-white/90 px-3 py-2 text-xs font-semibold text-slate-800 shadow-md hover:bg-white"
          >
            Introを再生（dev）
          </button>

          <button
            type="button"
            onClick={() => {
              try {
                localStorage.removeItem(INTRO_KEY);
                alert("intro seen を削除しました");
              } catch {
                alert("localStorage が使えません");
              }
            }}
            className="rounded-full border border-slate-300 bg-white/80 px-3 py-2 text-[11px] font-medium text-slate-700 shadow-sm hover:bg-white"
          >
            seen削除だけ（dev）
          </button>
        </div>
      )}
    </main>
  );
}

/* =========================================================
 * Intro Overlay (me-ish smoke → slide, AURA wipe reveal)
 * ========================================================= */
function AuraIntroOverlay({ onDone }: { onDone: () => void }) {
  const TOTAL_MS = 2400;

  useEffect(() => {
    const t = window.setTimeout(() => onDone(), TOTAL_MS);
    return () => window.clearTimeout(t);
  }, [onDone]);

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/60 backdrop-blur-sm">
      <div className="absolute inset-0 overflow-hidden">
        <div className="aura-smoke aura-smoke-1" />
        <div className="aura-smoke aura-smoke-2" />
        <div className="aura-smoke aura-smoke-3" />
      </div>

      <div className="relative flex items-center">
        <div className="aura-meish font-lilita text-5xl md:text-6xl">
          <span className="text-[#00a1e9] drop-shadow-[0_10px_24px_rgba(0,161,233,0.25)]">
            me-ish
          </span>
        </div>

        <div className="aura-aura ml-4 font-lilita text-5xl md:text-6xl">
          <span className="aura-aura-text bg-gradient-to-r from-pink-400 via-purple-500 to-sky-400 bg-clip-text text-transparent drop-shadow-[0_14px_30px_rgba(255,255,255,0.12)]">
            AURA
          </span>
        </div>
      </div>

      <button
        type="button"
        onClick={onDone}
        className="absolute right-4 top-4 rounded-full bg-white/10 px-3 py-2 text-xs font-semibold text-white/80 hover:bg-white/15"
      >
        Skip
      </button>

      <style jsx global>{`
        .aura-smoke {
          position: absolute;
          width: 60vmax;
          height: 60vmax;
          border-radius: 9999px;
          filter: blur(30px);
          opacity: 0.22;
          background: radial-gradient(
            circle at 30% 30%,
            rgba(0, 161, 233, 0.55),
            rgba(255, 255, 255, 0.06) 55%,
            rgba(2, 6, 23, 0) 70%
          );
          animation: auraSmoke 2400ms ease-in-out both;
        }
        .aura-smoke-1 {
          left: -15vmax;
          top: -10vmax;
          transform: translate3d(0, 0, 0);
        }
        .aura-smoke-2 {
          right: -18vmax;
          top: 5vmax;
          opacity: 0.18;
          animation-delay: 120ms;
        }
        .aura-smoke-3 {
          left: 10vmax;
          bottom: -20vmax;
          opacity: 0.16;
          animation-delay: 220ms;
        }

        .aura-meish {
          opacity: 0;
          transform: translate3d(0, 8px, 0) scale(0.98);
          filter: blur(8px);
          animation: meishIn 900ms cubic-bezier(0.2, 0.9, 0.2, 1) 0ms both,
            meishSlide 700ms ease 760ms both;
        }

        .aura-aura {
          position: relative;
          opacity: 0;
          transform: translate3d(0, 6px, 0);
          animation: auraIn 420ms ease 980ms both;
        }
        .aura-aura-text {
          display: inline-block;
          clip-path: inset(0 100% 0 0);
          animation: wipeReveal 980ms cubic-bezier(0.2, 0.9, 0.2, 1) 1040ms
            both;
        }

        @keyframes auraSmoke {
          0% {
            transform: translate3d(0, 0, 0) scale(0.95);
            opacity: 0;
          }
          35% {
            opacity: 0.24;
          }
          100% {
            transform: translate3d(0, -8px, 0) scale(1.06);
            opacity: 0.12;
          }
        }

        @keyframes meishIn {
          0% {
            opacity: 0;
            transform: translate3d(0, 10px, 0) scale(0.98);
            filter: blur(10px);
          }
          100% {
            opacity: 1;
            transform: translate3d(0, 0, 0) scale(1);
            filter: blur(0);
          }
        }
        @keyframes meishSlide {
          0% {
            transform: translate3d(0, 0, 0);
          }
          100% {
            transform: translate3d(-10px, 0, 0);
          }
        }

        @keyframes auraIn {
          to {
            opacity: 1;
            transform: translate3d(0, 0, 0);
          }
        }
        @keyframes wipeReveal {
          0% {
            clip-path: inset(0 100% 0 0);
          }
          100% {
            clip-path: inset(0 0 0 0);
          }
        }
      `}</style>
    </div>
  );
}
