// src/components/aura/form/steps/Step1Profile.tsx
"use client";

import { useRef, useState, useCallback } from "react";
import Image from "next/image";
import { Sparkles, Loader2 } from "lucide-react";
import type { AuraFormData } from "../auraFormTypes";

const SPECIALTY_TAGS = [
  "キャラクターデザイン", "背景・風景", "SNSアイコン",
  "LINEスタンプ", "漫画・コミック", "グッズデザイン",
  "ゲームCG", "VTuber衣装", "ちびキャラ・デフォルメ", "表紙・サムネイル",
];

const VIBE_TAGS = [
  "やわらかい・ほんわか", "クール・スタイリッシュ", "ポップ・カラフル",
  "和風・繊細", "ダーク・神秘的", "ナチュラル・温かみ",
  "レトロ・ノスタルジック", "ファンタジー・幻想的", "水彩・透明感", "モノクロ・シンプル",
];

function toggleTag(
  tag: string,
  selected: string[],
  setSelected: (v: string[]) => void,
  max = 3,
) {
  if (selected.includes(tag)) {
    setSelected(selected.filter((t) => t !== tag));
  } else if (selected.length < max) {
    setSelected([...selected, tag]);
  }
}

type Props = {
  data: AuraFormData;
  onChange: (updates: Partial<AuraFormData>) => void;
  requestId: string | null;
  onRequireDraft: () => Promise<string | null>;
};

