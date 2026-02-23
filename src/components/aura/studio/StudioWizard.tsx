// src/components/aura/studio/StudioWizard.tsx
'use client';

import { useState, useCallback, useRef } from 'react';
import { CSRF_HEADERS } from '@/lib/auth/csrf';
import { DEFAULT_STUDIO_FORM } from '@/lib/aura/studio/studioTypes';
import type { StudioFormData } from '@/lib/aura/studio/studioTypes';
import StepProfile from './steps/StepProfile';
import StepWorks from './steps/StepWorks';
import StepExtras from './steps/StepExtras';
import StepTheme from './steps/StepTheme';
import StudioPreview from './StudioPreview';
import { ChevronLeft, ChevronRight, Eye, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';

const STEPS = [
  { id: 'profile', label: 'プロフィール' },
  { id: 'works', label: '作品' },
  { id: 'extras', label: 'その他' },
  { id: 'theme', label: 'テーマ' },
] as const;

type StepId = typeof STEPS[number]['id'];

type Props = {
  /** 既存プロジェクトIDがあれば（再開時など） */
  initialProjectId?: string;
};

export default function StudioWizard({ initialProjectId }: Props) {
  const router = useRouter();
  const [projectId, setProjectId] = useState<string | null>(initialProjectId ?? null);
  const [step, setStep] = useState<StepId>('profile');
  const [form, setForm] = useState<StudioFormData>(DEFAULT_STUDIO_FORM);
  const [showPreview, setShowPreview] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const currentStepIdx = STEPS.findIndex((s) => s.id === step);
  const isLastStep = currentStepIdx === STEPS.length - 1;
  const isFirstStep = currentStepIdx === 0;

  /** フォームの部分更新 */
  const handleChange = useCallback((patch: Partial<StudioFormData>) => {
    setForm((prev) => ({ ...prev, ...patch }));
  }, []);

  /** ドラフト作成（初回のみ） */
  async function ensureProject(): Promise<string | null> {
    if (projectId) return projectId;

    try {
      const res = await fetch('/api/aura/studio/draft', {
        method: 'POST',
        headers: { ...CSRF_HEADERS, 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error ?? 'draft_failed');
      setProjectId(json.id);
      return json.id as string;
    } catch (e) {
      console.error('[StudioWizard] ensureProject error', e);
      setSaveError('プロジェクトの作成に失敗しました。');
      return null;
    }
  }

  /** 自動保存（debounced） */
  const autoSave = useCallback(async (data: StudioFormData, pid: string) => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      try {
        setIsSaving(true);
        await fetch(`/api/aura/studio/save/${pid}`, {
          method: 'POST',
          headers: { ...CSRF_HEADERS, 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });
      } catch (e) {
        console.error('[StudioWizard] autoSave error', e);
      } finally {
        setIsSaving(false);
      }
    }, 1200);
  }, []);

  /** フォーム変更 + 自動保存トリガー */
  const handleChangeWithSave = useCallback(
    (patch: Partial<StudioFormData>) => {
      setForm((prev) => {
        const next = { ...prev, ...patch };
        if (projectId) autoSave(next, projectId);
        return next;
      });
    },
    [projectId, autoSave]
  );

  /** 「次へ」ボタン */
  async function handleNext() {
    setSaveError(null);

    // 最初のステップで次へ → ドラフト作成
    if (!projectId) {
      const pid = await ensureProject();
      if (!pid) return;
      // 入力済みのプロフィールを即保存
      await fetch(`/api/aura/studio/save/${pid}`, {
        method: 'POST',
        headers: { ...CSRF_HEADERS, 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
    }

    const nextIdx = currentStepIdx + 1;
    if (nextIdx < STEPS.length) {
      setStep(STEPS[nextIdx].id);
    }
  }

  /** 「公開する」ボタン */
  async function handlePublish() {
    setSaveError(null);
    if (!projectId) {
      setSaveError('プロジェクトが作成されていません。');
      return;
    }

    setIsPublishing(true);
    try {
      // 最終保存
      await fetch(`/api/aura/studio/save/${projectId}`, {
        method: 'POST',
        headers: { ...CSRF_HEADERS, 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });

      // 公開
      const res = await fetch(`/api/aura/studio/publish/${projectId}`, {
        method: 'POST',
        headers: { ...CSRF_HEADERS },
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error ?? 'publish_failed');

      router.push(`/aura/studio/p/${json.publicId}`);
    } catch (e) {
      console.error('[StudioWizard] publish error', e);
      setSaveError('公開に失敗しました。もう一度お試しください。');
    } finally {
      setIsPublishing(false);
    }
  }

  const currentStep = STEPS[currentStepIdx];

  return (
    <div className="flex flex-col lg:flex-row h-full min-h-screen">
      {/* Left: Form pane */}
      <div className="flex flex-col flex-1 lg:max-w-lg xl:max-w-xl bg-white">
        {/* Step nav */}
        <div className="border-b px-6 py-3">
          <div className="flex items-center gap-2">
            {STEPS.map((s, i) => (
              <button
                key={s.id}
                type="button"
                onClick={() => projectId && setStep(s.id)}
                disabled={!projectId && i > 0}
                className={[
                  'flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full transition',
                  s.id === step
                    ? 'bg-[#00a1e9] text-white font-semibold'
                    : 'text-gray-500 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed',
                ].join(' ')}
              >
                <span className="font-bold">{i + 1}</span>
                <span className="hidden sm:inline">{s.label}</span>
              </button>
            ))}

            {/* Save indicator */}
            <div className="ml-auto">
              {isSaving && (
                <span className="flex items-center gap-1 text-[11px] text-gray-400">
                  <Loader2 className="w-3 h-3 animate-spin" /> 保存中
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Step content */}
        <div className="flex-1 overflow-y-auto px-6 py-6">
          {saveError && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
              {saveError}
            </div>
          )}

          {currentStep.id === 'profile' && (
            <StepProfile form={form} projectId={projectId} onChange={handleChangeWithSave} />
          )}
          {currentStep.id === 'works' && (
            <StepWorks form={form} projectId={projectId} onChange={handleChangeWithSave} />
          )}
          {currentStep.id === 'extras' && (
            <StepExtras form={form} onChange={handleChangeWithSave} />
          )}
          {currentStep.id === 'theme' && (
            <StepTheme form={form} onChange={handleChangeWithSave} />
          )}
        </div>

        {/* Footer nav */}
        <div className="border-t px-6 py-4 flex items-center justify-between bg-white">
          <button
            type="button"
            onClick={() => setStep(STEPS[currentStepIdx - 1].id)}
            disabled={isFirstStep}
            className="inline-flex items-center gap-1 text-sm text-gray-600 disabled:opacity-30"
          >
            <ChevronLeft className="w-4 h-4" /> 戻る
          </button>

          <div className="flex items-center gap-3">
            {/* Mobile preview toggle */}
            <button
              type="button"
              onClick={() => setShowPreview((v) => !v)}
              className="lg:hidden inline-flex items-center gap-1 text-sm text-[#00a1e9]"
            >
              <Eye className="w-4 h-4" />
              {showPreview ? '編集に戻る' : 'プレビュー'}
            </button>

            {isLastStep ? (
              <button
                type="button"
                onClick={handlePublish}
                disabled={isPublishing}
                className="inline-flex items-center gap-2 rounded-full bg-[#00a1e9] px-5 py-2 text-sm font-semibold text-white hover:brightness-105 disabled:opacity-60"
              >
                {isPublishing && <Loader2 className="w-4 h-4 animate-spin" />}
                公開する
              </button>
            ) : (
              <button
                type="button"
                onClick={handleNext}
                className="inline-flex items-center gap-1 rounded-full bg-[#00a1e9] px-5 py-2 text-sm font-semibold text-white hover:brightness-105"
              >
                次へ <ChevronRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Right: Preview pane */}
      <div
        className={[
          'flex-1 border-l bg-gray-100',
          // Mobile: overlay when showPreview
          showPreview
            ? 'fixed inset-0 z-50 bg-gray-100 lg:relative lg:inset-auto lg:z-auto'
            : 'hidden lg:block',
        ].join(' ')}
      >
        <div className="sticky top-0 h-screen overflow-hidden flex flex-col">
          <div className="flex items-center justify-between px-4 py-3 border-b bg-white">
            <span className="text-xs font-medium text-gray-500">ライブプレビュー</span>
            <button
              type="button"
              onClick={() => setShowPreview(false)}
              className="lg:hidden text-xs text-gray-500"
            >
              閉じる
            </button>
          </div>
          <div className="flex-1 overflow-hidden">
            <div className="w-full h-full max-w-sm mx-auto shadow-xl overflow-hidden">
              <StudioPreview form={form} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
