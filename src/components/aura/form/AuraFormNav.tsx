// src/components/aura/form/AuraFormNav.tsx
"use client";

import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Send, Loader2 } from "lucide-react";
import { STEPS, type StepId, type AuraFormData, validateStep } from "./auraFormTypes";

type Props = {
  currentStep: StepId;
  onBack: () => void;
  onNext: () => void;
  onSubmit: () => void;
  loading: boolean;
  error: string | null;
  data: AuraFormData;
};

export function AuraFormNav({
  currentStep,
  onBack,
  onNext,
  onSubmit,
  loading,
  error,
  data,
}: Props) {
  const isFirstStep = currentStep === 1;
  const isLastStep = currentStep === STEPS.length;
  const stepErrors = validateStep(currentStep, data);
  const hasStepErrors = stepErrors.length > 0;

  // ✅ fixed ナビの高さを測って、ページ末尾にスペーサーを入れる
  const navRef = useRef<HTMLDivElement | null>(null);
  const [navHeight, setNavHeight] = useState(88); // fallback

  useLayoutEffect(() => {
    const el = navRef.current;
    if (!el) return;

    const measure = () => {
      const h = el.getBoundingClientRect().height;
      if (Number.isFinite(h) && h > 0) setNavHeight(Math.ceil(h));
    };

    measure();

    // ResizeObserver が使える環境では高さ変化にも追従
    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver(() => measure());
      ro.observe(el);
    }

    // 画面回転/リサイズ対策
    const onResize = () => measure();
    window.addEventListener("resize", onResize);

    return () => {
      window.removeEventListener("resize", onResize);
      ro?.disconnect();
    };
  }, []);

  // iOS の safe-area 分も確保（下部ホームバー対策）
  const spacerStyle: React.CSSProperties = {
    height: `calc(${navHeight}px + env(safe-area-inset-bottom))`,
  };

  return (
    <>
      {/* ✅ これが無いと、fixed の高さ分だけフォーム末尾が隠れる */}
      <div aria-hidden style={spacerStyle} />

      <div
        ref={navRef}
        className="fixed bottom-0 left-0 right-0 z-40 border-t border-slate-200 bg-white/95 backdrop-blur-sm"
        style={{
          paddingBottom: "env(safe-area-inset-bottom)",
        }}
      >
        <div className="mx-auto max-w-4xl px-4 py-3">
          {/* エラーメッセージ */}
          {error && (
            <div className="mb-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">
              {error}
            </div>
          )}

          {/* ナビゲーションボタン */}
          <div className="flex items-center justify-between gap-3">
            {/* 戻るボタン */}
            <button
              type="button"
              onClick={onBack}
              disabled={isFirstStep}
              className={[
                "inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-all",
                isFirstStep
                  ? "cursor-not-allowed text-slate-300"
                  : "text-slate-600 hover:bg-slate-100 active:scale-[0.98]",
              ].join(" ")}
            >
              <ArrowLeft className="h-4 w-4" />
              <span className="hidden sm:inline">戻る</span>
            </button>

            {/* ステップ表示 (モバイル中央) */}
            <div className="flex-1 text-center sm:hidden">
              <span className="text-xs text-slate-500">
                {currentStep} / {STEPS.length}
              </span>
            </div>

            {/* 次へ / 送信ボタン */}
            {isLastStep ? (
              <button
                type="button"
                onClick={onSubmit}
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
                onClick={onNext}
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

          {/* 任意：ステップエラーがあるなら「次へ」を無効化したい場合のフック
              現状のUI方針に合わせて、ここは表示のみ or disabled 追加を検討 */}
          {/* {hasStepErrors ? (
            <div className="mt-2 text-[11px] text-amber-600">
              入力が不足しています。上の項目を確認してください。
            </div>
          ) : null} */}
        </div>
      </div>
    </>
  );
}
