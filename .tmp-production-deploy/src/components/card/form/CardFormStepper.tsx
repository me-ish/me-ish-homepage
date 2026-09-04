// src/components/card/form/CardFormStepper.tsx
"use client";

import { Check } from "lucide-react";
import { CARD_FORM_STEPS, type CardFormStep } from "./cardFormTypes";

type Props = {
  current: CardFormStep;
  onStepClick?: (step: CardFormStep) => void;
};

export default function CardFormStepper({ current, onStepClick }: Props) {
  return (
    <>
      {/* Desktop stepper */}
      <div className="hidden md:flex items-center justify-center gap-0 w-full max-w-md mx-auto">
        {CARD_FORM_STEPS.map((step, i) => {
          const isComplete = step.id < current;
          const isCurrent = step.id === current;
          const canClick = isComplete;

          return (
            <div key={step.id} className="flex items-center">
              {/* Step circle */}
              <button
                type="button"
                disabled={!canClick}
                onClick={() => canClick && onStepClick?.(step.id)}
                className={`
                  flex items-center justify-center w-9 h-9 rounded-full text-sm font-semibold
                  transition-all duration-200
                  ${
                    isCurrent
                      ? "bg-sky-500 text-white shadow-md shadow-sky-200"
                      : isComplete
                        ? "bg-emerald-500 text-white cursor-pointer hover:bg-emerald-600"
                        : "bg-slate-100 text-slate-400 cursor-default"
                  }
                `}
              >
                {isComplete ? <Check className="w-4 h-4" /> : step.id}
              </button>

              {/* Label */}
              <span
                className={`ml-2 text-sm font-medium whitespace-nowrap ${
                  isCurrent
                    ? "text-sky-600"
                    : isComplete
                      ? "text-emerald-600"
                      : "text-slate-400"
                }`}
              >
                {step.label}
              </span>

              {/* Connector */}
              {i < CARD_FORM_STEPS.length - 1 && (
                <div
                  className={`w-8 h-0.5 mx-3 rounded ${
                    isComplete ? "bg-emerald-400" : "bg-slate-200"
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Mobile stepper */}
      <div className="md:hidden flex flex-col items-center gap-2">
        <div className="flex items-center gap-2">
          {CARD_FORM_STEPS.map((step) => {
            const isComplete = step.id < current;
            const isCurrent = step.id === current;
            return (
              <div
                key={step.id}
                className={`
                  rounded-full transition-all duration-200
                  ${
                    isCurrent
                      ? "w-3 h-3 bg-sky-500"
                      : isComplete
                        ? "w-2.5 h-2.5 bg-emerald-500"
                        : "w-2 h-2 bg-slate-200"
                  }
                `}
              />
            );
          })}
          <span className="ml-2 text-xs text-slate-500 font-medium">
            Step {current}/{CARD_FORM_STEPS.length}
          </span>
        </div>
        <div className="w-full max-w-xs bg-slate-100 rounded-full h-1.5">
          <div
            className="h-full rounded-full bg-gradient-to-r from-sky-500 to-cyan-400 transition-all duration-300"
            style={{
              width: `${((current - 1) / (CARD_FORM_STEPS.length - 1)) * 100}%`,
            }}
          />
        </div>
      </div>
    </>
  );
}
