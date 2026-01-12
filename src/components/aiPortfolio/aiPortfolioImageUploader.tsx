// src/components/aiPortfolio/aiPortfolioImageUploader.tsx
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { auraAssetProxyUrl } from "@/lib/aiPortfolio/storage/auraAssets";

export type AiPortfolioImageItem = {
  title?: string;
  description?: string;

    /** ✅ 追加：制作年（任意） */
  year?: number;

  // 表示用（Public URL または proxy URL）
  imageUrl: string;

  // 推奨：DB保存の本体（Supabase Storageのpath）
  // 例: works/{requestId}/{timestamp}_{rand}.webp
  storagePath?: string;
};

type Props = {
  value: AiPortfolioImageItem[];
  onChange: (next: AiPortfolioImageItem[]) => void;
  max?: number;

  // draft単位アップロードに必須
  requestId: string | null;

  // 任意：draft未作成時のメッセージを親で出したい場合
  onRequireDraft?: () => void;

  /**
   * APIパス
   * 例：/api/aiPortfolio/upload/works/[id]
   */
  uploadEndpointBase?: string; // default: "/api/aiPortfolio/upload/works"
};

type PendingItem = {
  localId: string;
  previewUrl: string; // objectURL
  fileName: string;
  status: "uploading" | "error";
  error?: string;
};

type UploadResult = {
  url?: string; // public or proxy url (optional)
  path: string; // storage path (required)
};

function makeLocalId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function baseNameFromFileName(name: string) {
  const s = (name ?? "").trim();
  if (!s) return "";
  // 最後の拡張子だけ落とす（.tar.gz 等は最後だけ）
  return s.replace(/\.[^/.]+$/, "");
}

/** value同期で無限ループを防ぐための “浅い比較” */
function sameItems(a: AiPortfolioImageItem[], b: AiPortfolioImageItem[]) {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const A = a[i];
    const B = b[i];
    if (
      (A.storagePath ?? "") !== (B.storagePath ?? "") ||
      (A.imageUrl ?? "") !== (B.imageUrl ?? "") ||
      (A.title ?? "") !== (B.title ?? "") ||
      (A.description ?? "") !== (B.description ?? "") ||
      (A.year ?? null) !== (B.year ?? null)

    ) {
      return false;
    }

  }
  return true;
}

function normalizeItem(it: AiPortfolioImageItem): AiPortfolioImageItem {
  // imageUrl が空でも、storagePath があれば proxy で表示可能にする
  if ((!it.imageUrl || it.imageUrl.trim() === "") && it.storagePath) {
    return { ...it, imageUrl: auraAssetProxyUrl(it.storagePath) };
  }
  return it;
}

