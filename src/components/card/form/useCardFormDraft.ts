// src/components/card/form/useCardFormDraft.ts
"use client";

import { useState, useEffect, useCallback } from "react";
import type { CardFormData } from "./cardFormTypes";
import { INITIAL_CARD_FORM } from "./cardFormTypes";

const STORAGE_KEY = "meish_card_draft";

export function useCardFormDraft() {
  const [form, setForm] = useState<CardFormData>(INITIAL_CARD_FORM);
  const [loaded, setLoaded] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as Partial<CardFormData>;
        setForm((prev) => ({ ...prev, ...parsed }));
      }
    } catch {
      // ignore parse errors
    }
    setLoaded(true);
  }, []);

  // Save to localStorage on change (debounced)
  useEffect(() => {
    if (!loaded) return;
    const timer = setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(form));
      } catch {
        // ignore quota errors
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [form, loaded]);

  const updateField = useCallback(
    <K extends keyof CardFormData>(key: K, value: CardFormData[K]) => {
      setForm((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  const resetForm = useCallback(() => {
    setForm(INITIAL_CARD_FORM);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  }, []);

  return { form, setForm, updateField, resetForm, loaded };
}
