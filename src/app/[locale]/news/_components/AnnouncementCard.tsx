'use client';

import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';

type Ann = {
  id: string;
  title: string;
  body_md: string;
  category: 'info' | 'update' | 'maintenance';
  pinned: boolean;
  link_url: string | null;
  published_at: string | null;
};

const schema = {
  ...defaultSchema,
  attributes: {
    ...defaultSchema.attributes,
    a: [...(defaultSchema.attributes?.a || []), ['target', 'rel']],
    img: [...(defaultSchema.attributes?.img || []), ['src', 'alt', 'title', 'width', 'height']],
  },
};

function categoryChip(cat: Ann['category']) {
  switch (cat) {
    case 'update':
      return 'rounded bg-emerald-100 text-emerald-700 px-2 py-0.5';
    case 'maintenance':
      return 'rounded bg-amber-100 text-amber-800 px-2 py-0.5';
    default:
      return 'rounded bg-sky-100 text-sky-800 px-2 py-0.5';
  }
}

function categoryLabel(cat: Ann['category']) {
  if (cat === 'update') return 'アップデート';
  if (cat === 'maintenance') return 'メンテナンス';
  return 'お知らせ';
}

function formatDateJP(iso: string | null) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit' });
}

export default function AnnouncementCard(n: Ann) {
  const [expanded, setExpanded] = useState(false);

  return (
    <li
      className="rounded-2xl border bg-white/90 p-4 shadow-sm transition hover:shadow-md"
      aria-labelledby={`ann-title-${n.id}`}
    >
      {/* ヘッダー行（カテゴリ/固定/日付） */}
      <div className="flex items-center gap-2 text-xs sm:text-sm">
        <span className={categoryChip(n.category)}>{categoryLabel(n.category)}</span>
        {n.pinned && (
          <span className="rounded bg-rose-100 text-rose-700 px-2 py-0.5">固定</span>
        )}
        <time className="ml-auto text-gray-500">{formatDateJP(n.published_at)}</time>
      </div>

      {/* タイトル */}
      <h3
        id={`ann-title-${n.id}`}
        className="mt-2 text-lg font-semibold tracking-tight text-gray-900"
      >
        {n.title}
      </h3>

      {/* 区切り（題名と本文） */}
      <hr className="my-3 border-dashed border-gray-200" />

      {/* 本文（Markdown） */}
      <div className="relative">
        {/* クランプ（展開前は最大高さを制限し、下部にフェード） */}
        <div
          className={[
            'prose max-w-none prose-a:text-[#00a1e9] prose-img:rounded-lg prose-headings:scroll-mt-20',
            !expanded ? 'max-h-40 overflow-hidden' : '',
          ].join(' ')}
        >
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            rehypePlugins={[[rehypeSanitize, schema]]}
            components={{
              a: ({ node, ...props }) => (
                <a {...props} target="_blank" rel="noopener noreferrer" />
              ),
              img: (props) => (
                <img {...props} style={{ display: 'block', maxWidth: '100%' }} />
              ),
            }}
          >
            {n.body_md || ''}
          </ReactMarkdown>
        </div>

        {!expanded && (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-white to-transparent" />
        )}
      </div>

      {/* フッター（外部リンク / もっと読む） */}
      <div className="mt-3 flex items-center gap-3">
        {n.link_url && (
          <a
            href={n.link_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center rounded-lg border border-[#00a1e9]/20 bg-[#00a1e9]/5 px-3 py-1.5 text-sm font-medium text-[#00a1e9] hover:bg-[#00a1e9]/10"
          >
            詳しく見る
          </a>
        )}
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="ml-auto inline-flex items-center rounded-lg px-2.5 py-1.5 text-sm text-gray-600 hover:bg-gray-50"
          aria-expanded={expanded}
          aria-controls={`ann-body-${n.id}`}
        >
          {expanded ? '閉じる' : 'もっと読む'}
        </button>
      </div>
    </li>
  );
}
