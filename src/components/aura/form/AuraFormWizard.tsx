// src/components/aura/form/AuraFormWizard.tsx
"use client";

import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { ChevronDown, ChevronUp, Eye, EyeOff, Wand2 } from "lucide-react";
import { STEPS, type StepId, type AuraFormData, defaultFormData, validateStep } from "./auraFormTypes";
import { useAuraFormDraft } from "./useAuraFormDraft";
import { AuraFormStepper } from "./AuraFormStepper";
import { AuraFormNav } from "./AuraFormNav";
import { Step1Profile } from "./steps/Step1Profile";
import { Step2Design } from "./steps/Step2Design";
import { Step3Works } from "./steps/Step3Works";
import { Step4About } from "./steps/Step4About";
import { Step5ServicesSkills } from "./steps/Step5ServicesSkills";
import { Step6Contact } from "./steps/Step6Contact";
import { Step7Review } from "./steps/Step7Review";

import { AuraHeroSwitcher } from "@/components/aura/sections/AuraHeroSwitcher";
import { buildBackgroundStyle } from "@/lib/aura/aura.background";
import { getWorldviewPreset, type WorldviewBase } from "@/lib/aura/aura.worldviewPresets";
import type { Design, Content } from "@/lib/aura/aura.schema";
import type { VariantSpec, PatternId } from "@/lib/aura/aura.variant.base";

/* =========================================================
 * 世界観カラー定義（プレビュー用）
 * ========================================================= */
