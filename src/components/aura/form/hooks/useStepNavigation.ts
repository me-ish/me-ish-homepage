// src/components/aura/form/hooks/useStepNavigation.ts
// Step navigation logic extracted from AuraFormWizard.

import { useCallback, useState, useEffect, type RefObject, type Dispatch, type SetStateAction } from "react";
import { STEPS, type StepId, type AuraFormData, validateStep } from "../auraFormTypes";

export function useStepNavigation(
  currentStep: StepId,
  setCurrentStep: Dispatch<SetStateAction<StepId>>,
  data: AuraFormData,
  setError: Dispatch<SetStateAction<string | null>>,
  containerRef: RefObject<HTMLDivElement | null>,
  formCardRef: RefObject<HTMLDivElement | null>,
) {
  const [stepAnnouncement, setStepAnnouncement] = useState("");

  // Announce step change + focus first input
  useEffect(() => {
    const stepInfo = STEPS.find((s) => s.id === currentStep);
    if (stepInfo) {
      setStepAnnouncement(`ステップ${currentStep}: ${stepInfo.label}`);
    }
    const timer = setTimeout(() => {
      const card = formCardRef.current;
      if (!card) return;
      const firstInput = card.querySelector<HTMLElement>(
        'input:not([type="hidden"]):not([disabled]), textarea:not([disabled]), select:not([disabled])'
      );
      firstInput?.focus();
    }, 100);
    return () => clearTimeout(timer);
  }, [currentStep, formCardRef]);

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
  }, [currentStep, data, setCurrentStep, setError, containerRef]);

  const handleBack = useCallback(() => {
    if (currentStep > 1) {
      setCurrentStep((currentStep - 1) as StepId);
      setError(null);
      containerRef.current?.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [currentStep, setCurrentStep, setError, containerRef]);

  const handleStepClick = useCallback((step: StepId) => {
    if (step < currentStep) {
      setCurrentStep(step);
      setError(null);
      return;
    }
    for (let s = 1 as StepId; s < step; s++) {
      const errors = validateStep(s, data);
      if (errors.length > 0) {
        setError(`ステップ${s}の入力が完了していません`);
        return;
      }
    }
    setCurrentStep(step);
  }, [currentStep, data, setCurrentStep, setError]);

  const handleEditStep = useCallback((step: StepId) => {
    setCurrentStep(step);
    setError(null);
  }, [setCurrentStep, setError]);

  return { handleNext, handleBack, handleStepClick, handleEditStep, stepAnnouncement };
}
