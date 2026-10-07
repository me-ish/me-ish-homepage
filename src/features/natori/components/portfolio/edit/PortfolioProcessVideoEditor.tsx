"use client";

// features/natori/components/portfolio/edit/PortfolioProcessVideoEditor.tsx
// 制作過程の動画（YouTube）の入力欄。URL・動画の形・再生前の画像・見出しの下の説明を設定する。
// URLを空にして保存すると、動画の設定ごと公開ページから外れる。
import { ExternalLink } from "lucide-react";
import { useId } from "react";
import { natoriAdminUi } from "@/features/natori/constants/adminUi";
import {
  PROCESS_VIDEO_DEFAULT_CAPTION,
  PROCESS_VIDEO_DEFAULT_SHAPE,
  PROCESS_VIDEO_SHAPES,
  PROCESS_VIDEO_SHAPE_LABELS,
} from "@/features/natori/constants/portfolioProcessVideo";
import { parseYoutubeVideoId, youtubeWatchUrl } from "@/features/natori/lib/portfolioProcessVideo";
import type { PortfolioProcessVideo, PortfolioWork } from "@/features/natori/types/portfolio";
import { TextInput } from "./editorFields";

export default function PortfolioProcessVideoEditor({
  value,
  works,
  onChange,
}: {
  /** 未設定（動画なし）のときは undefined */
  value: PortfolioProcessVideo | undefined;
  works: PortfolioWork[];
  onChange: (next: PortfolioProcessVideo) => void;
}) {
  const shapeId = useId();
  const posterId = useId();
  const video: PortfolioProcessVideo = value ?? { url: "" };
  const hasUrl = video.url.trim().length > 0;
  const videoId = parseYoutubeVideoId(video.url);

  const candidates = works.filter((work) => Boolean(work.image));
  const poster = video.posterWorkId ? (works.find((work) => work.id === video.posterWorkId) ?? null) : null;
  const posterNote = !video.posterWorkId
    ? "選ぶと、再生ボタンを押す前にこの作品の画像が出ます。選ばないときは無地の背景です。"
    : !poster?.image
      ? "選んでいた作品が見つからないか、画像がありません。無地の背景になります。"
      : !poster.published
        ? "この作品は非公開のため、無地の背景になります。"
        : "再生ボタンを押す前に、この作品の画像が出ます。";

  return (
    <div className="space-y-4">
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
