// src/components/card/form/steps/CardStep1Profile.tsx
"use client";

import { useRef, useState } from "react";
import { Camera, X, Plus, Trash2 } from "lucide-react";
import type { CardFormData } from "../cardFormTypes";
import type { CardSnsLink } from "@/lib/card/card.schema";
import { CSRF_HEADERS } from "@/lib/auth/csrf";

type Props = {
  form: CardFormData;
  updateField: <K extends keyof CardFormData>(key: K, val: CardFormData[K]) => void;
  requestId: string | null;
  onRequireDraft: () => Promise<string | null>;
};

const SNS_OPTIONS = [
  { type: "twitter" as const, label: "X (Twitter)", placeholder: "https://x.com/..." },
  { type: "instagram" as const, label: "Instagram", placeholder: "https://instagram.com/..." },
  { type: "website" as const, label: "Website", placeholder: "https://..." },
] as const;

export default function CardStep1Profile({
  form,
  updateField,
  requestId,
  onRequireDraft,
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const handleAvatarUpload = async (file: File) => {
    let rid = requestId;
    if (!rid) {
      rid = await onRequireDraft();
      if (!rid) return;
    }
    setUploading(true);
    setUploadError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`/api/card/upload/avatar/${rid}`, {
        method: "POST",
        headers: { ...CSRF_HEADERS },
        body: fd,
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        setUploadError("画像のアップロードに失敗しました");
        return;
      }
      updateField("avatarUrl", json.url);
      updateField("avatarPath", json.path);
    } catch {
      setUploadError("通信エラーが発生しました");
    } finally {
      setUploading(false);
    }
  };

  const updateSns = (index: number, url: string) => {
    const next = [...form.sns];
    next[index] = { ...next[index], url };
    updateField("sns", next);
  };

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-bold text-slate-800">
        プロフィール情報
      </h2>

      {/* Avatar */}
      <div className="flex flex-col items-center gap-3">
        <div
          className="relative w-24 h-24 rounded-full bg-slate-100 border-2 border-dashed border-slate-300 flex items-center justify-center cursor-pointer overflow-hidden hover:border-sky-400 transition-colors"
          onClick={() => fileRef.current?.click()}
        >
          {form.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={form.avatarUrl}
              alt="avatar"
              className="w-full h-full object-cover"
            />
          ) : (
            <Camera className="w-6 h-6 text-slate-400" />
          )}
          {uploading && (
            <div className="absolute inset-0 bg-white/70 flex items-center justify-center">
              <div className="w-5 h-5 border-2 border-sky-500 border-t-transparent rounded-full animate-spin" />
            </div>
          )}
        </div>
        {form.avatarUrl && (
          <button
            type="button"
            onClick={() => {
              updateField("avatarUrl", "");
              updateField("avatarPath", "");
            }}
            className="text-xs text-slate-400 hover:text-red-500 transition-colors"
          >
            画像を削除
          </button>
        )}
        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleAvatarUpload(f);
            e.target.value = "";
          }}
        />
        <p className="text-xs text-slate-500">
          プロフィール画像（任意）
        </p>
        {uploadError && (
          <p className="text-xs text-red-500">{uploadError}</p>
        )}
      </div>

      {/* Name */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">
          名前 <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={form.name}
          onChange={(e) => updateField("name", e.target.value)}
          placeholder="山田 太郎"
          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent"
        />
        {/* PDF名刺での改行プレビュー */}
        {form.name && (
          <div className="mt-2 rounded-lg bg-slate-50 border border-slate-200 px-3 py-2">
            <p className="text-[10px] text-slate-400 mb-1">名刺PDFでの表示</p>
            <div
              style={{
                width: 93,
                fontSize: 16,
                fontWeight: 700,
                fontFamily: "sans-serif",
                lineHeight: 1.3,
                color: "#1e293b",
                wordBreak: "break-all",
              }}
            >
              {form.name}
            </div>
          </div>
        )}
      </div>

      {/* Title */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">
          肩書き <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={form.title}
          onChange={(e) => updateField("title", e.target.value)}
          placeholder="イラストレーター / デザイナー"
          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent"
        />
      </div>

      {/* Tagline */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">
          キャッチコピー
        </label>
        <input
          type="text"
          value={form.tagline}
          onChange={(e) => updateField("tagline", e.target.value)}
          placeholder="色彩で世界を描く"
          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent"
        />
      </div>

      {/* Email */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">
          メールアドレス <span className="text-red-500">*</span>
        </label>
        <input
          type="email"
          value={form.email}
          onChange={(e) => updateField("email", e.target.value)}
          placeholder="your@email.com"
          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent"
        />
      </div>

      {/* SNS Links */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-2">
          SNSリンク
        </label>
        <div className="space-y-3">
          {SNS_OPTIONS.map((opt, i) => (
            <div key={opt.type} className="flex items-center gap-2">
              <span className="text-xs text-slate-500 w-20 shrink-0">
                {opt.label}
              </span>
              <input
                type="url"
                value={form.sns[i]?.url ?? ""}
                onChange={(e) => updateSns(i, e.target.value)}
                placeholder={opt.placeholder}
                className="flex-1 px-3 py-1.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent"
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
