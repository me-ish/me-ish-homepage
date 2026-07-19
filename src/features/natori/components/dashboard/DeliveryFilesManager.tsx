"use client";

// features/natori/components/dashboard/DeliveryFilesManager.tsx
// ラフ確認・納品ファイルのアップロード/一覧/削除。OrderMailPanel の
// ラフ提出・納品メールから使う。実体は非公開バケットに直アップロードされ、
// メール送信時にサーバーがリンク（署名URL / 納品ページ）を本文へ差し込む。
import { useCallback, useEffect, useRef, useState } from "react";
import { FileUp, Loader2, Paperclip, Trash2 } from "lucide-react";
import {
  deleteNatoriDeliveryFileById,
  fetchNatoriDeliveryFiles,
  uploadNatoriDeliveryFile,
  type NatoriDeliveryFileView,
  type NatoriDeliveryFolder,
} from "@/features/natori/data/supabaseDeliveryFiles";

const FOLDER_LABELS: Record<NatoriDeliveryFolder, string> = {
  rough: "ラフ確認ファイル",
  final: "納品ファイル",
};

/** デモ環境で見せるダミーの一覧（アップロードは無効） */
const DEMO_FILES: Record<NatoriDeliveryFolder, NatoriDeliveryFileView[]> = {
  rough: [
    {
      id: "demo-rough-1",
      folder: "rough",
      fileName: "ラフ_全身立ち絵.png",
      sizeBytes: 2_400_000,
      createdAt: "",
    },
  ],
  final: [
    {
      id: "demo-final-1",
      folder: "final",
      fileName: "納品_全身立ち絵.png",
      sizeBytes: 8_800_000,
      createdAt: "",
    },
    {
      id: "demo-final-2",
      folder: "final",
      fileName: "納品_全身立ち絵.psd",
      sizeBytes: 94_000_000,
      createdAt: "",
    },
  ],
};

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)}KB`;
  return `${bytes}B`;
}

export default function DeliveryFilesManager({
  projectId,
  folder,
  demoMode,
}: {
  projectId: string;
  folder: NatoriDeliveryFolder;
  /** デモ環境用: ダミー一覧を表示し、アップロード・削除は無効化する */
  demoMode?: boolean;
}) {
  const [files, setFiles] = useState<NatoriDeliveryFileView[] | null>(
    demoMode ? DEMO_FILES[folder] : null
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const reload = useCallback(async () => {
    const all = await fetchNatoriDeliveryFiles(projectId);
    setFiles(all.filter((file) => file.folder === folder));
  }, [projectId, folder]);

  useEffect(() => {
    if (demoMode) return;
    let cancelled = false;
    (async () => {
      try {
        await reload();
      } catch (err) {
        console.error("[delivery-files] load failed", err);
        if (!cancelled) {
          setFiles([]);
          setError("ファイル一覧の読み込みに失敗しました。");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [reload, demoMode]);

  const handleFiles = async (list: FileList | null) => {
    const selected = Array.from(list ?? []);
    if (selected.length === 0) return;
    if (demoMode) return;
    setBusy(true);
    setError(null);
    try {
      for (const file of selected) {
        await uploadNatoriDeliveryFile(projectId, folder, file);
      }
      await reload();
    } catch (err) {
      console.error("[delivery-files] upload failed", err);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const handleDelete = async (file: NatoriDeliveryFileView) => {
    if (demoMode) return;
    if (!window.confirm(`「${file.fileName}」を削除しますか？`)) return;
    setBusy(true);
    setError(null);
    try {
      await deleteNatoriDeliveryFileById(file.id);
      await reload();
    } catch (err) {
      console.error("[delivery-files] delete failed", err);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-xl border border-pink-100 bg-pink-50/40 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-xs font-bold text-pink-700">
          <Paperclip className="h-3.5 w-3.5" aria-hidden />
          {FOLDER_LABELS[folder]}
          {files ? <span className="font-normal text-pink-600/80">{files.length}件</span> : null}
        </p>
        <button
          type="button"
          onClick={() => {
            if (demoMode) {
              setError("デモ環境のため、ファイルのアップロードはできません。");
              return;
            }
            inputRef.current?.click();
          }}
          disabled={busy}
          className="inline-flex h-8 items-center gap-1.5 rounded-full bg-pink-500 px-3 text-xs font-bold text-white hover:bg-pink-600 disabled:opacity-60"
        >
          {busy ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
          ) : (
            <FileUp className="h-3.5 w-3.5" aria-hidden />
          )}
          {busy ? "アップロード中…" : "ファイルを追加"}
        </button>
        <input
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(event) => void handleFiles(event.target.files)}
        />
      </div>

      {files === null ? (
        <p className="mt-2 text-xs text-gray-500">読み込み中…</p>
      ) : files.length === 0 ? (
        <p className="mt-2 text-xs text-gray-600">
          まだファイルがありません。「ファイルを追加」からアップロードしてください（1つ200MBまで）。
        </p>
      ) : (
        <ul className="mt-2 space-y-1.5">
          {files.map((file) => (
            <li
              key={file.id}
              className="flex items-center gap-2 rounded-lg border border-pink-100 bg-white px-2.5 py-1.5 text-xs"
            >
              <span className="min-w-0 flex-1 break-all font-bold text-gray-900">
                {file.fileName}
              </span>
              <span className="shrink-0 text-gray-500">{formatBytes(file.sizeBytes)}</span>
              <button
                type="button"
                onClick={() => void handleDelete(file)}
                disabled={busy || demoMode}
                className="grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-red-200 bg-white text-red-500 hover:bg-red-50 disabled:opacity-50"
                aria-label={`${file.fileName} を削除`}
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}

      {error ? <p className="mt-2 text-xs font-bold text-red-600">{error}</p> : null}
    </div>
  );
}
