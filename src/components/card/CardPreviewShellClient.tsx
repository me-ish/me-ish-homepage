// src/components/card/CardPreviewShellClient.tsx
"use client";

import { useState } from "react";
import { Eye, Send, Loader2, ExternalLink } from "lucide-react";
import type { CardDesign, CardContent } from "@/lib/card/card.schema";
import CardRenderer from "@/components/card/renderer/CardRenderer";
import CardPdfExport from "@/components/card/pdf/CardPdfExport";
import { CSRF_HEADERS } from "@/lib/auth/csrf";

type Props = {
  requestId: string;
  design: CardDesign;
  content: CardContent;
  publicSlug?: string | null;
};

export default function CardPreviewShellClient({
  requestId,
  design,
  content,
  publicSlug,
}: Props) {
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [published, setPublished] = useState(Boolean(publicSlug));
  const [slug, setSlug] = useState(publicSlug ?? null);

  const handlePublish = async () => {
    setPublishing(true);
    setError(null);

    try {
      const res = await fetch(`/api/card/save/${requestId}`, {
        method: "POST",
        headers: { ...CSRF_HEADERS, "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });

      const json = await res.json();

      if (json.ok) {
        setPublished(true);
        setSlug(json.publicSlug ?? null);
      } else {
        setError(json.error ?? "公開に失敗しました");
      }
    } catch {
      setError("ネットワークエラーが発生しました");
    } finally {
      setPublishing(false);
    }
  };

  const publicUrl = slug ? `/card/p/${slug}` : null;

  return (
    <div className="space-y-8">
      {/* Header */}
      <header className="space-y-2">
        <h1 className="text-2xl font-bold text-slate-800">
          カード プレビュー
        </h1>
        <p className="text-sm text-slate-500">
          内容を確認して「公開する」を押してください。
        </p>
      </header>

      {/* Error */}
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
          {error}
        </div>
      )}

      {/* Published banner */}
      {published && publicUrl && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
          <div className="flex items-center gap-2 mb-2">
            <Eye className="w-4 h-4 text-emerald-600" />
            <span className="text-sm font-semibold text-emerald-700">
              公開中
            </span>
          </div>
          <a
            href={publicUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-emerald-600 hover:underline flex items-center gap-1"
          >
            {publicUrl}
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      )}

      {/* Preview */}
      <section className="rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
        <CardRenderer design={design} content={content} publicUrl={publicUrl ?? undefined} />
      </section>

      {/* Actions */}
      <div className="flex flex-wrap items-center justify-center gap-4">
        {!published ? (
          <button
            type="button"
            onClick={handlePublish}
            disabled={publishing}
            className="flex items-center gap-2 px-8 py-3 bg-sky-500 text-white rounded-xl font-semibold hover:bg-sky-600 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {publishing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                処理中...
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                公開する
              </>
            )}
          </button>
        ) : (
          <>
            <a
              href={publicUrl!}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-8 py-3 bg-emerald-500 text-white rounded-xl font-semibold hover:bg-emerald-600 transition-colors shadow-sm"
            >
              <ExternalLink className="w-4 h-4" />
              公開ページを見る
            </a>
            <CardPdfExport
              design={design}
              content={content}
              publicUrl={`${window.location.origin}${publicUrl}`}
            />
          </>
        )}
      </div>
    </div>
  );
}
