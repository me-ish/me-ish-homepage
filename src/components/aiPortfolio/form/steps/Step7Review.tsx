// src/components/aiPortfolio/form/steps/Step7Review.tsx
"use client";

import { Check, Edit2 } from "lucide-react";
import type { AuraFormData, StepId } from "../auraFormTypes";

type Props = {
  data: AuraFormData;
  onEditStep: (step: StepId) => void;
};

export function Step7Review({ data, onEditStep }: Props) {
  return (
    <div className="space-y-6">
      {/* ヘッダー */}
      <div className="text-center">
        <h2 className="text-xl font-semibold text-slate-900 md:text-2xl">
          入力内容の確認
        </h2>
        <p className="mt-2 text-sm text-slate-500">
          内容を確認して、問題なければ送信してください
        </p>
      </div>

      <div className="mx-auto max-w-xl space-y-4">
        {/* Step 1: プロフィール */}
        <ReviewCard
          step={1}
          title="プロフィール"
          onEdit={() => onEditStep(1)}
        >
          <div className="space-y-2">
            <ReviewItem label="名前" value={data.name} />
            <ReviewItem label="メール" value={data.email} />
            <ReviewItem label="肩書き" value={data.title} />
            {data.tagline && <ReviewItem label="キャッチコピー" value={data.tagline} />}
            {data.avatarPreviewUrl && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500">画像:</span>
                <img
                  src={data.avatarPreviewUrl}
                  alt="Avatar"
                  className="h-8 w-8 rounded-full object-cover"
                />
              </div>
            )}
          </div>
        </ReviewCard>

        {/* Step 2: デザイン */}
        <ReviewCard
          step={2}
          title="世界観・デザイン"
          onEdit={() => onEditStep(2)}
        >
          <div className="space-y-2">
            <ReviewItem
              label="世界観"
              value={data.worldviewBase.charAt(0).toUpperCase() + data.worldviewBase.slice(1)}
            />
            <ReviewItem label="調整度" value={`${data.aiSwing}%`} />
          </div>
        </ReviewCard>

        {/* Step 3: 作品 */}
        <ReviewCard
          step={3}
          title="作品"
          onEdit={() => onEditStep(3)}
        >
          {data.images.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {data.images.map((img, i) => (
                <img
                  key={i}
                  src={img.imageUrl}
                  alt={`Work ${i + 1}`}
                  className="h-12 w-12 rounded-lg object-cover"
                />
              ))}
              <span className="self-center text-xs text-slate-500">
                {data.images.length}枚
              </span>
            </div>
          ) : (
            <p className="text-xs text-slate-400">未アップロード</p>
          )}
        </ReviewCard>

        {/* Step 4: About */}
        <ReviewCard
          step={4}
          title="自己紹介"
          onEdit={() => onEditStep(4)}
        >
          <div className="space-y-2">
            {data.bio ? (
              <p className="line-clamp-2 text-xs text-slate-600">{data.bio}</p>
            ) : (
              <p className="text-xs text-slate-400">未入力</p>
            )}
            <div className="flex flex-wrap gap-1">
              {Object.entries(data.sections)
                .filter(([, v]) => v)
                .map(([key]) => (
                  <span
                    key={key}
                    className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-600"
                  >
                    {key}
                  </span>
                ))}
            </div>
          </div>
        </ReviewCard>

        {/* Step 5: Services & Skills */}
        <ReviewCard
          step={5}
          title="サービス＆スキル"
          onEdit={() => onEditStep(5)}
        >
          <div className="space-y-2">
            {data.services.length > 0 && (
              <div className="text-xs text-slate-600">
                サービス: {data.services.map((s) => s.name).join(", ")}
              </div>
            )}
            {(data.skillPresets.length > 0 || data.manualSkills) && (
              <div className="flex flex-wrap gap-1">
                {data.skillPresets.map((skill) => (
                  <span
                    key={skill}
                    className="rounded-full bg-sky-100 px-2 py-0.5 text-[10px] text-sky-700"
                  >
                    {skill}
                  </span>
                ))}
                {data.manualSkills &&
                  data.manualSkills.split(",").map((skill, i) => (
                    <span
                      key={i}
                      className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-600"
                    >
                      {skill.trim()}
                    </span>
                  ))}
              </div>
            )}
            {data.services.length === 0 && !data.skillPresets.length && !data.manualSkills && (
              <p className="text-xs text-slate-400">未設定</p>
            )}
          </div>
        </ReviewCard>

        {/* Step 6: Contact */}
        <ReviewCard
          step={6}
          title="連絡先"
          onEdit={() => onEditStep(6)}
        >
          {data.twitter || data.instagram || data.behance || data.website ? (
            <div className="flex flex-wrap gap-2 text-xs">
              {data.twitter && <span className="text-slate-600">X: {data.twitter}</span>}
              {data.instagram && <span className="text-slate-600">IG: {data.instagram}</span>}
              {data.behance && <span className="text-slate-600">Be: {data.behance}</span>}
              {data.website && <span className="text-slate-600">Web: {data.website}</span>}
            </div>
          ) : (
            <p className="text-xs text-slate-400">未設定</p>
          )}
        </ReviewCard>

        {/* 送信ヒント */}
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-center">
          <div className="flex items-center justify-center gap-2 text-emerald-700">
            <Check className="h-5 w-5" />
            <span className="font-medium">準備完了！</span>
          </div>
          <p className="mt-1 text-xs text-emerald-600">
            下の「送信して生成」ボタンを押すと、ポートフォリオが自動生成されます
          </p>
        </div>
      </div>
    </div>
  );
}

function ReviewCard({
  step,
  title,
  children,
  onEdit,
}: {
  step: number;
  title: string;
  children: React.ReactNode;
  onEdit: () => void;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-600">
            {step}
          </span>
          <span className="text-sm font-medium text-slate-800">{title}</span>
        </div>
        <button
          type="button"
          onClick={onEdit}
          className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-slate-500 hover:bg-slate-100 hover:text-slate-700"
        >
          <Edit2 className="h-3 w-3" />
          編集
        </button>
      </div>
      {children}
    </div>
  );
}

function ReviewItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline gap-2">
      <span className="text-xs text-slate-500">{label}:</span>
      <span className="text-sm text-slate-800">{value}</span>
    </div>
  );
}
