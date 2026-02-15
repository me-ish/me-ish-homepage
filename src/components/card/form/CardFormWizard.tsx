// src/components/card/form/CardFormWizard.tsx
"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Send, Loader2 } from "lucide-react";
import { CSRF_HEADERS } from "@/lib/auth/csrf";

import CardFormStepper from "./CardFormStepper";
import CardStep1Profile from "./steps/CardStep1Profile";
import CardStep2Works from "./steps/CardStep2Works";
import CardStep3Design from "./steps/CardStep3Design";
import { useCardFormDraft } from "./useCardFormDraft";
import { toCardFormInput, type CardFormStep } from "./cardFormTypes";

export default function CardFormWizard() {
  const router = useRouter();
  const { form, updateField, loaded } = useCardFormDraft();
  const [step, setStep] = useState<CardFormStep>(1);
  const [requestId, setRequestId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Create draft on first upload action
  const ensureDraft = useCallback(async (): Promise<string | null> => {
    if (requestId) return requestId;

    if (!form.email) {
      setError("メールアドレスを入力してください");
      setStep(1);
      return null;
    }

    try {
      const res = await fetch("/api/card/draft", {
        method: "POST",
        headers: { ...CSRF_HEADERS, "Content-Type": "application/json" },
        body: JSON.stringify({
          email: form.email,
          name: form.name,
          tier: form.tier,
        }),
      });
      const json = await res.json();
      if (json.ok && json.requestId) {
        setRequestId(json.requestId);
        return json.requestId;
      }
      setError("ドラフト作成に失敗しました");
      return null;
    } catch {
      setError("ネットワークエラーが発生しました");
      return null;
    }
  }, [requestId, form.email, form.name, form.tier]);

  // Validate current step
  const validateStep = (): boolean => {
    setError(null);
    if (step === 1) {
      if (!form.name.trim()) {
        setError("名前を入力してください");
        return false;
      }
      if (!form.title.trim()) {
        setError("肩書きを入力してください");
        return false;
      }
      if (!form.email.trim()) {
        setError("メールアドレスを入力してください");
        return false;
      }
      // Basic email format check
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
        setError("メールアドレスの形式が正しくありません");
        return false;
      }
    }
    return true;
  };

  const goNext = () => {
    if (!validateStep()) return;
    if (step < 3) setStep((s) => (s + 1) as CardFormStep);
  };

  const goBack = () => {
    if (step > 1) setStep((s) => (s - 1) as CardFormStep);
  };

  // Submit form
  const handleSubmit = async () => {
    if (!validateStep()) return;

    setSubmitting(true);
    setError(null);

    try {
      let rid = requestId;
      if (!rid) {
        rid = await ensureDraft();
        if (!rid) {
          setSubmitting(false);
          return;
        }
      }

      const input = toCardFormInput(form);

      const res = await fetch("/api/card/form/submit", {
        method: "POST",
        headers: { ...CSRF_HEADERS, "Content-Type": "application/json" },
        body: JSON.stringify({ requestId: rid, ...input }),
      });

      const json = await res.json();

      if (!json.ok) {
        setError(json.message || json.error || "送信に失敗しました");
        setSubmitting(false);
        return;
      }

      // Navigate to preview wait page
      router.push(`/card/preview/${rid}`);
    } catch {
      setError("ネットワークエラーが発生しました");
      setSubmitting(false);
    }
  };

  if (!loaded) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-6 h-6 text-sky-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      {/* Stepper */}
      <div className="mb-8">
        <CardFormStepper
          current={step}
          onStepClick={(s) => {
            if (s < step) setStep(s);
          }}
        />
      </div>

      {/* Form card */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8">
        {/* Error message */}
        {error && (
          <div className="mb-6 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
            {error}
          </div>
        )}

        {/* Step content */}
        {step === 1 && (
          <CardStep1Profile
            form={form}
            updateField={updateField}
            requestId={requestId}
            onRequireDraft={ensureDraft}
          />
        )}
        {step === 2 && (
          <CardStep2Works
            form={form}
            updateField={updateField}
            requestId={requestId}
            onRequireDraft={ensureDraft}
          />
        )}
        {step === 3 && (
          <CardStep3Design form={form} updateField={updateField} />
        )}
      </div>

      {/* Navigation */}
      <div className="mt-6 flex items-center justify-between">
        <button
          type="button"
          onClick={goBack}
          disabled={step === 1}
          className={`
            flex items-center gap-1 px-4 py-2.5 rounded-xl text-sm font-medium transition-all
            ${
              step === 1
                ? "text-slate-300 cursor-default"
                : "text-slate-600 hover:bg-slate-100"
            }
          `}
        >
          <ChevronLeft className="w-4 h-4" />
          戻る
        </button>

        {step < 3 ? (
          <button
            type="button"
            onClick={goNext}
            className="flex items-center gap-1 px-6 py-2.5 bg-sky-500 text-white rounded-xl text-sm font-medium hover:bg-sky-600 transition-colors shadow-sm"
          >
            次へ
            <ChevronRight className="w-4 h-4" />
          </button>
        ) : (
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className="flex items-center gap-2 px-6 py-2.5 bg-sky-500 text-white rounded-xl text-sm font-medium hover:bg-sky-600 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                生成中...
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                カードを作成
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
}