export default function AiPortfolioImageUploader({
  value,
  onChange,
  max = 5,
  requestId,
  onRequireDraft,
  uploadEndpointBase = "/api/aiPortfolio/upload/works",
}: Props) {
  const [items, setItems] = useState<AiPortfolioImageItem[]>(
    () => (value ?? []).map(normalizeItem)
  );
  const [pending, setPending] = useState<PendingItem[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // 世代ID：アップロード結果の競合（古い結果で上書き）を防止
  const uploadGenRef = useRef(0);

  const isSingle = max === 1;

  const canAdd = !isSingle && items.length + pending.length < max;
  const canInteract =
    (isSingle ? true : canAdd) &&
    (isSingle || items.length + pending.length < max);

  const dropLabel = useMemo(() => {
    if (isSingle) {
      return items.length === 0 && pending.length === 0
        ? "ここに画像をドラッグ＆ドロップ"
        : "ここにドラッグ＆ドロップ / クリックで画像を変更";
    }
    return canAdd ? "ここに画像をドラッグ＆ドロップ" : "これ以上画像を追加できません";
  }, [isSingle, items.length, pending.length, canAdd]);

  function humanizeUploadError(e: unknown): string {
    const msg = e instanceof Error ? e.message : String(e ?? "");
    if (msg.includes("file_too_large")) return "ファイルサイズが大きすぎます。";
    if (msg.includes("invalid_mime")) return "対応していない画像形式です。";
    return "作品画像のアップロードに失敗しました。";
  }

  /** items を更新する時は必ず親にも同期（controlled成立） */
  const commitItems = useCallback(
    (next: AiPortfolioImageItem[]) => {
      setItems(next);
      onChange(next);
    },
    [onChange]
  );

  // ------------------------------
  // ✅ 並び替えヘルパー（確定済みitemsのみ）
  // ------------------------------
  const moveItem = useCallback(
    (from: number, to: number) => {
      if (from === to) return;
      if (from < 0 || from >= items.length) return;
      if (to < 0 || to >= items.length) return;

      const next = items.slice();
      const [picked] = next.splice(from, 1);
      next.splice(to, 0, picked);
      commitItems(next);
    },
    [items, commitItems]
  );

  const moveUp = useCallback(
    (idx: number) => moveItem(idx, idx - 1),
    [moveItem]
  );

  const moveDown = useCallback(
    (idx: number) => moveItem(idx, idx + 1),
    [moveItem]
  );

  const setAsCover = useCallback(
    (idx: number) => moveItem(idx, 0),
    [moveItem]
  );

  /**
   * Worksアップロード
   * 期待：{ ok: true, url?: string, path: string }
   */
  async function uploadToServer(file: File, reqId: string): Promise<UploadResult> {
    const fd = new FormData();
    fd.append("file", file);

    const res = await fetch(`${uploadEndpointBase}/${reqId}`, {
      method: "POST",
      body: fd,
    });

    const json = await res.json().catch(() => null);

    if (!res.ok || !json?.ok) {
      const message = json?.message ? String(json.message) : undefined;
      throw new Error(message ?? "upload_failed");
    }

    // バッチ互換
    if (Array.isArray(json?.uploaded) && json.uploaded.length > 0) {
      const first = json.uploaded[0];
      if (!first?.path) throw new Error("upload_failed");
      return {
        path: String(first.path),
        url: first?.url ? String(first.url) : undefined,
      };
    }

    if (!json?.path) throw new Error("upload_failed");

    return {
      path: String(json.path),
      url: json?.url ? String(json.url) : undefined,
    };
  }

  /** 親 value が変わったら同期（差分がある時だけ） */
  useEffect(() => {
    const next = (value ?? []).map(normalizeItem);
    setItems((prev) => (sameItems(prev, next) ? prev : next));
  }, [value]);

  /** unmountでobjectURL解放 */
  useEffect(() => {
    return () => {
      for (const p of pending) URL.revokeObjectURL(p.previewUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const addFiles = useCallback(
    async (files: FileList | null) => {
      if (!files) return;

      setError(null);

      const all = Array.from(files).filter((f) => f.type.startsWith("image/"));
      if (all.length === 0) return;

      if (!requestId) {
        setError("先にメールを入力して下書き（draft）を作成してください。");
        onRequireDraft?.();
        if (inputRef.current) inputRef.current.value = "";
        return;
      }

      const myGen = ++uploadGenRef.current;

      const chosen = isSingle ? all.slice(0, 1) : all;
      const remain = isSingle ? 1 : Math.max(0, max - (items.length + pending.length));
      const sliced = isSingle ? chosen : chosen.slice(0, remain);

      if (sliced.length === 0) {
        if (inputRef.current) inputRef.current.value = "";
        return;
      }

      const pendings: PendingItem[] = sliced.map((f) => ({
        localId: makeLocalId(),
        previewUrl: URL.createObjectURL(f),
        fileName: f.name,
        status: "uploading",
      }));

      // max=1 は差し替え：既存pending解放＋itemsクリア（親にも同期）
      if (isSingle) {
        setPending((prev) => {
          for (const p of prev) URL.revokeObjectURL(p.previewUrl);
          return [];
        });
        commitItems([]);
      }

      setPending((prev) => [...prev, ...pendings]);

      try {
        const results: { localId: string; item: AiPortfolioImageItem }[] = [];

        for (let idx = 0; idx < sliced.length; idx++) {
          const f = sliced[idx];
          const uploaded = await uploadToServer(f, requestId);

          // 世代チェック
          if (myGen !== uploadGenRef.current) {
            for (const p of pendings) URL.revokeObjectURL(p.previewUrl);
            return;
          }

          const localId = pendings[idx].localId;

          // storagePath から proxy 生成（統一）
          const imageUrl = auraAssetProxyUrl(uploaded.path);

results.push({
  localId,
  item: normalizeItem({
    imageUrl,
    storagePath: uploaded.path,
    // 「ファイル名」ではなく「表示用タイトル」に寄せる
    title: baseNameFromFileName(f.name) || "作品",
  }),
});
        }

        if (myGen !== uploadGenRef.current) {
          for (const p of pendings) URL.revokeObjectURL(p.previewUrl);
          return;
        }

        // pending除去＋objectURL解放
        setPending((prev) => {
          const removeIds = new Set(results.map((r) => r.localId));
          const next = prev.filter((p) => !removeIds.has(p.localId));
          for (const p of prev) {
            if (removeIds.has(p.localId)) URL.revokeObjectURL(p.previewUrl);
          }
          return next;
        });

        // items確定（親にも同期）
        const toAdd = results.map((r) => r.item);
        const next = isSingle ? toAdd.slice(0, 1) : [...items, ...toAdd].slice(0, max);
        commitItems(next);
      } catch (e) {
        const msg = humanizeUploadError(e);
        setError(msg);

        setPending((prev) =>
          prev.map((p) =>
            pendings.some((x) => x.localId === p.localId)
              ? { ...p, status: "error", error: msg }
              : p
          )
        );
      } finally {
        if (inputRef.current) inputRef.current.value = "";
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [requestId, max, onRequireDraft, isSingle, uploadEndpointBase, items, pending.length, commitItems]
  );

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (!canInteract) return;
    addFiles(e.dataTransfer.files);
  };

  const handlePick = () => {
    if (!canInteract) return;
    setError(null);
    inputRef.current?.click();
  };

  const updateMeta = (idx: number, patch: Partial<AiPortfolioImageItem>) => {
    const next = items.map((it, i) =>
      i === idx ? normalizeItem({ ...it, ...patch }) : it
    );
    commitItems(next);
  };

  const remove = (idx: number) => {
    const next = items.filter((_, i) => i !== idx);
    commitItems(next);
  };

  const removePending = (localId: string) => {
    setPending((prev) => {
      const target = prev.find((p) => p.localId === localId);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((p) => p.localId !== localId);
    });
  };

  return (
    <div>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
        onDragEnter={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (canInteract) setIsDragging(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setIsDragging(false);
        }}
        onDrop={handleDrop}
        onClick={handlePick}
        className={[
          "flex flex-col items-center justify-center rounded-lg border border-dashed p-6 text-center transition",
          canInteract
            ? "cursor-pointer hover:bg-gray-50"
            : "cursor-not-allowed bg-gray-50/60 text-gray-400",
          isDragging && canInteract ? "bg-gray-50 ring-2 ring-black/10" : "",
        ].join(" ")}
        aria-disabled={!canInteract}
      >
        <div className="text-sm">{dropLabel}</div>

        <div className="text-xs text-gray-500">
          {requestId
            ? "選択した瞬間にアップロードします"
            : "メール入力→draft作成後にアップロードできます"}
        </div>

        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple={!isSingle && max > 1}
          hidden
          onChange={(e) => addFiles(e.target.files)}
        />
      </div>

      {error && (
        <div className="mt-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* pending（アップロード中のローカルプレビュー） */}
      {pending.length > 0 && (
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          {pending.map((p) => (
            <div key={p.localId} className="overflow-hidden rounded-lg border">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={p.previewUrl}
                className="h-40 w-full object-cover"
                alt={p.fileName}
              />
              <div className="space-y-2 p-3">
                <div className="text-xs text-gray-600">
                  {p.status === "uploading" ? "アップロード中..." : "アップロード失敗"}
                </div>
                {p.error && <div className="text-xs text-red-600">{p.error}</div>}
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500">temp</span>
                  <button
                    type="button"
                    onClick={() => removePending(p.localId)}
                    className="text-xs text-red-600"
                  >
                    取り消す
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 確定済み */}
      <div className="mt-4 grid gap-4 md:grid-cols-3">
        {items.map((it, i) => {
          const isCover = i === 0 && !isSingle;

          return (
            <div
              key={`${(it.storagePath ?? it.imageUrl).slice(0, 48)}-${i}`}
              className="overflow-hidden rounded-lg border"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={it.imageUrl}
                className="h-40 w-full object-cover"
                alt={it.title ?? `image-${i + 1}`}
                onError={(e) => {
                  // 失敗時は proxy へフォールバック（原因切り分けしやすくする）
                  if (it.storagePath) {
                    (e.currentTarget as HTMLImageElement).src = auraAssetProxyUrl(
                      it.storagePath
                    );
                  }
                }}
              />

              <div className="space-y-2 p-3">
                {/* ✅ 並び替えUI（max=1以外のみ） */}
                {!isSingle ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="inline-flex overflow-hidden rounded-md border">
                      <button
                        type="button"
                        onClick={() => moveUp(i)}
                        disabled={i === 0}
                        className={[
                          "px-2 py-1 text-xs",
                          i === 0
                            ? "cursor-not-allowed bg-gray-50 text-gray-300"
                            : "bg-white text-gray-700 hover:bg-gray-50",
                        ].join(" ")}
                        title="上へ"
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        onClick={() => moveDown(i)}
                        disabled={i === items.length - 1}
                        className={[
                          "border-l px-2 py-1 text-xs",
                          i === items.length - 1
                            ? "cursor-not-allowed bg-gray-50 text-gray-300"
                            : "bg-white text-gray-700 hover:bg-gray-50",
                        ].join(" ")}
                        title="下へ"
                      >
                        ↓
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => setAsCover(i)}
                      disabled={i === 0}
                      className={[
                        "rounded-md border px-2 py-1 text-xs",
                        i === 0
                          ? "cursor-not-allowed bg-gray-50 text-gray-300"
                          : "bg-white text-gray-700 hover:bg-gray-50",
                      ].join(" ")}
                      title="表紙にする（先頭へ）"
                    >
                      表紙にする
                    </button>

                    {isCover ? (
                      <span className="rounded-full border border-sky-200 bg-sky-50 px-2 py-1 text-[10px] font-semibold text-sky-700">
                        表紙
                      </span>
                    ) : null}
                  </div>
                ) : null}

<input
  className="w-full rounded border px-2 py-1 text-sm"
  placeholder={isSingle ? "作品タイトル（表示用・任意）" : "作品タイトル（表示用）"}
  value={it.title ?? ""}
  onChange={(e) => updateMeta(i, { title: e.target.value })}
/>
                <input
  className="w-full rounded border px-2 py-1 text-sm"
  type="number"
  inputMode="numeric"
  min={1900}
  max={new Date().getFullYear() + 1}
  placeholder="制作年（任意） 例：2024"
  value={it.year ?? ""}
  onChange={(e) => {
    const raw = e.target.value;
    if (!raw) {
      updateMeta(i, { year: undefined });
      return;
    }
    const n = Number(raw);
    updateMeta(i, { year: Number.isFinite(n) ? n : undefined });
  }}
/>

                <input
                  className="w-full rounded border px-2 py-1 text-sm"
                  placeholder="説明（任意）"
                  value={it.description ?? ""}
                  onChange={(e) => updateMeta(i, { description: e.target.value })}
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

                {/* デバッグ：URLを直接開けるようにする */}
                <div className="flex items-center justify-between">
                  <a
                    className="text-[10px] text-gray-400 underline"
                    href={it.imageUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    open imageUrl
                  </a>
                </div>

                {it.storagePath && (
                  <div className="break-all text-[10px] text-gray-400">
                    {it.storagePath}
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {!isSingle && canAdd && (
          <button
            type="button"
            onClick={handlePick}
            className="flex h-40 items-center justify-center rounded-lg border border-dashed text-3xl transition hover:bg-gray-50"
          >
            ＋
          </button>
        )}
      </div>
    </div>
  );
}
