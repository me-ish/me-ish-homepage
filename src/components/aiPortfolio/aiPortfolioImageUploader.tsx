"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type AiPortfolioImageItem = {
  title?: string;
  description?: string;
  imageUrl: string; // DataURL
};

type Props = {
  value: AiPortfolioImageItem[];
  onChange: (next: AiPortfolioImageItem[]) => void;
  max?: number;
};

export default function AiPortfolioImageUploader({
  value,
  onChange,
  max = 5,
}: Props) {
  const [items, setItems] = useState<AiPortfolioImageItem[]>(value || []);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // ★ 親から value が更新されたときに同期
  useEffect(() => {
    setItems(value || []);
  }, [value]);

  const readAsDataUrl = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (e) => reject(e);
      reader.readAsDataURL(file);
    });

  const addFiles = useCallback(
    async (files: FileList | null) => {
      if (!files) return;

      const currentCount = items.length;
      const remain = Math.max(0, max - currentCount);
      if (remain <= 0) return;

      const fileArray = Array.from(files)
        .filter((f) => f.type.startsWith("image/"))
        .slice(0, remain);

      if (fileArray.length === 0) return;

      const urls = await Promise.all(fileArray.map(readAsDataUrl));
      const toAdd: AiPortfolioImageItem[] = urls.map((url, idx) => ({
        imageUrl: url,
        title: fileArray[idx].name,
      }));

      const next = [...items, ...toAdd].slice(0, max);
      setItems(next);
      onChange(next);
    },
    [items, max, onChange]
  );

  const canAdd = items.length < max;

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (!canAdd) return;
    addFiles(e.dataTransfer.files);
  };

  const handlePick = () => {
    if (!canAdd) return;
    inputRef.current?.click();
  };

  const updateMeta = (idx: number, patch: Partial<AiPortfolioImageItem>) => {
    const next = items.map((it, i) => (i === idx ? { ...it, ...patch } : it));
    setItems(next);
    onChange(next);
  };

  const remove = (idx: number) => {
    const next = items.filter((_, i) => i !== idx);
    setItems(next);
    onChange(next);
  };

  return (
    <div>
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
        onClick={handlePick}
        className={[
          "flex flex-col items-center justify-center rounded-lg border border-dashed p-6 text-center transition",
          canAdd
            ? "cursor-pointer hover:bg-gray-50"
            : "cursor-not-allowed bg-gray-50/60 text-gray-400",
        ].join(" ")}
      >
        <div className="text-sm">
          {canAdd
            ? "ここに画像をドラッグ＆ドロップ"
            : "これ以上画像を追加できません"}
        </div>
        {canAdd && (
          <div className="text-xs text-gray-500">
            またはクリックしてフォルダから選択
          </div>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple={max > 1}
          hidden
          onChange={(e) => addFiles(e.target.files)}
        />
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-3">
        {items.map((it, i) => (
          <div key={i} className="overflow-hidden rounded-lg border">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={it.imageUrl}
              className="h-40 w-full object-cover"
              alt={it.title ?? `image-${i + 1}`}
            />
            <div className="space-y-2 p-3">
              <input
                className="w-full rounded border px-2 py-1 text-sm"
                placeholder="作品タイトル"
                value={it.title ?? ""}
                onChange={(e) =>
                  updateMeta(i, {
                    title: e.target.value,
                  })
                }
              />
              <input
                className="w-full rounded border px-2 py-1 text-sm"
                placeholder="説明（任意）"
                value={it.description ?? ""}
                onChange={(e) =>
                  updateMeta(i, {
                    description: e.target.value,
                  })
                }
              />
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500">#{i + 1}</span>
                <button
                  type="button"
                  onClick={() => remove(i)}
                  className="text-xs text-red-600"
                >
                  削除
                </button>
              </div>
            </div>
          </div>
        ))}

        {canAdd && (
          <button
            type="button"
            onClick={handlePick}
            className="flex h-40 items-center justify-center rounded-lg border border-dashed text-3xl"
          >
            ＋
          </button>
        )}
      </div>
    </div>
  );
}
