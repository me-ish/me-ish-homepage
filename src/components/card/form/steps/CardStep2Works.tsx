// src/components/card/form/steps/CardStep2Works.tsx
"use client";

import { useRef, useState, type MouseEvent as ReactMouseEvent } from "react";
import { Plus, X, ImagePlus, GripVertical, Crosshair } from "lucide-react";
import type { CardFormData } from "../cardFormTypes";
import { MAX_WORKS_FREE, MAX_WORKS_PREMIUM } from "../cardFormTypes";
import type { CardWorkItem } from "@/lib/card/card.schema";
import { CSRF_HEADERS } from "@/lib/auth/csrf";

type Props = {
  form: CardFormData;
  updateField: <K extends keyof CardFormData>(key: K, val: CardFormData[K]) => void;
  requestId: string | null;
  onRequireDraft: () => Promise<string | null>;
};

export default function CardStep2Works({
  form,
  updateField,
  requestId,
  onRequireDraft,
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const maxWorks = form.tier === "premium" ? MAX_WORKS_PREMIUM : MAX_WORKS_FREE;
  const canAdd = form.works.length < maxWorks;

  const handleUpload = async (file: File) => {
    if (!canAdd) return;

    let rid = requestId;
    if (!rid) {
      rid = await onRequireDraft();
      if (!rid) return;
    }

    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`/api/card/upload/works/${rid}`, {
        method: "POST",
        headers: { ...CSRF_HEADERS },
        body: fd,
      });
      const json = await res.json();
      if (json.ok) {
        const item: CardWorkItem = {
          imageUrl: json.url,
          path: json.path,
          title: "",
        };
        updateField("works", [...form.works, item]);
      }
    } catch (e) {
      console.error("work upload failed", e);
    } finally {
      setUploading(false);
    }
  };

  const removeWork = (index: number) => {
    updateField(
      "works",
      form.works.filter((_, i) => i !== index),
    );
  };

  const updateWorkTitle = (index: number, title: string) => {
    const next = [...form.works];
    next[index] = { ...next[index], title };
    updateField("works", next);
  };

  const moveWork = (from: number, to: number) => {
    if (to < 0 || to >= form.works.length) return;
    const next = [...form.works];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    updateField("works", next);
  };

  const updateWorkFocus = (index: number, e: ReactMouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const focusX = Math.round(((e.clientX - rect.left) / rect.width) * 100);
    const focusY = Math.round(((e.clientY - rect.top) / rect.height) * 100);
    const next = [...form.works];
    next[index] = { ...next[index], focusX, focusY };
    updateField("works", next);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-slate-800">
          作品アップロード
        </h2>
        <p className="text-sm text-slate-500 mt-1">
          名刺に表示する作品を最大5点アップロードできます
        </p>
      </div>

      {/* Works grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {form.works.map((work, i) => (
          <div
            key={`${work.path ?? work.imageUrl}-${i}`}
            className="relative group rounded-xl overflow-hidden border border-slate-200 bg-white shadow-sm"
          >
            {/* Image with focal point */}
            <div
              className="aspect-[4/3] bg-slate-50 overflow-hidden relative cursor-crosshair"
              onClick={(e) => updateWorkFocus(i, e)}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={work.imageUrl}
                alt={work.title || `作品 ${i + 1}`}
                className="w-full h-full object-cover"
                style={{
                  objectPosition: `${work.focusX ?? 50}% ${work.focusY ?? 50}%`,
                }}
              />
              {/* Crosshair indicator */}
              {(work.focusX !== undefined && work.focusX !== 50) ||
              (work.focusY !== undefined && work.focusY !== 50) ? (
                <div
                  className="absolute w-5 h-5 pointer-events-none -translate-x-1/2 -translate-y-1/2"
                  style={{
                    left: `${work.focusX ?? 50}%`,
                    top: `${work.focusY ?? 50}%`,
                  }}
                >
                  <Crosshair className="w-5 h-5 text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]" />
                </div>
              ) : null}
            </div>

            {/* Controls overlay */}
            <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              {i > 0 && (
                <button
                  type="button"
                  onClick={() => moveWork(i, i - 1)}
                  className="w-7 h-7 bg-white/90 rounded-full flex items-center justify-center text-slate-600 hover:bg-white shadow-sm text-xs"
                >
                  ↑
                </button>
              )}
              {i < form.works.length - 1 && (
                <button
                  type="button"
                  onClick={() => moveWork(i, i + 1)}
                  className="w-7 h-7 bg-white/90 rounded-full flex items-center justify-center text-slate-600 hover:bg-white shadow-sm text-xs"
                >
                  ↓
                </button>
              )}
              <button
                type="button"
                onClick={() => removeWork(i)}
                className="w-7 h-7 bg-white/90 rounded-full flex items-center justify-center text-red-500 hover:bg-red-50 shadow-sm"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Title input */}
            <div className="p-3">
              <input
                type="text"
                value={work.title ?? ""}
                onChange={(e) => updateWorkTitle(i, e.target.value)}
                placeholder="作品タイトル（任意）"
                className="w-full px-2 py-1.5 border border-slate-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent"
              />
            </div>
          </div>
        ))}

        {/* Add button */}
        {canAdd && (
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="aspect-[4/3] rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 flex flex-col items-center justify-center gap-2 text-slate-400 hover:border-sky-400 hover:text-sky-500 hover:bg-sky-50/50 transition-all cursor-pointer"
          >
            {uploading ? (
              <div className="w-6 h-6 border-2 border-sky-500 border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <ImagePlus className="w-8 h-8" />
                <span className="text-sm font-medium">作品を追加</span>
              </>
            )}
          </button>
        )}
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleUpload(f);
          e.target.value = "";
        }}
      />

      {/* Counter + hint */}
      <p className="text-xs text-slate-400 text-center">
        {form.works.length} / {maxWorks} 作品
      </p>
      {form.works.length > 0 && (
        <p className="text-xs text-slate-400 text-center">
          画像をクリックして表示の中心位置を調整できます
        </p>
      )}
    </div>
  );
}
