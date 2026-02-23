// src/components/aura/form/AuraFormWizard.tsx
"use client";

import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { ChevronDown, ChevronUp, Eye, EyeOff, Wand2 } from "lucide-react";
import { STEPS, type StepId, type AuraFormData, validateStep } from "./auraFormTypes";
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
import { getWorldviewPreset } from "@/lib/aura/aura.worldviewPresets";

import { useAuraDraftServer } from "./hooks/useAuraDraftServer";
import { useStepNavigation } from "./hooks/useStepNavigation";
import { useSyncedHeights } from "./hooks/useSyncedHeights";
import { buildMockTheme, buildMockVariant, buildMockHeroSection } from "./auraPreviewMocks";
import { SAMPLE_FORM_DATA } from "./auraFormSampleData";

export function AuraFormWizard() {
  // Form data & persistence
  const { data, setData, currentStep, setCurrentStep, clearDraft } = useAuraFormDraft();

  // UI state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mobilePreviewOpen, setMobilePreviewOpen] = useState(false);

  // Refs
  const containerRef = useRef<HTMLDivElement>(null);

  // Extracted hooks
  const { draft, emailSync, createDraftIfNeeded } = useAuraDraftServer(data.email, data.name, setError);

  useEffect(() => {
    if (emailSync.status === 'error' && emailSync.error) {
      setError(emailSync.error);
    }
  }, [emailSync.status, emailSync.error]);
  const { formCardRef, previewCardRef, syncedHeight } = useSyncedHeights(currentStep);
  const { handleNext, handleBack, handleStepClick, handleEditStep, stepAnnouncement } =
    useStepNavigation(currentStep, setCurrentStep, data, setError, containerRef, formCardRef);

  /* =========================================================
   * Handlers
   * ========================================================= */
  const handleChange = useCallback((updates: Partial<AuraFormData>) => {
    setData((prev) => ({ ...prev, ...updates }));
    setError(null);
  }, [setData]);

  const handleRequireDraft = useCallback(async (): Promise<string | null> => {
    if (!data.email.trim()) {
      setError("画像をアップロードするには、まずメールアドレスを入力してください。");
      setCurrentStep(1);
      return null;
    }
    try {
      return await createDraftIfNeeded(data.email, data.name);
    } catch {
      // error set inside createDraftIfNeeded
      return null;
    }
  }, [data.email, data.name, createDraftIfNeeded, setCurrentStep]);

  const handleSampleFill = useCallback(() => {
    setData(SAMPLE_FORM_DATA);
    setCurrentStep(1);
    setError(null);
  }, [setData, setCurrentStep]);

  /* =========================================================
   * Submit
   * ========================================================= */
  const handleSubmit = useCallback(async () => {
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
      if (!draft.requestId) {
        await createDraftIfNeeded(data.email, data.name);
      }

      const skills = [
        ...data.skillPresets,
        ...(data.manualSkills
          ? data.manualSkills.split(",").map((s) => s.trim()).filter(Boolean)
          : []),
      ];

      const preset = getWorldviewPreset(data.worldviewBase);

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
          patternBase: preset.patternBase,
          surfaceStyle: preset.surfaceStyle,
          showcaseStyle: preset.showcaseStyle,
          layoutPref: preset.layoutPref,
          languageMode: preset.languageMode,
          fontPreset: preset.fontPreset,
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
  }, [data, draft.requestId, createDraftIfNeeded, clearDraft, setCurrentStep]);

  /* =========================================================
   * Preview mock data
   * ========================================================= */
  const presetForPreview = useMemo(() => getWorldviewPreset(data.worldviewBase), [data.worldviewBase]);
  const mockTheme = useMemo(() => buildMockTheme(data.worldviewBase, presetForPreview), [data.worldviewBase, presetForPreview]);
  const mockVariant = useMemo(() => buildMockVariant(data.worldviewBase, data.aiSwing), [data.worldviewBase, data.aiSwing]);
  const mockHeroSection = useMemo(() => buildMockHeroSection(data.tagline), [data.name, data.title, data.tagline]);
  const previewBgStyle = useMemo(() => buildBackgroundStyle(mockTheme as any, mockVariant as any), [mockTheme, mockVariant]);

  /* =========================================================
   * Step content
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
      <div aria-live="polite" className="sr-only">{stepAnnouncement}</div>

      <div className="mx-auto max-w-7xl px-4 py-6 pb-[calc(96px+env(safe-area-inset-bottom))] lg:py-10 lg:pb-0">
        {/* Header */}
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

            <div className="hidden lg:block">
              <AuraFormStepper currentStep={currentStep} onStepClick={handleStepClick} data={data} />
            </div>
          </div>

          <div className="mt-4 lg:hidden">
            <AuraFormStepper currentStep={currentStep} onStepClick={handleStepClick} data={data} />
          </div>
        </header>

        {/* Main content */}
        <div className="flex flex-col gap-6 lg:flex-row lg:gap-8">
          {/* Form */}
          <div className="flex-1" ref={containerRef}>
            <div
              ref={formCardRef}
              className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm lg:rounded-3xl lg:p-6 xl:p-8"
            >
              {stepContent}
            </div>

            {/* Mobile preview toggle */}
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
                      <AuraHeroSwitcher theme={mockTheme as any} variant={mockVariant} section={mockHeroSection} />
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

          {/* Desktop preview */}
          <div className="hidden lg:block lg:w-[420px] xl:w-[480px]">
            <div className="sticky top-6">
              <div
                ref={previewCardRef}
                className="flex flex-col rounded-2xl border border-slate-200 bg-white p-4 shadow-sm lg:rounded-3xl"
                style={{
                  height: syncedHeight ? `${syncedHeight}px` : undefined,
                  maxHeight: "calc(100vh - 24px)",
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
                      <AuraHeroSwitcher theme={mockTheme as any} variant={mockVariant} section={mockHeroSection} />
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

        {/* Fixed navigation */}
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
