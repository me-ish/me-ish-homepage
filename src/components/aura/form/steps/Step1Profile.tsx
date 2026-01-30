// src/components/aura/form/steps/Step1Profile.tsx
"use client";

import { useRef, useState, useCallback } from "react";
import type { AuraFormData } from "../auraFormTypes";

type Props = {
  data: AuraFormData;
  onChange: (updates: Partial<AuraFormData>) => void;
  requestId: string | null;
  onRequireDraft: () => Promise<void>;
};

export function Step1Profile({ data, onChange, requestId, onRequireDraft }: Props) {
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);

  const handleAvatarUpload = useCallback(async (file: File) => {
    // まずdraftが必要
    if (!requestId) {
      try {
        await onRequireDraft();
      } catch {
        return;
      }
    }

    // draftができた後、再度requestIdを取得する必要があるため
    // uploadはrequestIdが確定してから実行
    setAvatarUploading(true);
    setAvatarError(null);

    try {
      const fd = new FormData();
      fd.append("file", file);

      // requestIdが無い場合はonRequireDraft後に再実行されることを期待
      const currentRequestId = requestId;
      if (!currentRequestId) {
        setAvatarError("下書きの作成を待っています...");
        setAvatarUploading(false);
        return;
      }

      const res = await fetch(`/api/aura/upload/avatar/${currentRequestId}`, {
        method: "POST",
        body: fd,
      });

      const json = await res.json().catch(() => null);

      if (!res.ok || !json?.ok || !json?.url) {
        setAvatarError("アップロードに失敗しました");
        return;
      }

      // アップロード成功：URLを保存
      onChange({ avatarPreviewUrl: json.url });
    } catch (e) {
      console.error(e);
      setAvatarError("通信エラーが発生しました");
    } finally {
      setAvatarUploading(false);
    }
  }, [requestId, onRequireDraft, onChange]);

  const handleAvatarChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      if (!file.type.startsWith("image/")) {
        setAvatarError("画像ファイルを選択してください");
        return;
      }

      // プレビュー用URL生成（ローカル）
      const previewUrl = URL.createObjectURL(file);
      onChange({ avatarPreviewUrl: previewUrl });

      // サーバーにアップロード
      await handleAvatarUpload(file);

      // input をリセット（同じファイルを選び直せるように）
      if (avatarInputRef.current) avatarInputRef.current.value = "";
    },
    [onChange, handleAvatarUpload]
  );

  const handleAvatarDrop = useCallback(
    async (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      const file = e.dataTransfer.files?.[0];
      if (!file) return;

      if (!file.type.startsWith("image/")) {
        setAvatarError("画像ファイルを選択してください");
        return;
      }

      const previewUrl = URL.createObjectURL(file);
      onChange({ avatarPreviewUrl: previewUrl });
      await handleAvatarUpload(file);
    },
    [onChange, handleAvatarUpload]
  );

  return (
    <div className="space-y-6">
      {/* ヘッダー */}
      <div className="text-center">
        <h2 className="text-xl font-semibold text-slate-900 md:text-2xl">
          あなたについて教えてください
        </h2>
        <p className="mt-2 text-sm text-slate-500">
          ポートフォリオに表示される基本情報を入力します
        </p>
      </div>

      {/* フォーム */}
      <div className="mx-auto max-w-xl space-y-5">
        {/* メールアドレス */}
        <label className="block">
          <span className="text-sm font-medium text-slate-700">
            メールアドレス <span className="text-red-500">*</span>
          </span>
          <input
            type="email"
            value={data.email}
            onChange={(e) => onChange({ email: e.target.value })}
            placeholder="your@email.com"
            className={[
              "mt-1.5 w-full rounded-xl border px-4 py-3 text-sm transition-all",
              "bg-slate-50 placeholder:text-slate-400",
              "focus:border-sky-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-100",
              "border-slate-200",
            ].join(" ")}
          />
          <p className="mt-1 text-[11px] text-slate-500">
            決済・プレビューリンクの送信先です。公開されません。
          </p>
        </label>

        {/* 名前 */}
        <label className="block">
          <span className="text-sm font-medium text-slate-700">
            名前 / 屋号 <span className="text-red-500">*</span>
          </span>
          <input
            type="text"
            value={data.name}
            onChange={(e) => onChange({ name: e.target.value })}
            placeholder="山田 太郎"
            className={[
              "mt-1.5 w-full rounded-xl border px-4 py-3 text-sm transition-all",
              "bg-slate-50 placeholder:text-slate-400",
              "focus:border-sky-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-100",
              "border-slate-200",
            ].join(" ")}
          />
        </label>

        {/* 肩書き */}
        <label className="block">
          <span className="text-sm font-medium text-slate-700">
            肩書き <span className="text-red-500">*</span>
          </span>
          <input
            type="text"
            value={data.title}
            onChange={(e) => onChange({ title: e.target.value })}
            placeholder="イラストレーター / デザイナー"
            className={[
              "mt-1.5 w-full rounded-xl border px-4 py-3 text-sm transition-all",
              "bg-slate-50 placeholder:text-slate-400",
              "focus:border-sky-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-100",
              "border-slate-200",
            ].join(" ")}
          />
          <p className="mt-1 text-[11px] text-slate-500">
            職種、専門分野がすぐわかる短い言葉がおすすめです
          </p>
        </label>

        {/* タグライン */}
        <label className="block">
          <span className="text-sm font-medium text-slate-700">キャッチコピー</span>
          <input
            type="text"
            value={data.tagline}
            onChange={(e) => onChange({ tagline: e.target.value })}
            placeholder="ユーザーの心に届くデジタル表現を"
            className={[
              "mt-1.5 w-full rounded-xl border px-4 py-3 text-sm transition-all",
              "bg-slate-50 placeholder:text-slate-400 border-slate-200",
              "focus:border-sky-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-100",
            ].join(" ")}
          />
          <p className="mt-1 text-[11px] text-slate-500">
            「何が得意か」「どんな雰囲気か」が一目で伝わる短い言葉
          </p>
        </label>

        {/* アバター */}
        <div>
          <span className="text-sm font-medium text-slate-700">プロフィール画像</span>
          <div className="mt-2 flex items-start gap-4">
            {/* プレビュー */}
            <div className="relative flex-shrink-0">
              <div className="absolute -inset-1 rounded-full bg-gradient-to-br from-sky-300/40 to-cyan-400/40 blur-md" />
              <div className="relative flex h-20 w-20 items-center justify-center overflow-hidden rounded-full border-4 border-white bg-slate-100 shadow-sm">
                {data.avatarPreviewUrl ? (
                  <img
                    src={data.avatarPreviewUrl}
                    alt="プロフィール"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span className="text-xs text-slate-400">No Image</span>
                )}
              </div>
            </div>

            {/* アップロードエリア */}
            <div
              onDrop={handleAvatarDrop}
              onDragOver={(e) => e.preventDefault()}
              className="flex flex-1 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 p-4 transition-colors hover:border-sky-400 hover:bg-sky-50"
              onClick={() => avatarInputRef.current?.click()}
            >
              <input
                ref={avatarInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleAvatarChange}
              />
              <p className="text-xs font-medium text-slate-600">
                {avatarUploading ? "アップロード中..." : "クリックまたはドラッグ"}
              </p>
              <p className="mt-1 text-[10px] text-slate-400">
                正方形推奨・2MB以内
              </p>
              {avatarError && (
                <p className="mt-1 text-[10px] text-red-500">{avatarError}</p>
              )}
            </div>
          </div>
        </div>

        {/* トーン / 色 */}
        <div className="grid gap-4 md:grid-cols-2">
          <label className="block">
            <span className="text-sm font-medium text-slate-700">文章トーン</span>
            <select
              value={data.tone}
              onChange={(e) =>
                onChange({ tone: e.target.value as AuraFormData["tone"] })
              }
              className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm focus:border-sky-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-100"
            >
              <option value="ですます">丁寧（ですます）</option>
              <option value="フレンドリー">フレンドリー</option>
            </select>
          </label>

          <label className="block">
            <span className="text-sm font-medium text-slate-700">好きな色</span>
            <div className="mt-1.5 flex items-center gap-3">
              <input
                type="color"
                value={data.color}
                onChange={(e) => onChange({ color: e.target.value })}
                className="h-12 w-14 cursor-pointer rounded-lg border border-slate-200"
              />
              <span className="text-xs text-slate-500">
                差し色として使われます
              </span>
            </div>
          </label>
        </div>
      </div>
    </div>
  );
}
