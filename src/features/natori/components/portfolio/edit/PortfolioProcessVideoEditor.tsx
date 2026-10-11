"use client";

// features/natori/components/portfolio/edit/PortfolioProcessVideoEditor.tsx
// 制作過程の動画の入力欄。YouTubeのURLか動画ファイルのどちらかを選び、
// 動画の形・再生前の画像・見出しの下の説明を設定する。
// 動画を空にして保存すると、動画の設定ごと公開ページから外れる。
import { ExternalLink, Loader2, Upload } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { natoriAdminUi } from "@/features/natori/constants/adminUi";
import {
  PROCESS_VIDEO_DEFAULT_CAPTION,
  PROCESS_VIDEO_DEFAULT_SHAPE,
  PROCESS_VIDEO_FILE_CONTENT_TYPE,
  PROCESS_VIDEO_FILE_MAX_LABEL,
  PROCESS_VIDEO_SHAPES,
  PROCESS_VIDEO_SHAPE_LABELS,
} from "@/features/natori/constants/portfolioProcessVideo";
import { ProcessVideoUploadError, uploadProcessVideoFile } from "@/features/natori/data/supabaseProcessVideo";
import { parseProcessVideoSource, youtubeWatchUrl } from "@/features/natori/lib/portfolioProcessVideo";
import type { PortfolioProcessVideo, PortfolioWork } from "@/features/natori/types/portfolio";
import { TextInput } from "./editorFields";

type SourceMode = "youtube" | "file";

const SOURCE_MODES: ReadonlyArray<{ mode: SourceMode; label: string }> = [
  { mode: "youtube", label: "YouTubeのURL" },
  { mode: "file", label: "動画ファイル" },
];

