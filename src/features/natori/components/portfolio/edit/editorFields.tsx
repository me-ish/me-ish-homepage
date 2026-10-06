"use client";

// features/natori/components/portfolio/edit/editorFields.tsx
// ポートフォリオ編集画面の汎用パーツ（入力欄・画像アップロード・並び替えボタン等）
import { useNatoriConfirm } from "@/features/natori/components/admin/useNatoriConfirm";
import { natoriAdminUi } from "@/features/natori/constants/adminUi";
import { createContext, useContext, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { ImagePlus, Loader2, Plus, Trash2 } from "lucide-react";
import { CSRF_HEADERS } from "@/lib/auth/csrf";

/* ---------- レイアウト ---------- */

/** 保存できなかった値があるセクションの id。該当する SectionCard を枠で示す */
export const FlaggedSectionContext = createContext<string | null>(null);

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
  const flaggedId = useContext(FlaggedSectionContext);
  const flagged = id !== undefined && flaggedId === id;
  return (
    <section
      id={id}
      data-save-problem={flagged ? "true" : undefined}
      className={`scroll-mt-28 rounded-2xl ${natoriAdminUi.surface} p-4 sm:p-6${
        flagged ? " ring-2 ring-red-500 ring-offset-2" : ""
      }`}
    >
      <div className="mb-5 flex items-start gap-3">
        <span
          aria-hidden="true"
          className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-zinc-100 text-lg ring-1 ring-inset ring-zinc-500/10"
        >
          {emoji}
        </span>
        <div className="min-w-0">
          <h2 className="text-[16px] font-semibold leading-6 text-zinc-900 sm:text-lg">{title}</h2>
          {description ? (
            <p className="mt-0.5 text-xs leading-5 text-zinc-600">{description}</p>
          ) : null}
        </div>
      </div>
      {children}
    </section>
  );
}

/* ---------- 入力欄 ---------- */

const inputClass =
  natoriAdminUi.input;

export function TextInput({
  label,
  value,
  onChange,
  placeholder,
  hint,
  inputMode,
  error,
}: {
  label?: string;
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  hint?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
  /** 入力の形式に関する注意（表示のみ。保存は止めない） */
  error?: string;
}) {
  const id = useId();
  return (
    <div className="w-full">
      {label ? (
        <label htmlFor={id} className="mb-1.5 block text-xs font-semibold text-zinc-700">
          {label}
        </label>
      ) : null}
      <input
        id={id}
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        inputMode={inputMode}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        className={inputClass}
      />
      {hint ? <p className="mt-1 text-xs text-zinc-500">{hint}</p> : null}
      {error ? (
        <p id={`${id}-error`} className={natoriAdminUi.fieldError}>
          {error}
        </p>
      ) : null}
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
        <label htmlFor={id} className="mb-1.5 block text-xs font-semibold text-zinc-700">
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
      {hint ? <p className="mt-1 text-xs text-zinc-500">{hint}</p> : null}
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
  const { confirm, confirmDialog } = useNatoriConfirm();
  return (
    <div className="flex shrink-0 items-center gap-1">
      {confirmDialog}
      {handle}
      <button
        type="button"
        onClick={async () => {
          if (confirmMessage) {
            const confirmed = await confirm({
              title: "削除しますか？",
              description: confirmMessage,
              confirmLabel: "削除する",
              tone: "danger",
            });
            if (!confirmed) return;
          }
          onRemove();
        }}
        className={natoriAdminUi.btnIcon}
        aria-label="削除"
        title="削除"
      >
        <Trash2 className="h-4 w-4 text-red-700" aria-hidden />
      </button>
    </div>
  );
}

export function AddButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`mt-3 flex min-h-11 w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-zinc-300 bg-white px-4 text-sm font-semibold text-zinc-700 transition-colors hover:border-zinc-400 hover:bg-zinc-50 ${natoriAdminUi.focusRing}`}
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
  const onChangeRef = useRef(onChange);
  const mountedRef = useRef(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const handleFile = async (file: File | null) => {
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const url = await uploadImageFile(file);
      if (mountedRef.current) onChangeRef.current(url);
    } catch (err) {
      console.error("[portfolio-edit] upload failed", err);
      if (mountedRef.current) {
        setError("アップロードに失敗しました。画像は10MBまで（png / jpg / webp / gif）です。");
      }
    } finally {
      if (mountedRef.current) setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const previewClass =
    shape === "circle"
      ? "h-24 w-24 rounded-full"
      : "h-24 w-32 rounded-xl";

  return (
    <div>
      <p className="mb-1.5 text-xs font-semibold text-zinc-700">{label}</p>
      <div className="flex flex-wrap items-center gap-3">
        <div
          className={`${previewClass} grid shrink-0 place-items-center overflow-hidden border border-zinc-200/80 bg-zinc-50`}
        >
          {value ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={value} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="px-2 text-center text-xs font-semibold text-zinc-400">
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
            className={natoriAdminUi.btnSecondary}
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
              className="text-left text-xs font-semibold text-red-700 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#831843]"
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
      {hint ? <p className="mt-1 text-xs text-zinc-500">{hint}</p> : null}
      {error ? <p className={natoriAdminUi.fieldError}>{error}</p> : null}
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