const WORLDVIEW_COLORS: Record<WorldviewBase, { primary: string; accent: string; bg: string }> = {
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

const WORLDVIEW_GRADIENTS: Record<WorldviewBase, string> = {
  minimal: "linear-gradient(145deg, #ffffff 0%, #f3f4f6 100%)",
  modern: "linear-gradient(145deg, #020617 0%, #0f172a 50%, #1e293b 100%)",
  business: "linear-gradient(145deg, #e2e8f0 0%, #f8fafc 100%)",
  cute: "linear-gradient(145deg, #fff1f2 0%, #ffe4e6 100%)",
  pop: "linear-gradient(145deg, #fff7ed 0%, #ffedd5 100%)",
  dark: "linear-gradient(145deg, #020617 0%, #020617 100%)",
  cyber: "linear-gradient(145deg, #020617 0%, #111827 40%, #312e81 75%, #4c1d95 100%)",
  natural: "linear-gradient(145deg, #ecfdf5 0%, #d1fae5 100%)",
  luxury: "linear-gradient(145deg, #020617 0%, #0b1220 55%, #111827 100%)",
  retro: "linear-gradient(145deg, #fffbeb 0%, #fef3c7 100%)",
};

/* =========================================================
 * Draft 状態管理
 * ========================================================= */
type DraftState = {
  requestId: string | null;
  status: "idle" | "creating" | "ready" | "error";
  error?: string | null;
};

/* =========================================================
 * Email 同期状態
 * ========================================================= */
type EmailSyncState = {
  status: "idle" | "syncing" | "synced" | "error";
  error?: string | null;
};

export function AuraFormWizard() {
  // フォームデータと永続化
  const { data, setData, currentStep, setCurrentStep, clearDraft } = useAuraFormDraft();

  // UI状態
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mobilePreviewOpen, setMobilePreviewOpen] = useState(false);

  // Draft（サーバー側）
  const [draft, setDraft] = useState<DraftState>({
    requestId: null,
    status: "idle",
    error: null,
  });

  // Email 同期状態（DB への即時反映用）
  const [emailSync, setEmailSync] = useState<EmailSyncState>({
    status: "idle",
    error: null,
  });
  const emailSyncTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // コンテナref（スクロール用）
  const containerRef = useRef<HTMLDivElement>(null);

  // ステップ遷移アナウンス
  const [stepAnnouncement, setStepAnnouncement] = useState("");

  // 高さ同期用ref
  const formCardRef = useRef<HTMLDivElement>(null);
  const previewCardRef = useRef<HTMLDivElement>(null);
  const [syncedHeight, setSyncedHeight] = useState<number | null>(null);

// デスクトップ時のみ高さを同期（より堅牢：border-box相当）
useEffect(() => {
  const formCard = formCardRef.current;
  if (!formCard) return;

  // lg以上だけ同期（不要なら削除OK）
  const mq = window.matchMedia("(min-width: 1024px)");
  if (!mq.matches) {
    setSyncedHeight(null);
    return;
  }

  const measure = () => {
    // border を含む「見た目の高さ」に寄せる
    const h = Math.round(formCard.getBoundingClientRect().height);
    setSyncedHeight(h);
  };

  measure();

  const observer = new ResizeObserver(() => {
    measure();
  });

  observer.observe(formCard);

  // 画面リサイズでも更新
  window.addEventListener("resize", measure);

  return () => {
    observer.disconnect();
    window.removeEventListener("resize", measure);
  };
}, [currentStep]);

  // ステップ遷移時にアナウンス + フォーカス移動
  useEffect(() => {
    const stepInfo = STEPS.find((s) => s.id === currentStep);
    if (stepInfo) {
      setStepAnnouncement(`ステップ${currentStep}: ${stepInfo.label}`);
    }
    // 最初の入力要素にフォーカス
    const timer = setTimeout(() => {
      const formCard = formCardRef.current;
      if (!formCard) return;
      const firstInput = formCard.querySelector<HTMLElement>(
        'input:not([type="hidden"]):not([disabled]), textarea:not([disabled]), select:not([disabled])'
      );
      firstInput?.focus();
    }, 100);
    return () => clearTimeout(timer);
  }, [currentStep]);

  /* =========================================================
   * Draft 作成
   * ========================================================= */
  const createDraftIfNeeded = useCallback(async (email: string, name: string) => {
    if (!email) {
      setError("先にメールアドレスを入力してください（画像アップロードに必要です）。");
      throw new Error("email_required_for_draft");
    }

    if (draft.requestId) return draft.requestId;

    setDraft((p) => ({ ...p, status: "creating", error: null }));
    try {
      const res = await fetch("/api/aura/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-requested-with": "me-ish" },
        body: JSON.stringify({ email, name }),
      });

      const json = await res.json().catch(() => null);

      if (!res.ok || !json?.ok || !json?.requestId) {
        const message = json?.error ? String(json.error) : "draft_create_failed";
        setDraft({ requestId: null, status: "error", error: message });
        setError("下書き作成に失敗しました。時間をおいて再度お試しください。");
        throw new Error(message);
      }

      setDraft({
        requestId: String(json.requestId),
        status: "ready",
        error: null,
      });
      return String(json.requestId);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      setDraft({ requestId: null, status: "error", error: message });
      throw e;
    }
  }, [draft.requestId]);

  // メール入力後にdraftを自動作成
  useEffect(() => {
    if (draft.requestId || draft.status === "creating") return;

    const email = data.email.trim();
    if (!email) return;

    const looksLikeEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    if (!looksLikeEmail) return;

    createDraftIfNeeded(email, data.name).catch(() => {});
  }, [data.email, data.name, draft.requestId, draft.status, createDraftIfNeeded]);

  /* =========================================================
   * Email を DB に同期（debounce 付き）
   * - draft.requestId が存在する場合のみ
   * - 400ms debounce で連打防止
   * ========================================================= */
  const syncEmailToDb = useCallback(async (email: string) => {
    if (!draft.requestId) return;

    const normalized = email.trim().toLowerCase();
    if (!normalized) return;

    // メール形式チェック
    const looksLikeEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized);
    if (!looksLikeEmail) return;

    if (process.env.NODE_ENV === "development") {
    }

    setEmailSync({ status: "syncing", error: null });

    try {
      const res = await fetch(`/api/aura/request/${draft.requestId}/email`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-requested-with": "me-ish" },
        body: JSON.stringify({ email: normalized }),
      });

      const json = await res.json().catch(() => null);

      if (!res.ok || !json?.ok) {
        const errMsg = json?.message ?? json?.error ?? "メール更新に失敗しました";
        console.error("[email-sync] error:", errMsg);
        setEmailSync({ status: "error", error: errMsg });
        return;
      }

      if (process.env.NODE_ENV === "development") {
      }
      setEmailSync({ status: "synced", error: null });
    } catch (e) {
      console.error("[email-sync] network error:", e);
      setEmailSync({ status: "error", error: "通信エラーが発生しました" });
    }
  }, [draft.requestId]);

  // Email 変更を検知して debounce 後に同期
  useEffect(() => {
    if (!draft.requestId) return;

    // 既存のタイマーをクリア
    if (emailSyncTimeoutRef.current) {
      clearTimeout(emailSyncTimeoutRef.current);
    }

    // 400ms 後に同期
    emailSyncTimeoutRef.current = setTimeout(() => {
      syncEmailToDb(data.email);
    }, 400);

    return () => {
      if (emailSyncTimeoutRef.current) {
        clearTimeout(emailSyncTimeoutRef.current);
      }
    };
  }, [data.email, draft.requestId, syncEmailToDb]);

  /* =========================================================
   * ナビゲーション
   * ========================================================= */
  const handleChange = useCallback((updates: Partial<AuraFormData>) => {
    setData((prev) => ({ ...prev, ...updates }));
    setError(null);
  }, [setData]);

  const handleNext = useCallback(() => {
    const errors = validateStep(currentStep, data);
    if (errors.length > 0) {
      setError(errors[0].message);
      return;
    }

    if (currentStep < 7) {
      setCurrentStep((currentStep + 1) as StepId);
      containerRef.current?.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [currentStep, data, setCurrentStep]);

  const handleBack = useCallback(() => {
    if (currentStep > 1) {
      setCurrentStep((currentStep - 1) as StepId);
      setError(null);
      containerRef.current?.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [currentStep, setCurrentStep]);

  const handleStepClick = useCallback((step: StepId) => {
    // 過去のステップへは無条件で戻れる
    if (step < currentStep) {
      setCurrentStep(step);
      setError(null);
      return;
    }

    // 未来のステップへは、現在までの全ステップがvalidな場合のみ
    for (let s = 1 as StepId; s < step; s++) {
      const errors = validateStep(s, data);
      if (errors.length > 0) {
        setError(`ステップ${s}の入力が完了していません`);
        return;
      }
    }
    setCurrentStep(step);
  }, [currentStep, data, setCurrentStep]);

  const handleEditStep = useCallback((step: StepId) => {
    setCurrentStep(step);
    setError(null);
  }, [setCurrentStep]);

  const handleRequireDraft = useCallback(async () => {
    if (!data.email.trim()) {
      setError("画像をアップロードするには、まずメールアドレスを入力してください。");
      setCurrentStep(1);
      return;
    }
    try {
      await createDraftIfNeeded(data.email, data.name);
    } catch {
      // エラーはcreateでセット済み
    }
  }, [data.email, data.name, createDraftIfNeeded, setCurrentStep]);

  /* =========================================================
   * サンプル入力
   * ========================================================= */
  const handleSampleFill = useCallback(() => {
    const preset = getWorldviewPreset("cute");
    setData({
      // Step 1: Profile
      email: "sample.creator@example.com",
      name: "サンプル イラスト",
      title: "イラストレーター / キャラクターデザイナー",
      tagline: "やさしい色づかいで、世界観のあるイラストを制作します",
      tone: "ですます",
      color: "#FB7185",
      avatarUrl: "",
      avatarPreviewUrl: "",

      // Step 2: Design
      worldviewBase: "cute",
      aiSwing: 50,
      patternBase: preset.patternBase,
      surfaceStyle: preset.surfaceStyle,
      showcaseStyle: preset.showcaseStyle,
      layoutPref: preset.layoutPref,
      languageMode: preset.languageMode,
      fontPreset: preset.fontPreset,

      // Step 3: Works
      images: [],

      // Step 4: About
      bio: "フリーランスのイラストレーターとして活動しています。\nSNSアイコン、配信サムネイル、キャラクターデザインなどを中心に制作。\nご依頼の目的や使用シーンを丁寧に伺い、世界観やトーンを揃えたイラストをご提案します。",
      sections: {
        hero: true,
        about: true,
        works: true,
        services: true,
        skills: true,
        contact: true,
      },

      // Step 5: Services & Skills
      services: [
        { name: "SNSアイコン制作", price: "¥8,000〜", desc: "用途に合わせて構図や表情をご提案します" },
        { name: "キャラクターデザイン", price: "¥15,000〜", desc: "設定に沿ったオリジナルキャラクター制作" },
      ],
      skillPresets: ["イラスト", "キャラクターデザイン", "アイコン制作", "SNSヘッダー"],
      manualSkills: "厚塗り, やさしい色彩, 世界観づくり",

      // Step 6: Contact
      twitter: "@sample_illust",
      instagram: "sample.illust",
      behance: "",
      website: "https://portfolio.example.com",
    });
    setCurrentStep(1);
    setError(null);
  }, [setData, setCurrentStep]);

  /* =========================================================
   * 送信
   * ========================================================= */
  const handleSubmit = useCallback(async () => {
    // 全ステップのバリデーション
    for (let s = 1 as StepId; s <= 6; s++) {
      const errors = validateStep(s, data);
      if (errors.length > 0) {
        setError(errors[0].message);
        setCurrentStep(s);
        return;
      }
    }

    setLoading(true);
    setError(null);

    try {
      // draftが無ければ作成
      if (!draft.requestId) {
        await createDraftIfNeeded(data.email, data.name);
      }

      // skills結合
      const skills = [
        ...data.skillPresets,
        ...(data.manualSkills
          ? data.manualSkills.split(",").map((s) => s.trim()).filter(Boolean)
          : []),
      ];

      const payload = {
        requestId: draft.requestId,
        email: data.email,
        name: data.name,
        title: data.title,
        tagline: data.tagline,
        bio: data.bio,
        tone: data.tone,
        color: data.color,
        avatarUrl: data.avatarPreviewUrl,

        sections: data.sections,

        social: {
          twitter: data.twitter || undefined,
          instagram: data.instagram || undefined,
          behance: data.behance || undefined,
          website: data.website || undefined,
        },

        services: data.services,
        skills,
        images: data.images,

        designAnswers: {
          worldviewBase: data.worldviewBase,
          patternBase: getWorldviewPreset(data.worldviewBase).patternBase,
          surfaceStyle: getWorldviewPreset(data.worldviewBase).surfaceStyle,
          showcaseStyle: getWorldviewPreset(data.worldviewBase).showcaseStyle,
          layoutPref: getWorldviewPreset(data.worldviewBase).layoutPref,
          languageMode: getWorldviewPreset(data.worldviewBase).languageMode,
          fontPreset: getWorldviewPreset(data.worldviewBase).fontPreset,
        },

        aiStrength: {
          worldview: data.aiSwing,
          pattern: data.aiSwing,
          surface: data.aiSwing,
          showcase: data.aiSwing,
          layout: data.aiSwing,
          font: data.aiSwing,
          language: Math.round(data.aiSwing * 0.6),
          overall: data.aiSwing,
          copywriting: data.aiSwing,
        },
      };

      const res = await fetch("/api/aura/form/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-requested-with": "me-ish" },
        body: JSON.stringify(payload),
      });

      const json = await res.json().catch(() => null);

      if (!res.ok) {
        console.error("submit error:", json);
        setError("送信に失敗しました。入力内容をご確認ください。");
        return;
      }

      if (json?.id) {
        clearDraft();
        window.location.href = `/aura/preview/${json.id}`;
        return;
      }

      setError("送信に失敗しました。");
    } catch (e) {
      console.error(e);
      setError("通信エラーが発生しました。時間をおいて再度お試しください。");
    } finally {
      setLoading(false);
    }
  }, [data, draft.requestId, createDraftIfNeeded, clearDraft]);

  /* =========================================================
   * プレビュー用 Mock データ
   * ========================================================= */
  const colors = WORLDVIEW_COLORS[data.worldviewBase];
  const presetForPreview = useMemo(() => getWorldviewPreset(data.worldviewBase), [data.worldviewBase]);

  const mockTheme: Design["theme"] = useMemo(() => {
    const anyPreset = presetForPreview as any;
    const presetPatternLayers: string[] = Array.isArray(anyPreset.patternLayers) ? anyPreset.patternLayers : [];
    const presetTextureLayers: string[] = Array.isArray(anyPreset.textureLayers) ? anyPreset.textureLayers : [];
    const presetBgStyle = (anyPreset.bgStyle as React.CSSProperties | undefined) ?? undefined;

    const bgGradient: string | undefined =
      (typeof anyPreset.bgGradient === "string" && anyPreset.bgGradient.trim()
        ? anyPreset.bgGradient
        : WORLDVIEW_GRADIENTS[data.worldviewBase]) ?? undefined;

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
        data.worldviewBase === "minimal" ||
        data.worldviewBase === "business" ||
        data.worldviewBase === "cute" ||
        data.worldviewBase === "pop" ||
        data.worldviewBase === "retro"
          ? "#111827"
          : "#E5E7EB",
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
      backgroundPattern,
      languageMode: presetForPreview.languageMode as any,
      fontPreset: presetForPreview.fontPreset as any,
    } as any;
  }, [presetForPreview, data.worldviewBase, colors]);

  const mockVariant: VariantSpec = useMemo(() => {
    const layout = data.aiSwing > 60 ? "split" : "centerBasic";
    const surface = data.aiSwing > 20 ? "glass" : "card";

    return {
      worldview: data.worldviewBase,
      layout: layout as any,
      surface: surface as any,
      pattern: "none" as any,
      showcase: "gallery" as any,
      variantId: "mock",
      shadow: data.aiSwing > 60 ? "deep" : "soft",
      radius: data.aiSwing >= 100 ? "extraLarge" : "large",
    } as any;
  }, [data.worldviewBase, data.aiSwing]);

  // 仕様: headings[0] = キャッチコピー（主文）、name/title は副次要素
const mockHeroSection: Content["sections"][number] = useMemo(
  () => ({
    type: "hero" as const,
    // headings[1] = main（大）
    headings: [
      data.tagline || "あなたのキャッチコピーがここに表示されます", // ✅ メイン（大）
    ],
  }),
  [data.name, data.title, data.tagline]
);
const previewBgStyle = useMemo(
  () => buildBackgroundStyle(mockTheme as any, mockVariant as any),
  [mockTheme, mockVariant]
);

  /* =========================================================
   * ステップ別コンポーネント
   * ========================================================= */
  const stepContent = useMemo(() => {
    switch (currentStep) {
      case 1:
        return <Step1Profile data={data} onChange={handleChange} requestId={draft.requestId} onRequireDraft={handleRequireDraft} />;
      case 2:
        return <Step2Design data={data} onChange={handleChange} />;
      case 3:
        return <Step3Works data={data} onChange={handleChange} requestId={draft.requestId} onRequireDraft={handleRequireDraft} />;
      case 4:
        return <Step4About data={data} onChange={handleChange} />;
      case 5:
        return <Step5ServicesSkills data={data} onChange={handleChange} />;
      case 6:
        return <Step6Contact data={data} onChange={handleChange} />;
      case 7:
        return <Step7Review data={data} onEditStep={handleEditStep} />;
      default:
        return null;
    }
  }, [currentStep, data, draft.requestId, handleChange, handleRequireDraft, handleEditStep]);

  /* =========================================================
   * RENDER
   * ========================================================= */
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-slate-50 to-slate-100">
      {/* ステップ遷移のスクリーンリーダー向けアナウンス */}
      <div aria-live="polite" className="sr-only">{stepAnnouncement}</div>

      <div className="mx-auto max-w-7xl px-4 py-6 pb-[calc(96px+env(safe-area-inset-bottom))] lg:py-10 lg:pb-0">
        {/* ヘッダー */}
        <header className="mb-6 rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-sm lg:mb-8 lg:rounded-3xl lg:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="mb-2 inline-flex items-center gap-2 lg:mb-3 lg:gap-3">
                <div className="inline-flex items-center rounded-full border border-cyan-300/70 bg-white px-2 py-0.5 shadow-sm lg:px-3 lg:py-1">
                  <span className="font-lilita text-xs leading-none lg:text-sm">
                    <span className="text-[#00a1e9]">me-ish</span>{" "}
                    <span className="bg-gradient-to-r from-pink-400 via-purple-500 to-sky-400 bg-clip-text text-transparent">
                      AURA
                    </span>
                  </span>
                </div>
                <span className="text-[9px] font-medium uppercase tracking-[0.12em] text-slate-500 lg:text-[11px] lg:tracking-[0.16em]">
                  Premium Portfolio Builder
                </span>
              </div>

              <div className="flex items-center gap-3">
                <h1 className="text-xl font-semibold tracking-tight text-slate-900 lg:text-2xl xl:text-3xl">
                  ポートフォリオ作成フォーム
                </h1>
                <button
                  type="button"
                  onClick={handleSampleFill}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700 transition-colors hover:bg-amber-100"
                >
                  <Wand2 className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">サンプル入力</span>
                  <span className="sm:hidden">Sample</span>
                </button>
              </div>
              <p className="mt-1 text-[11px] text-slate-500 lg:text-xs xl:text-sm">
                テンプレートと調整度を選ぶだけで、破綻しないポートフォリオを自動生成します
              </p>
            </div>

            {/* Stepper（デスクトップ：ヘッダー内） */}
            <div className="hidden lg:block">
              <AuraFormStepper
                currentStep={currentStep}
                onStepClick={handleStepClick}
                data={data}
              />
            </div>
          </div>

          {/* Stepper（モバイル：ヘッダー下部） */}
          <div className="mt-4 lg:hidden">
            <AuraFormStepper
              currentStep={currentStep}
              onStepClick={handleStepClick}
              data={data}
            />
          </div>
        </header>

        {/* メインコンテンツ */}
        <div className="flex flex-col gap-6 lg:flex-row lg:gap-8">
          {/* フォーム部分 */}
          <div className="flex-1" ref={containerRef}>
            <div
              ref={formCardRef}
              className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm lg:rounded-3xl lg:p-6 xl:p-8"
            >
              {stepContent}
            </div>

            {/* モバイル用プレビュートグル */}
            <div className="mt-4 lg:hidden">
              <button
                type="button"
                onClick={() => setMobilePreviewOpen(!mobilePreviewOpen)}
                className="flex w-full items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 shadow-sm"
              >
                <span className="flex items-center gap-2">
                  {mobilePreviewOpen ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  プレビュー
                </span>
                {mobilePreviewOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>

              {mobilePreviewOpen && (
                <div className="mt-3 overflow-hidden rounded-2xl border border-slate-200 shadow-sm">
                  <div className="relative w-full overflow-hidden rounded-2xl min-h-[360px] h-[52vh] max-h-[520px]">
                    <div className="absolute inset-0" style={previewBgStyle}>
                      <AuraHeroSwitcher
                        theme={mockTheme as any}
                        variant={mockVariant}
                        section={mockHeroSection}
                      />
                    </div>
                  </div>
                  <div className="bg-slate-50 p-3 text-center">
                    <span className="text-xs text-slate-500">
                      {STEPS.find((s) => s.id === 2)?.label}で世界観を変更できます
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* プレビュー（デスクトップ） */}
          <div className="hidden lg:block lg:w-[420px] xl:w-[480px]">
            <div className="sticky top-6">
<div
  ref={previewCardRef}
  className="flex flex-col rounded-2xl border border-slate-200 bg-white p-4 shadow-sm lg:rounded-3xl"
  style={{
    height: syncedHeight ? `${syncedHeight}px` : undefined,
    maxHeight: "calc(100vh - 24px)", // sticky top-6(=24px)に合わせて上限
    transition: "height 0.2s ease-out",
  }}
>

                <div className="mb-3 flex items-center justify-between">
                  <span className="text-sm font-medium text-slate-700">ライブプレビュー</span>
                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
                    {data.worldviewBase}
                  </span>
                </div>
                <div className="flex-1 overflow-hidden rounded-xl border border-slate-200">
                  <div className="relative h-full w-full overflow-hidden" style={{ minHeight: "200px" }}>
                    <div className="absolute inset-0" style={previewBgStyle}>
                      <AuraHeroSwitcher
                        theme={mockTheme as any}
                        variant={mockVariant}
                        section={mockHeroSection}
                      />
                    </div>
                  </div>
                </div>
                <p className="mt-3 text-center text-[11px] text-slate-500">
                  入力内容がリアルタイムで反映されます
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* 固定ナビゲーション */}
        <AuraFormNav
          currentStep={currentStep}
          onBack={handleBack}
          onNext={handleNext}
          onSubmit={handleSubmit}
          loading={loading}
          error={error}
          data={data}
        />
      </div>
    </div>
  );
}