export default function PortfolioProcessVideoEditor({
  value,
  works,
  onChange,
  onUploadingChange,
  uploadDisabled,
}: {
  /** 未設定（動画なし）のときは undefined */
  value: PortfolioProcessVideo | undefined;
  works: PortfolioWork[];
  onChange: (next: PortfolioProcessVideo) => void;
  /** アップロードが始まった・終わったことを親に知らせる（親は、終わるまで「保存する」を止める） */
  onUploadingChange?: (uploading: boolean) => void;
  /** デモ環境用: アップロードを無効化して案内だけ出す */
  uploadDisabled?: boolean;
}) {
  const shapeId = useId();
  const posterId = useId();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const mountedRef = useRef(true);
  /** 切り替えて外したほうの入力を、この画面を開いている間だけ覚えておく（戻したときに入れ直さなくてよいように） */
  const stashRef = useRef<Record<SourceMode, string>>({ youtube: "", file: "" });

  const video: PortfolioProcessVideo = value ?? { url: "" };
  const source = parseProcessVideoSource(video.url);
  const [chosenMode, setChosenMode] = useState<SourceMode>(source?.kind ?? "youtube");
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [previewFailed, setPreviewFailed] = useState(false);

  // アップロード中に他の欄を直されても巻き戻さないよう、終わったときは最新の内容にURLだけを重ねる
  const videoRef = useRef(video);
  const onChangeRef = useRef(onChange);
  const onUploadingChangeRef = useRef(onUploadingChange);
  useEffect(() => {
    videoRef.current = video;
    onChangeRef.current = onChange;
    onUploadingChangeRef.current = onUploadingChange;
  });
  useEffect(() => {
    onUploadingChangeRef.current?.(uploading);
  }, [uploading]);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      // この欄が途中で消えても、親の「保存する」を止めたままにしない
      onUploadingChangeRef.current?.(false);
    };
  }, []);

  // URLが読めるときはその種類に従う。空や読めないURLのときは、選んでいるほうを使う
  const mode: SourceMode = source?.kind ?? chosenMode;
  const fileUrl = source?.kind === "file" ? source.url : null;
  const videoId = source?.kind === "youtube" ? source.videoId : null;
  const hasUrl = video.url.trim().length > 0;

  const candidates = works.filter((work) => Boolean(work.image));
  const poster = video.posterWorkId ? (works.find((work) => work.id === video.posterWorkId) ?? null) : null;
  const posterNote = !video.posterWorkId
    ? "選ぶと、再生ボタンを押す前にこの作品の画像が出ます。選ばないときは無地の背景です。"
    : !poster?.image
      ? "選んでいた作品が見つからないか、画像がありません。無地の背景になります。"
      : !poster.published
        ? "この作品は非公開のため、無地の背景になります。"
        : "再生ボタンを押す前に、この作品の画像が出ます。";

  const switchMode = (next: SourceMode) => {
    if (next === mode) return;
    stashRef.current[mode] = video.url;
    setChosenMode(next);
    setUploadError(null);
    const nextUrl = stashRef.current[next];
    if (nextUrl !== video.url) onChange({ ...video, url: nextUrl });
  };

  const handleFile = async (file: File | null) => {
    if (!file) return;
    setUploadError(null);
    setPreviewFailed(false);
    setProgress(0);
    setUploading(true);
    try {
      const url = await uploadProcessVideoFile(file, {
        onProgress: (ratio) => {
          if (mountedRef.current) setProgress(ratio);
        },
      });
      if (mountedRef.current) {
        setChosenMode("file");
        onChangeRef.current({ ...videoRef.current, url });
      }
    } catch (err) {
      console.error("[portfolio-edit] process video upload failed", err);
      if (mountedRef.current) {
        setUploadError(
          err instanceof ProcessVideoUploadError
            ? err.message
            : "アップロードに失敗しました。通信状況を確認して、もう一度お試しください。"
        );
      }
    } finally {
      if (mountedRef.current) setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const percent = Math.min(100, Math.max(0, Math.round(progress * 100)));

  return (
    <div className="space-y-4">
      <div>
        <p id={`${shapeId}-source`} className={natoriAdminUi.label}>
          動画の入れ方
        </p>
        <div role="group" aria-labelledby={`${shapeId}-source`} className={natoriAdminUi.segment}>
          {SOURCE_MODES.map((option) => (
            <button
              key={option.mode}
              type="button"
              onClick={() => switchMode(option.mode)}
              aria-pressed={mode === option.mode}
              disabled={uploading}
              className={`${natoriAdminUi.segmentItem} disabled:cursor-not-allowed ${
                mode === option.mode ? natoriAdminUi.segmentOn : natoriAdminUi.segmentOff
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
        <p className={natoriAdminUi.hint}>公開ページに出るのは、選んでいるほうの動画だけです。</p>
      </div>

      {mode === "youtube" ? (
        <div>
          <TextInput
            label="YouTubeの動画URL"
            value={video.url}
            onChange={(url) => onChange({ ...video, url })}
            placeholder="https://www.youtube.com/watch?v=…"
            hint="限定公開の動画でも表示できます（非公開は表示できません）。空欄にして保存すると、公開ページから外れます。"
            error={
              hasUrl && !videoId
                ? "YouTubeの動画URLとして読み取れません。https://www.youtube.com/watch?v=… か https://youtu.be/… の形で入力してください。"
                : undefined
            }
          />
          {videoId ? (
            <a
              href={youtubeWatchUrl(videoId)}
              target="_blank"
              rel="noopener noreferrer"
              className={natoriAdminUi.btnLink}
            >
              <ExternalLink className="h-4 w-4" aria-hidden />
              YouTubeで開いて確認する
            </a>
          ) : null}
        </div>
      ) : (
        <div>
          <p className={natoriAdminUi.label}>動画ファイル</p>
          {fileUrl ? (
            <div className="mb-3 space-y-1.5">
              <video
                key={fileUrl}
                src={fileUrl}
                controls
                playsInline
                preload="metadata"
                aria-label="アップロードした動画の確認"
                onError={() => setPreviewFailed(true)}
                onLoadedData={() => setPreviewFailed(false)}
                className="max-h-52 max-w-full rounded-xl bg-zinc-900"
              />
              {previewFailed ? (
                <p className={natoriAdminUi.fieldError}>
                  この動画をブラウザで再生できませんでした。MP4（H.264）で書き出した動画か確認してください。
                </p>
              ) : (
                <p className={natoriAdminUi.hint}>アップロードした動画を設定しています。</p>
              )}
            </div>
          ) : null}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                if (uploadDisabled) {
                  setUploadError("デモ環境のため、動画のアップロードはできません。");
                  return;
                }
                fileInputRef.current?.click();
              }}
              disabled={uploading}
              className={natoriAdminUi.btnSecondary}
            >
              {uploading ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <Upload className="h-4 w-4" aria-hidden />
              )}
              {uploading ? "アップロード中…" : fileUrl ? "別のファイルに差し替える" : "動画ファイルを選ぶ"}
            </button>
            {fileUrl && !uploading ? (
              <button
                type="button"
                onClick={() => {
                  setChosenMode("file");
                  setPreviewFailed(false);
                  onChange({ ...video, url: "" });
                }}
                className={natoriAdminUi.btnDanger}
              >
                動画を外す
              </button>
            ) : null}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept={PROCESS_VIDEO_FILE_CONTENT_TYPE}
            className="hidden"
            onChange={(event) => void handleFile(event.target.files?.[0] ?? null)}
          />
          {uploading ? (
            <div className="mt-3">
              <div
                role="progressbar"
                aria-label="動画のアップロードの進み具合"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={percent}
                className="h-2 w-full max-w-sm overflow-hidden rounded-full bg-zinc-200"
              >
                <div
                  className="h-full rounded-full bg-[#BE185D] transition-[width] duration-150 motion-reduce:transition-none"
                  style={{ width: `${percent}%` }}
                />
              </div>
              <p role="status" className={natoriAdminUi.hint}>
                アップロード中です（{percent}%）。終わるまで、この画面を閉じないでください。
              </p>
            </div>
          ) : null}
          <p className={natoriAdminUi.hint}>
            MP4（H.264）形式、{PROCESS_VIDEO_FILE_MAX_LABEL}までです。大きいときは、書き出しの画質やサイズを下げてください。
          </p>
          {uploadError ? (
            <p role="alert" className={natoriAdminUi.fieldError}>
              {uploadError}
            </p>
          ) : null}
        </div>
      )}

      <div>
        <label htmlFor={shapeId} className={natoriAdminUi.label}>
          動画の形
        </label>
        <select
          id={shapeId}
          value={video.shape ?? PROCESS_VIDEO_DEFAULT_SHAPE}
          onChange={(event) => {
            const shape = PROCESS_VIDEO_SHAPES.find((candidate) => candidate === event.target.value);
            if (shape) onChange({ ...video, shape });
          }}
          className={natoriAdminUi.input}
        >
          {PROCESS_VIDEO_SHAPES.map((shape) => (
            <option key={shape} value={shape}>
              {PROCESS_VIDEO_SHAPE_LABELS[shape]}
            </option>
          ))}
        </select>
        <p className={natoriAdminUi.hint}>スマホで縦に撮った動画は「縦長」を選んでください。</p>
      </div>

      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <label htmlFor={posterId} className={natoriAdminUi.label}>
            再生前に見せる画像（ご依頼実績から1枚）
          </label>
          <select
            id={posterId}
            value={video.posterWorkId ?? ""}
            onChange={(event) => onChange({ ...video, posterWorkId: event.target.value || null })}
            aria-describedby={`${posterId}-note`}
            className={natoriAdminUi.input}
          >
            <option value="">なし（無地の背景）</option>
            {video.posterWorkId && !candidates.some((work) => work.id === video.posterWorkId) ? (
              <option value={video.posterWorkId}>（見つからない作品）</option>
            ) : null}
            {candidates.map((work) => (
              <option key={work.id} value={work.id}>
                {`${work.title.trim() || "無題"}${work.published ? "" : "（非公開）"}`}
              </option>
            ))}
          </select>
          <p id={`${posterId}-note`} className={natoriAdminUi.hint}>
            {posterNote}
          </p>
        </div>
        {poster?.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={poster.image}
            alt=""
            className="h-20 w-16 shrink-0 rounded-lg border border-zinc-200 bg-zinc-50 object-contain"
          />
        ) : null}
      </div>

      <TextInput
        label="見出しの下の説明（任意）"
        value={video.caption ?? ""}
        onChange={(caption) => onChange({ ...video, caption })}
        placeholder="例: 下描きから仕上げまでの様子です。"
        hint={`空欄なら「${PROCESS_VIDEO_DEFAULT_CAPTION}」と表示します。`}
      />
    </div>
  );
}
