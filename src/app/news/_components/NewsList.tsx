import { supabaseServer } from '@/lib/supabaseServer';
import dynamic from 'next/dynamic';

const AnnouncementCard = dynamic(() => import('./AnnouncementCard'), { ssr: false });

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

  let query = supabase
    .from('announcements')
    .select('id,title,body_md,category,pinned,link_url,published_at')
    .not('published_at', 'is', null)
    .order('pinned', { ascending: false })
    .order('published_at', { ascending: false })
    .limit(50);

  if (q.trim()) {
    const kw = q.trim();
    query = query.or(`title.ilike.%${kw}%,body_md.ilike.%${kw}%,link_url.ilike.%${kw}%`);
  }

  const { data, error } = await query;
  if (error) {
    console.error('[news] fetch error:', error);
    return <p className="text-gray-500">読み込みに失敗しました。</p>;
  }

  const items = (data ?? []) as Ann[];

  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed bg-white/70 p-6 text-center text-gray-500">
        現在表示できるお知らせはありません。
      </div>
    );
  }

  return (
    <ul className="space-y-4">
      {items.map((n) => (
        <AnnouncementCard key={n.id} {...n} />
      ))}
    </ul>
  );
}
