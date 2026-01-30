// src/components/aiPortfolio/form/AuraFormStepper.tsx
"use client";

import { useMemo } from "react";
import { Check } from "lucide-react";
import { STEPS, type StepId, type AuraFormData, getCompletedSteps } from "./auraFormTypes";

type Props = {
  currentStep: StepId;
  data: AuraFormData;
  onStepClick?: (step: StepId) => void;
};

export function AuraFormStepper({ currentStep, data, onStepClick }: Props) {
  const completedSteps = useMemo(() => getCompletedSteps(data), [data]);
  return (
    <div className="w-full">
      {/* Desktop: 横並び */}
      <div className="hidden md:block">
        <div className="flex items-center justify-between">
          {STEPS.map((step, index) => {
            const isCompleted = completedSteps.includes(step.id);
            const isCurrent = currentStep === step.id;
            const isPast = step.id < currentStep;
            const isClickable = isCompleted || isPast || step.id <= currentStep;

            return (
              <div key={step.id} className="flex flex-1 items-start">
                {/* Step circle + label */}
                <button
                  type="button"
                  onClick={() => isClickable && onStepClick?.(step.id)}
                  disabled={!isClickable}
                  className={[
                    "group flex w-14 flex-col items-center gap-1 transition-all",
                    isClickable ? "cursor-pointer" : "cursor-not-allowed opacity-50",
                  ].join(" ")}
                >
                  {/* Circle */}
                  <div
                    className={[
                      "flex h-10 w-10 items-center justify-center rounded-full border-2 text-sm font-semibold transition-all",
                      isCurrent
                        ? "border-sky-500 bg-sky-500 text-white shadow-lg shadow-sky-200"
                        : isCompleted
                        ? "border-emerald-500 bg-emerald-500 text-white"
                        : isPast
                        ? "border-slate-300 bg-slate-100 text-slate-500"
                        : "border-slate-200 bg-white text-slate-400",
                      isClickable && !isCurrent && "group-hover:border-sky-300 group-hover:bg-sky-50",
                    ].join(" ")}
                  >
                    {isCompleted && !isCurrent ? (
                      <Check className="h-5 w-5" />
                    ) : (
                      step.id
                    )}
                  </div>

                  {/* Label */}
                  <span
                    className={[
                      "h-8 text-center text-[11px] font-medium leading-tight transition-colors",
                      isCurrent
                        ? "text-sky-600"
                        : isCompleted
                        ? "text-emerald-600"
                        : "text-slate-500",
                    ].join(" ")}
                  >
                    {step.label}
                  </span>
                </button>

                {/* Connector line */}
                {index < STEPS.length - 1 && (
                  <div className="mt-5 h-0.5 flex-1 -translate-y-0.5">
                    <div
                      className={[
                        "h-full rounded-full transition-colors",
                        step.id < currentStep || completedSteps.includes(step.id)
                          ? "bg-emerald-400"
                          : "bg-slate-200",
                      ].join(" ")}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Mobile: コンパクト表示 */}
      <div className="md:hidden">
        <div className="flex items-center justify-between gap-2 px-2">
          {/* Progress dots */}
          <div className="flex items-center gap-1.5">
            {STEPS.map((step) => {
              const isCompleted = completedSteps.includes(step.id);
              const isCurrent = currentStep === step.id;

              return (
                <button
                  key={step.id}
                  type="button"
                  onClick={() => onStepClick?.(step.id)}
                  className={[
                    "h-2 rounded-full transition-all",
                    isCurrent
                      ? "w-6 bg-sky-500"
                      : isCompleted
                      ? "w-2 bg-emerald-500"
                      : "w-2 bg-slate-300",
                  ].join(" ")}
                  aria-label={`Step ${step.id}: ${step.label}`}
                />
              );
            })}
          </div>

          {/* Current step label */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-sky-600">
              {currentStep}/{STEPS.length}
            </span>
            <span className="text-xs text-slate-600">
              {STEPS.find((s) => s.id === currentStep)?.label}
            </span>
          </div>
        </div>

        {/* Progress bar */}
        <div className="mt-2 h-1 w-full rounded-full bg-slate-200">
          <div
            className="h-1 rounded-full bg-gradient-to-r from-sky-500 to-cyan-400 transition-all duration-300"
            style={{ width: `${(currentStep / STEPS.length) * 100}%` }}
          />
        </div>
      </div>
    </div>
  );
}
