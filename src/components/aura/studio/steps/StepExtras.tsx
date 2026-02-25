// src/components/aura/studio/steps/StepExtras.tsx
'use client';

import { useState } from 'react';
import { Plus, X, ChevronDown, ChevronUp } from 'lucide-react';
import type { StudioFormData, ServiceItem } from '@/lib/aura/studio/studioTypes';
import { SKILL_PRESET_CATEGORIES } from '@/lib/aura/studio/skillPresets';

type Props = {
  form: StudioFormData;
  onChange: (patch: Partial<StudioFormData>) => void;
};

// スキルプリセットピッカー
function SkillPresetPicker({
  selected,
  onToggle,
}: {
  selected: string[];
  onToggle: (skill: string) => void;
}) {
  const [openCategory, setOpenCategory] = useState<string | null>(null);

  return (
    <div className="rounded-xl border border-gray-100 overflow-hidden divide-y divide-gray-100">
      {SKILL_PRESET_CATEGORIES.map((cat) => {
        const isOpen = openCategory === cat.label;
        const selectedCount = cat.skills.filter((s) => selected.includes(s)).length;

        return (
          <div key={cat.label}>
            <button
              type="button"
              onClick={() => setOpenCategory(isOpen ? null : cat.label)}
              className="w-full flex items-center justify-between px-4 py-2.5 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
            >
              <span className="flex items-center gap-2 text-sm font-medium text-gray-700">
                <span>{cat.emoji}</span>
                {cat.label}
                {selectedCount > 0 && (
                  <span className="text-[11px] px-1.5 py-0.5 rounded-full bg-[#00a1e9] text-white font-semibold">
                    {selectedCount}
                  </span>
                )}
              </span>
              {isOpen ? (
                <ChevronUp className="w-4 h-4 text-gray-400" />
              ) : (
                <ChevronDown className="w-4 h-4 text-gray-400" />
              )}
            </button>

            {isOpen && (
              <div className="px-4 py-3 flex flex-wrap gap-2 bg-white">
                {cat.skills.map((skill) => {
                  const active = selected.includes(skill);
                  return (
                    <button
                      key={skill}
                      type="button"
                      onClick={() => onToggle(skill)}
                      className={[
                        'text-xs px-3 py-1.5 rounded-full border transition-colors',
                        active
                          ? 'bg-[#00a1e9] border-[#00a1e9] text-white'
                          : 'border-gray-200 text-gray-600 hover:border-[#00a1e9]/50 hover:text-[#00a1e9]',
                      ].join(' ')}
                    >
                      {active && <span className="mr-1">✓</span>}
                      {skill}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function StepExtras({ form, onChange }: Props) {
  const [newSkill, setNewSkill] = useState('');

  function togglePresetSkill(skill: string) {
    if (form.skills.includes(skill)) {
      onChange({ skills: form.skills.filter((s) => s !== skill) });
    } else {
      onChange({ skills: [...form.skills, skill] });
    }
  }

  function addCustomSkill() {
    const trimmed = newSkill.trim();
    if (!trimmed || form.skills.includes(trimmed)) return;
    onChange({ skills: [...form.skills, trimmed] });
    setNewSkill('');
  }

  function removeSkill(skill: string) {
    onChange({ skills: form.skills.filter((s) => s !== skill) });
  }

  function addService() {
    onChange({ services: [...form.services, { name: '', description: '', price: '' }] });
  }

  function updateService(idx: number, patch: Partial<ServiceItem>) {
    const next = form.services.map((s, i) => (i === idx ? { ...s, ...patch } : s));
    onChange({ services: next });
  }

  function removeService(idx: number) {
    onChange({ services: form.services.filter((_, i) => i !== idx) });
  }

  return (
    <div className="space-y-8">
      {/* Services */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold">サービス・メニュー</h2>
          <button
            type="button"
            onClick={addService}
            className="inline-flex items-center gap-1 text-sm text-[#00a1e9] hover:opacity-80"
          >
            <Plus className="w-4 h-4" /> 追加
          </button>
        </div>

        {form.services.length === 0 && (
          <p className="text-sm text-gray-400">
            提供しているサービスや料金メニューを追加してください（任意）。
          </p>
        )}

        <div className="space-y-3">
          {form.services.map((svc, idx) => (
            <div key={idx} className="rounded-lg border p-3 space-y-2 relative">
              <button
                type="button"
                onClick={() => removeService(idx)}
                className="absolute top-2 right-2 text-gray-400 hover:text-red-500"
              >
                <X className="w-4 h-4" />
              </button>
              <input
                type="text"
                className="w-full rounded border px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-[#00a1e9]/50"
                placeholder="サービス名（例：ロゴデザイン）"
                value={svc.name}
                onChange={(e) => updateService(idx, { name: e.target.value })}
              />
              <input
                type="text"
                className="w-full rounded border px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-[#00a1e9]/50"
                placeholder="説明（任意）"
                value={svc.description ?? ''}
                onChange={(e) => updateService(idx, { description: e.target.value })}
              />
              <input
                type="text"
                className="w-full rounded border px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-[#00a1e9]/50"
                placeholder="料金（任意）例：¥30,000〜"
                value={svc.price ?? ''}
                onChange={(e) => updateService(idx, { price: e.target.value })}
              />
            </div>
          ))}
        </div>
      </section>

      {/* Skills */}
      <section>
        <h2 className="text-lg font-bold mb-1">スキル・ツール</h2>
        <p className="text-sm text-gray-500 mb-3">カテゴリから選ぶか、自由入力で追加できます。</p>

        {/* 選択済みスキル */}
        {form.skills.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-3 p-3 rounded-xl bg-[#f8fbff] border border-[#00a1e9]/10">
            {form.skills.map((skill) => (
              <span
                key={skill}
                className="inline-flex items-center gap-1 rounded-full bg-[#00a1e9] text-white text-xs px-3 py-1"
              >
                {skill}
                <button type="button" onClick={() => removeSkill(skill)} className="ml-0.5 opacity-70 hover:opacity-100">
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
        )}

        {/* プリセットピッカー */}
        <SkillPresetPicker selected={form.skills} onToggle={togglePresetSkill} />

        {/* カスタム入力 */}
        <div className="mt-3">
          <p className="text-xs text-gray-500 mb-1.5">リストにないスキルを追加</p>
          <div className="flex gap-2">
            <input
              type="text"
              className="flex-1 rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#00a1e9]/50"
              placeholder="例：3Dモデリング、手描き"
              value={newSkill}
              onChange={(e) => setNewSkill(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCustomSkill(); } }}
            />
            <button
              type="button"
              onClick={addCustomSkill}
              className="px-3 py-2 rounded-lg bg-[#00a1e9] text-white text-sm font-medium hover:opacity-90"
            >
              追加
            </button>
          </div>
        </div>
      </section>

      {/* Social */}
      <section>
        <h2 className="text-lg font-bold mb-3">連絡先・SNS</h2>
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">X (Twitter)</label>
            <input
              type="url"
              className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#00a1e9]/50"
              placeholder="https://x.com/username"
              value={form.social.twitter ?? ''}
              onChange={(e) => onChange({ social: { ...form.social, twitter: e.target.value } })}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Instagram</label>
            <input
              type="url"
              className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#00a1e9]/50"
              placeholder="https://instagram.com/username"
              value={form.social.instagram ?? ''}
              onChange={(e) => onChange({ social: { ...form.social, instagram: e.target.value } })}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Webサイト</label>
            <input
              type="url"
              className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#00a1e9]/50"
              placeholder="https://example.com"
              value={form.social.website ?? ''}
              onChange={(e) => onChange({ social: { ...form.social, website: e.target.value } })}
            />
          </div>
        </div>
      </section>
    </div>
  );
}
