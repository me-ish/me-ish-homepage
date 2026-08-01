"use client";

// 受付時の参考画像。非公開バケットの短時間署名URLを server 側で発行して渡す。
// Storage path は表示せず、署名URLも log には出さない。
// 署名や読み込みに失敗しても案件詳細全体は壊さない。
import { useState } from "react";
import { ImageOff } from "lucide-react";
import type { NatoriProjectReferenceFileView } from "@/features/natori/types/projects";

export default function InquiryReferenceFiles({
  files,
  expectedCount,
}: {
  files: NatoriProjectReferenceFileView[];
  /** DB 上の資料件数。署名に失敗した分との差分を案内するために使う。 */
  expectedCount?: number;
}) {
  const [broken, setBroken] = useState<Record<string, boolean>>({});
  const total = expectedCount ?? files.length;
  const unavailable = Math.max(0, total - files.length);

  if (total === 0) return null;

  return (
    <section aria-labelledby="inquiry-files-heading">
      <h3
        id="inquiry-files-heading"
        className="mb-2 text-xs font-bold uppercase tracking-wide text-pink-700"
      >
        参考画像（{total}件）
      </h3>

      {files.length > 0 ? (
        <ul className="flex flex-wrap gap-2">
          {files.map((file, index) => (
            <li key={`${file.name}-${index}`} className="w-24">
              <a
                href={file.url}
                target="_blank"
                rel="noopener noreferrer"
                title="クリックで原寸表示"
                className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-pink-400"
              >
                {broken[file.url] ? (
                  <span className="grid h-24 w-24 place-items-center rounded-lg border border-pink-200 bg-gray-50 text-gray-400">
                    <ImageOff className="h-5 w-5" aria-hidden />
                    <span className="sr-only">画像を読み込めませんでした</span>
                  </span>
                ) : (
                  // 非公開バケットの短時間署名URL。next/image は使わない。
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={file.url}
                    alt={file.name}
                    onError={() =>
                      setBroken((current) => ({ ...current, [file.url]: true }))
                    }
                    className="h-24 w-24 rounded-lg border border-pink-200 object-cover transition hover:opacity-80"
                  />
                )}
              </a>
              <p className="mt-1 truncate text-[11px] text-gray-600" title={file.name}>
                {file.name}
              </p>
            </li>
          ))}
        </ul>
      ) : null}

      {unavailable > 0 ? (
        <p className="mt-2 rounded-xl border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900">
          {unavailable}件の画像を今は表示できませんでした。時間をおいて画面を再読み込みしてください。
        </p>
      ) : null}
    </section>
  );
}
