// src/components/aura/form/AuraFormWizard.tsx
"use client";

import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { ArrowLeft, ArrowRight, Eye, Send, Loader2, Wand2 } from "lucide-react";
import { STEPS, type StepId, type AuraFormData, validateStep } from "./auraFormTypes";
import { useAuraFormDraft } from "./useAuraFormDraft";
import { AuraFormStepper } from "./AuraFormStepper";
import { Step1Profile } from "./steps/Step1Profile";
import { Step2Design } from "./steps/Step2Design";
import { Step3Works } from "./steps/Step3Works";
import { Step4About } from "./steps/Step4About";
import { Step5ServicesSkills } from "./steps/Step5ServicesSkills";
import { Step6Contact } from "./steps/Step6Contact";
import { Step7Review } from "./steps/Step7Review";
import { AuraFormPreview } from "./AuraFormPreview";


import { useAuraDraftServer } from "./hooks/useAuraDraftServer";
import { useStepNavigation } from "./hooks/useStepNavigation";
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
  const formCardRef = useRef<HTMLDivElement>(null);

  // Extracted hooks
  const { draft, emailSync, createDraftIfNeeded } = useAuraDraftServer(data.email, data.name, setError);

  useEffect(() => {
    if (emailSync.status === 'error' && emailSync.error) {
      setError(emailSync.error);
    }
  }, [emailSync.status, emailSync.error]);

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
        contactEmail: data.contactEmail || undefined,
        avatarShape: data.avatarShape,
        avatarSize: data.avatarSize,
        aiLockedFields: data.aiLockedFields,
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
          patternBase: data.patternBase,
          surfaceStyle: data.surfaceStyle,
          showcaseStyle: data.showcaseStyle,
          layoutPref: data.layoutPref,
          languageMode: data.languageMode,
          fontPreset: data.fontPreset,
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

  const isFirstStep = currentStep === 1;
  const isLastStep = currentStep === STEPS.length;

  /* =========================================================
   * RENDER
   * ========================================================= */
  return (
    <div className="flex flex-col lg:flex-row min-h-screen">
      <div aria-live="polite" className="sr-only">{stepAnnouncement}</div>

      {/* ── Left: Form pane ── */}
      <div className="flex flex-col bg-white lg:w-[480px] xl:w-[540px] lg:border-r lg:border-slate-200 lg:min-h-screen">

        {/* Pane header: brand + stepper */}
        <div className="border-b border-slate-200 px-4 py-3">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="inline-flex items-center rounded-full border border-cyan-300/70 bg-white px-2 py-0.5 shadow-sm">
                <span className="font-lilita text-xs leading-none">
                  <span className="text-[#00a1e9]">me-ish</span>{" "}
                  <span className="bg-gradient-to-r from-pink-400 via-purple-500 to-sky-400 bg-clip-text text-transparent">
                    AURA
                  </span>
                </span>
              </div>
              <span className="text-[10px] font-medium uppercase tracking-wider text-slate-500 hidden sm:inline">
                Portfolio Builder
              </span>
            </div>
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
          <AuraFormStepper currentStep={currentStep} onStepClick={handleStepClick} data={data} />
        </div>

        {/* Scrollable form content */}
        <div className="flex-1 overflow-y-auto px-4 py-5 lg:px-6" ref={containerRef}>
          <div ref={formCardRef}>
            {error && (
              <div
                role="alert"
                aria-live="assertive"
                className="mb-4 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-600"
              >
                {error}
              </div>
            )}
            {stepContent}
          </div>
        </div>

        {/* Footer nav */}
        <div className="border-t border-slate-200 bg-white px-4 py-3 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={handleBack}
            disabled={isFirstStep}
            className={[
              "inline-flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-medium transition-all",
              isFirstStep
                ? "cursor-not-allowed text-slate-300"
                : "text-slate-600 hover:bg-slate-100 active:scale-[0.98]",
            ].join(" ")}
          >
            <ArrowLeft className="h-4 w-4" />
            <span>戻る</span>
          </button>

          <div className="flex items-center gap-2">
            {/* Mobile preview toggle */}
            <button
              type="button"
              onClick={() => setMobilePreviewOpen((v) => !v)}
              className="lg:hidden inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600"
            >
              <Eye className="h-3.5 w-3.5" />
              プレビュー
            </button>

            {isLastStep ? (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={loading}
                className={[
                  "inline-flex items-center gap-2 rounded-xl px-6 py-2.5 text-sm font-semibold transition-all",
                  "bg-gradient-to-r from-sky-500 to-cyan-400 text-white shadow-lg shadow-sky-200/50",
                  "hover:shadow-xl hover:shadow-sky-300/50 active:scale-[0.98]",
                  "disabled:cursor-not-allowed disabled:opacity-60 disabled:shadow-none",
                ].join(" ")}
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>生成中...</span>
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4" />
                    <span>送信して生成</span>
                  </>
                )}
              </button>
            ) : (
              <button
                type="button"
                onClick={handleNext}
                className={[
                  "inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold transition-all",
                  "bg-slate-900 text-white shadow-lg shadow-slate-200/50",
                  "hover:bg-slate-800 active:scale-[0.98]",
                ].join(" ")}
              >
                <span>次へ</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Right: Preview pane ── */}
      <div
        className={[
          "flex-1 bg-slate-100 border-l border-slate-200",
          mobilePreviewOpen
            ? "fixed inset-0 z-50 lg:relative lg:inset-auto lg:z-auto"
            : "hidden lg:block",
        ].join(" ")}
      >
        <div className="sticky top-0 h-screen flex flex-col overflow-hidden">
          {/* Preview header */}
          <div className="flex items-center justify-between px-4 py-3 border-b bg-white">
            <span className="text-xs font-medium text-slate-500">ライブプレビュー</span>
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
                {data.worldviewBase}
              </span>
              <button
                type="button"
                onClick={() => setMobilePreviewOpen(false)}
                className="lg:hidden text-xs text-slate-500 hover:text-slate-700"
              >
                閉じる
              </button>
            </div>
          </div>

          {/* Preview content */}
          <div className="flex-1 overflow-hidden p-5">
            <div className="w-full h-full rounded-2xl shadow-xl overflow-hidden border border-slate-200">
              <AuraFormPreview data={data} />
            </div>
          </div>

          <div className="border-t bg-white px-4 py-2 text-center">
            <span className="text-[10px] text-slate-400">
              入力内容がリアルタイムで反映されます
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
