// src/components/aura/studio/steps/StepExtras.tsx
'use client';

import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import type { StudioFormData, ServiceItem } from '@/lib/aura/studio/studioTypes';

type Props = {
  form: StudioFormData;
  onChange: (patch: Partial<StudioFormData>) => void;
};

export default function StepExtras({ form, onChange }: Props) {
  const [newSkill, setNewSkill] = useState('');

  function addSkill() {
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
        <h2 className="text-lg font-bold mb-3">スキル・ツール</h2>
        <div className="flex gap-2 mb-3">
          <input
            type="text"
            className="flex-1 rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#00a1e9]/50"
            placeholder="例：Figma、Illustrator、React"
            value={newSkill}
            onChange={(e) => setNewSkill(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addSkill(); } }}
          />
          <button
            type="button"
            onClick={addSkill}
            className="px-3 py-2 rounded-lg bg-[#00a1e9] text-white text-sm font-medium hover:opacity-90"
          >
            追加
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          {form.skills.map((skill) => (
            <span
              key={skill}
              className="inline-flex items-center gap-1 rounded-full border bg-gray-50 px-3 py-1 text-sm"
            >
              {skill}
              <button type="button" onClick={() => removeSkill(skill)} className="ml-1 text-gray-400 hover:text-red-500">
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
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
