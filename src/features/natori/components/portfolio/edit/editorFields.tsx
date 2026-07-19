"use client";

// features/natori/components/portfolio/edit/editorFields.tsx
// ポートフォリオ編集画面の汎用パーツ（入力欄・画像アップロード・並び替えボタン等）
import { useId, useRef, useState, type ReactNode } from "react";
import { ImagePlus, Loader2, Plus, Trash2 } from "lucide-react";
import { CSRF_HEADERS } from "@/lib/auth/csrf";

/* ---------- レイアウト ---------- */

export function SectionCard({
  id,
  emoji,
  title,
  description,
  children,
}: {
  /** 上部バーの目次ジャンプ用アンカー */
  id?: string;
  emoji: string;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      className="scroll-mt-28 rounded-2xl border border-pink-100 bg-white p-4 shadow-sm sm:p-5"
    >
      <div className="mb-4">
        <h2 className="flex items-center gap-2 text-base font-black text-gray-900 sm:text-lg">
          <span aria-hidden="true">{emoji}</span>
          {title}
        </h2>
        {description ? (
          <p className="mt-1 text-xs leading-5 text-gray-600">{description}</p>
        ) : null}
      </div>
      {children}
    </section>
  );
}

/* ---------- 入力欄 ---------- */

const inputClass =
  "w-full rounded-lg border border-pink-200 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-pink-300";

export function TextInput({
  label,
  value,
  onChange,
  placeholder,
  hint,
}: {
  label?: string;
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  hint?: string;
}) {
  const id = useId();
  return (
    <div className="w-full">
      {label ? (
        <label htmlFor={id} className="mb-1 block text-xs font-bold text-pink-700">
          {label}
        </label>
      ) : null}
      <input
        id={id}
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className={inputClass}
      />
      {hint ? <p className="mt-1 text-[11px] text-gray-500">{hint}</p> : null}
    </div>
  );
}

export function TextArea({
  label,
  value,
  onChange,
  rows = 3,
  placeholder,
  hint,
}: {
  label?: string;
  value: string;
  onChange: (next: string) => void;
  rows?: number;
  placeholder?: string;
  hint?: string;
}) {
  const id = useId();
  return (
    <div className="w-full">
      {label ? (
        <label htmlFor={id} className="mb-1 block text-xs font-bold text-pink-700">
          {label}
        </label>
      ) : null}
      <textarea
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={rows}
        placeholder={placeholder}
        className={inputClass}
      />
      {hint ? <p className="mt-1 text-[11px] text-gray-500">{hint}</p> : null}
    </div>
  );
}

/* ---------- リスト操作 ---------- */

export function RowControls({
  handle,
  onRemove,
  confirmMessage,
}: {
  /** SortableList から渡されるドラッグハンドル */
  handle?: ReactNode;
  onRemove: () => void;
  /** 指定すると削除前に確認ダイアログを出す（空行など失うものが無い行では省略する） */
  confirmMessage?: string;
}) {
  return (
    <div className="flex shrink-0 items-center gap-1">
      {handle}
      <button
        type="button"
        onClick={() => {
          if (confirmMessage && !window.confirm(confirmMessage)) return;
          onRemove();
        }}
        className="grid h-8 w-8 place-items-center rounded-lg border border-red-200 bg-white text-red-500 hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-pink-300"
        aria-label="削除"
        title="削除"
      >
        <Trash2 className="h-4 w-4" aria-hidden />
      </button>
    </div>
  );
}

export function AddButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-pink-300 bg-pink-50 px-4 py-2 text-xs font-bold text-pink-700 hover:bg-pink-100 focus:outline-none focus:ring-2 focus:ring-pink-300"
    >
      <Plus className="h-4 w-4" aria-hidden />
      {label}
    </button>
  );
}

/* ---------- 画像アップロード ---------- */

export async function uploadImageFile(file: File): Promise<string> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch("/api/natori/portfolio/upload", {
    method: "POST",
    headers: { ...CSRF_HEADERS },
    body: form,
  });
  const json = (await res.json().catch(() => null)) as { url?: string; error?: string } | null;
  if (!res.ok || !json?.url) {
    throw new Error(json?.error ?? `upload failed: ${res.status}`);
  }
  return json.url;
}

export function ImageUploadField({
  label,
  value,
  onChange,
  shape = "square",
  hint,
  uploadDisabled,
}: {
  label: string;
  value: string | null;
  onChange: (next: string | null) => void;
  /** プレビューの形。circle はアイコン系、square は作品系 */
  shape?: "circle" | "square";
  hint?: string;
  /** デモ環境用: アップロードを無効化して案内だけ出す */
  uploadDisabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFile = async (file: File | null) => {
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const url = await uploadImageFile(file);
      onChange(url);
    } catch (err) {
      console.error("[portfolio-edit] upload failed", err);
      setError("アップロードに失敗しました。画像は10MBまで（png / jpg / webp / gif）です。");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const previewClass =
    shape === "circle"
      ? "h-24 w-24 rounded-full"
      : "h-24 w-32 rounded-lg";

  return (
    <div>
      <p className="mb-1 text-xs font-bold text-pink-700">{label}</p>
      <div className="flex flex-wrap items-center gap-3">
        <div
          className={`${previewClass} grid shrink-0 place-items-center overflow-hidden border border-pink-100 bg-pink-50/60`}
        >
          {value ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={value} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="px-2 text-center text-[10px] font-bold text-pink-300">
              画像なし
            </span>
          )}
        </div>
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={() => {
              if (uploadDisabled) {
                setError("デモ環境のため、画像の変更はできません。");
                return;
              }
              inputRef.current?.click();
            }}
            disabled={uploading}
            className="inline-flex items-center gap-1.5 rounded-full bg-pink-500 px-4 py-2 text-xs font-bold text-white hover:bg-pink-600 disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-pink-300"
          >
            {uploading ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <ImagePlus className="h-4 w-4" aria-hidden />
            )}
            {uploading ? "アップロード中…" : value ? "画像を変更" : "画像を選ぶ"}
          </button>
          {value ? (
            <button
              type="button"
              onClick={() => onChange(null)}
              className="text-left text-xs font-bold text-red-500 hover:underline focus:outline-none focus:ring-2 focus:ring-pink-300"
            >
              画像を外す
            </button>
          ) : null}
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          className="hidden"
          onChange={(event) => handleFile(event.target.files?.[0] ?? null)}
        />
      </div>
      {hint ? <p className="mt-1 text-[11px] text-gray-500">{hint}</p> : null}
      {error ? <p className="mt-1 text-xs font-bold text-red-600">{error}</p> : null}
    </div>
  );
}

/* ---------- 配列ヘルパー ---------- */

export function updateItem<T>(items: T[], index: number, patch: Partial<T>): T[] {
  return items.map((item, i) => (i === index ? { ...item, ...patch } : item));
}

export function removeItem<T>(items: T[], index: number): T[] {
  return items.filter((_, i) => i !== index);
}
