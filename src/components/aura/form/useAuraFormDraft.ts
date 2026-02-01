// src/components/aura/form/useAuraFormDraft.ts
"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import type { AuraFormData, StepId } from "./auraFormTypes";
import { defaultFormData } from "./auraFormTypes";

const STORAGE_KEY = "aura_form_draft_v2";
const DEBOUNCE_MS = 500;

type DraftState = {
  formData: AuraFormData;
  currentStep: StepId;
  savedAt: number;
};

export function useAuraFormDraft() {
  const [data, setDataState] = useState<AuraFormData>(defaultFormData);
  const [currentStep, setCurrentStepState] = useState<StepId>(1);
  const [isLoaded, setIsLoaded] = useState(false);

  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const initializedRef = useRef(false);

  // 初回マウント時にlocalStorageから復元
  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed: DraftState = JSON.parse(stored);

        // 24時間以内のドラフトのみ復元
        const hoursSinceSaved = (Date.now() - parsed.savedAt) / (1000 * 60 * 60);
        if (hoursSinceSaved < 24) {
          // images配列は復元しない（URLが期限切れの可能性）
          const restoredData: AuraFormData = {
            ...defaultFormData,
            ...parsed.formData,
            images: [], // 画像は再アップロード必要
            avatarPreviewUrl: "", // プレビューもリセット
          };
          setDataState(restoredData);
          setCurrentStepState(parsed.currentStep);
        }
      }
    } catch (e) {
    }

    setIsLoaded(true);
  }, []);

  // data/currentStep変更時にdebounce保存
  useEffect(() => {
    if (!isLoaded) return;

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      try {
        const state: DraftState = {
          formData: data,
          currentStep,
          savedAt: Date.now(),
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      } catch (e) {
      }
    }, DEBOUNCE_MS);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [data, currentStep, isLoaded]);

  // setData wrapper
  const setData = useCallback((updater: AuraFormData | ((prev: AuraFormData) => AuraFormData)) => {
    if (typeof updater === "function") {
      setDataState(updater);
    } else {
      setDataState(updater);
    }
  }, []);

  // setCurrentStep wrapper
  const setCurrentStep = useCallback((step: StepId | ((prev: StepId) => StepId)) => {
    if (typeof step === "function") {
      setCurrentStepState(step);
    } else {
      setCurrentStepState(step);
    }
  }, []);

  // ドラフトクリア
  const clearDraft = useCallback(() => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (e) {
    }
  }, []);

  // ドラフト存在確認
  const hasDraft = useCallback((): boolean => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) return false;
      const parsed: DraftState = JSON.parse(stored);
      const hoursSinceSaved = (Date.now() - parsed.savedAt) / (1000 * 60 * 60);
      return hoursSinceSaved < 24;
    } catch {
      return false;
    }
  }, []);

  return {
    data,
    setData,
    currentStep,
    setCurrentStep,
    clearDraft,
    hasDraft,
    isLoaded,
  };
}
