'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import type { Announcement } from '@/types/announcement';

export function useAnnouncements(limit = 3) {
  const [items, setItems] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from('announcements_public') // 👈 view でも table でもOK
        .select('*')
        .order('pinned', { ascending: false })
        .order('published_at', { ascending: false })
        .limit(limit);

      if (!error && data) {
        setItems(data as Announcement[]);
      }
      setLoading(false);
    })();
  }, [limit]);

  return { items, loading };
}
