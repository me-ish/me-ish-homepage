import { supabaseServer } from '@/lib/supabaseServer';

type Ann = {
  id: string;
  title: string;
  body_md: string;
  category: 'info' | 'update' | 'maintenance';
  pinned: boolean;
  link_url: string | null;
  published_at: string | null;
};

export default async function NewsList({ q = '' }: { q?: string }) {
  const supabase = supabaseServer();

  // 基本クエリ（公開のみ）
  let query = supabase
    .from('announcements')
    .select('id,title,body_md,category,pinned,link_url,published_at')
    .not('published_at', 'is', null)
    .order('pinned', { ascending: false })
    .order('published_at', { ascending: false })
    .limit(50);

  // キーワード検索（タイトル/本文/リンクURLのどれかにマッチ）
  if (q.trim()) {
    const kw = q.trim();
    query = query.or(
      `title.ilike.%${kw}%,body_md.ilike.%${kw}%,link_url.ilike.%${kw}%`
    );
  }

  const { data, error } = await query;
  if (error) {
    console.error('[news] fetch error:', error);
    return <p className="text-gray-500">読み込みに失敗しました。</p>;
  }
  const items = (data ?? []) as Ann[];

  if (items.length === 0) {
    return <p className="text-gray-500">現在表示できるお知らせはありません。</p>;
  }

  return (
    <ul className="space-y-4">
      {items.map((n) => (
        <li key={n.id} className="rounded-2xl border bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 text-sm">
            <span className={
              n.category === 'update'
                ? 'rounded bg-emerald-100 text-emerald-700 px-2 py-0.5'
                : n.category === 'maintenance'
                ? 'rounded bg-amber-100 text-amber-800 px-2 py-0.5'
                : 'rounded bg-sky-100 text-sky-800 px-2 py-0.5'
            }>
              {n.category}
            </span>
            {n.pinned && (
              <span className="rounded bg-rose-100 text-rose-700 px-2 py-0.5">固定</span>
            )}
            <time className="ml-auto text-xs text-gray-500">
              {n.published_at ? new Date(n.published_at).toLocaleDateString('ja-JP') : ''}
            </time>
          </div>

          <h3 className="mt-1 text-base font-semibold">{n.title}</h3>
          <p className="mt-1 text-sm text-[#556] leading-relaxed whitespace-pre-wrap">
            {n.body_md}
          </p>

          {n.link_url && (
            <a
              href={n.link_url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-block text-sm text-[#00a1e9] underline underline-offset-4 hover:opacity-80"
            >
              詳しく見る
            </a>
          )}
        </li>
      ))}
    </ul>
  );
}