export function Step1Profile({ data, onChange, requestId, onRequireDraft }: Props) {
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [taglineSuggesting, setTaglineSuggesting] = useState(false);
  const [taglineSuggestError, setTaglineSuggestError] = useState<string | null>(null);
  const [selectedSpecialties, setSelectedSpecialties] = useState<string[]>([]);
  const [selectedVibes, setSelectedVibes] = useState<string[]>([]);

  const handleSuggestTagline = useCallback(async () => {
    setTaglineSuggesting(true);
    setTaglineSuggestError(null);
    try {
      const res = await fetch("/api/aura/form/ai-suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-requested-with": "me-ish" },
        body: JSON.stringify({
          field: "tagline",
          name: data.name,
          title: data.title,
          bio: data.bio,
          worldviewBase: data.worldviewBase,
          tone: data.tone,
          specialties: selectedSpecialties,
          vibes: selectedVibes,
        }),
      });
      const json = await res.json().catch(() => null);
      if (!json?.ok || !json?.text) {
        setTaglineSuggestError("生成に失敗しました");
        return;
      }
      onChange({
        tagline: json.text,
        aiLockedFields: { ...data.aiLockedFields, tagline: true },
      });
    } catch {
      setTaglineSuggestError("通信エラーが発生しました");
    } finally {
      setTaglineSuggesting(false);
    }
  }, [data.name, data.title, data.bio, data.worldviewBase, data.tone, data.aiLockedFields, onChange, selectedSpecialties, selectedVibes]);

  const handleAvatarUpload = useCallback(async (file: File) => {
    // requestIdを確定（なければdraft作成して即取得）
    let rid = requestId;
    if (!rid) {
      rid = await onRequireDraft();
      if (!rid) return;
    }

    setAvatarUploading(true);
    setAvatarError(null);

    try {
      const fd = new FormData();
      fd.append("file", file);

      const res = await fetch(`/api/aura/upload/avatar/${rid}`, {
        method: "POST",
        headers: { "x-requested-with": "me-ish" },
        body: fd,
      });

      const json = await res.json().catch(() => null);

      if (!res.ok || !json?.ok || !json?.url) {
        setAvatarError("アップロードに失敗しました");
        return;
      }

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
        <div className="space-y-3">
          <span className="text-sm font-medium text-slate-700">キャッチコピー</span>

          {/* 得意なこと */}
          <div>
            <p className="mb-1.5 text-xs font-medium text-slate-600">
              得意なこと
              <span className="ml-1 text-slate-400">（最大3つ）</span>
            </p>
            <div className="grid grid-cols-2 gap-1.5">
              {SPECIALTY_TAGS.map((tag) => {
                const isSelected = selectedSpecialties.includes(tag);
                const isDisabled = !isSelected && selectedSpecialties.length >= 3;
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => toggleTag(tag, selectedSpecialties, setSelectedSpecialties)}
                    disabled={isDisabled}
                    className={[
                      "rounded-lg border px-2.5 py-1.5 text-left text-xs transition-all",
                      isSelected
                        ? "border-violet-400 bg-violet-50 text-violet-700 font-medium"
                        : "border-slate-200 bg-white text-slate-600 hover:border-slate-300",
                      isDisabled ? "opacity-40 cursor-not-allowed" : "cursor-pointer",
                    ].join(" ")}
                  >
                    {tag}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 雰囲気・スタイル */}
          <div>
            <p className="mb-1.5 text-xs font-medium text-slate-600">
              雰囲気・スタイル
              <span className="ml-1 text-slate-400">（最大3つ）</span>
            </p>
            <div className="grid grid-cols-2 gap-1.5">
              {VIBE_TAGS.map((tag) => {
                const isSelected = selectedVibes.includes(tag);
                const isDisabled = !isSelected && selectedVibes.length >= 3;
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => toggleTag(tag, selectedVibes, setSelectedVibes)}
                    disabled={isDisabled}
                    className={[
                      "rounded-lg border px-2.5 py-1.5 text-left text-xs transition-all",
                      isSelected
                        ? "border-violet-400 bg-violet-50 text-violet-700 font-medium"
                        : "border-slate-200 bg-white text-slate-600 hover:border-slate-300",
                      isDisabled ? "opacity-40 cursor-not-allowed" : "cursor-pointer",
                    ].join(" ")}
                  >
                    {tag}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 生成ボタン */}
          <div className="flex items-center justify-between">
            {data.aiLockedFields.tagline && (
              <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-medium text-violet-600">
                AI生成済み
              </span>
            )}
            <div className="ml-auto">
              <button
                type="button"
                onClick={handleSuggestTagline}
                disabled={
                  taglineSuggesting ||
                  (selectedSpecialties.length === 0 && selectedVibes.length === 0 && !data.name.trim())
                }
                className={[
                  "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all",
                  "border border-violet-300 bg-violet-50 text-violet-700",
                  "hover:bg-violet-100 disabled:cursor-not-allowed disabled:opacity-50",
                ].join(" ")}
                title={
                  selectedSpecialties.length === 0 && selectedVibes.length === 0 && !data.name.trim()
                    ? "タグを選ぶか名前を入力してください"
                    : "AIでキャッチコピーを生成"
                }
              >
                {taglineSuggesting ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Sparkles className="h-3.5 w-3.5" />
                )}
                AIでキャッチコピーを生成
              </button>
            </div>
          </div>

          {/* テキスト入力 */}
          <input
            type="text"
            value={data.tagline}
            onChange={(e) =>
              onChange({
                tagline: e.target.value,
                ...(data.aiLockedFields.tagline
                  ? { aiLockedFields: { ...data.aiLockedFields, tagline: false } }
                  : {}),
              })
            }
            placeholder="ユーザーの心に届くデジタル表現を"
            className={[
              "w-full rounded-xl border px-4 py-3 text-sm transition-all",
              "bg-slate-50 placeholder:text-slate-400",
              data.aiLockedFields.tagline
                ? "border-violet-300 focus:border-violet-400 focus:ring-violet-100"
                : "border-slate-200 focus:border-sky-400 focus:ring-sky-100",
              "focus:bg-white focus:outline-none focus:ring-2",
            ].join(" ")}
          />
          {taglineSuggestError && (
            <p className="mt-1 text-[11px] text-red-500">{taglineSuggestError}</p>
          )}
          <p className="text-[11px] text-slate-500">
            タグを選んでAI生成するか、直接入力もできます
          </p>
        </div>

        {/* アバター */}
        <div>
          <span className="text-sm font-medium text-slate-700">プロフィール画像</span>
          <div className="mt-2 flex items-start gap-4">
            {/* プレビュー */}
            <div className="relative flex-shrink-0">
              <div className="absolute -inset-1 rounded-full bg-gradient-to-br from-sky-300/40 to-cyan-400/40 blur-md" />
              <div className="relative flex h-20 w-20 items-center justify-center overflow-hidden rounded-full border-4 border-white bg-slate-100 shadow-sm">
                {data.avatarPreviewUrl ? (
                  <Image
                    src={data.avatarPreviewUrl}
                    alt="プロフィール"
                    fill
                    className="object-cover"
                    unoptimized
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

      </div>
    </div>
  );
}
