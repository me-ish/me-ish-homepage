'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { resolveImageUrl, type EntryRow } from '@/lib/gallery/galleryUtils';

/**
 * Fetch gallery artworks for hero display (agree_promotion=true only).
 */
export function useGalleryArtworks(limit = 8) {
  const [artworks, setArtworks] = useState<{ src: string; id: number }[]>([]);

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const { data, error } = await supabase
          .from('entries')
          .select('id, image_url, file_name')
          .eq('confirmed', true)
          .eq('display_ready', true)
          .eq('agree_promotion', true)
          .order('confirmed_at', { ascending: false })
          .limit(limit);

        if (error) throw error;

        if (mounted && data && data.length > 0) {
          const resolved = data
            .map((entry) => ({
              id: entry.id,
              src: resolveImageUrl(entry as Pick<EntryRow, 'image_url' | 'file_name'>),
            }))
            .filter((item) => item.src);
          setArtworks(resolved);
        }
      } catch (err) {
        console.error('Failed to fetch gallery artworks:', err);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [limit]);

  return artworks;
}

export type GalleryStats = {
  worksCount: number;
  artistsCount: number;
  uniqueViews: number;
};

/**
 * Fetch gallery stats: works count, artist count, unique views.
 */
export function useGalleryStats() {
  const [stats, setStats] = useState<GalleryStats | null>(null);

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const { data, error } = await supabase
          .from('entries')
          .select('id, user_id')
          .eq('confirmed', true)
          .eq('display_ready', true);

        if (error) throw error;

        if (mounted && data) {
          const worksCount = data.length;
          const uniqueArtists = new Set(data.map((entry) => entry.user_id));

          let uniqueViews = 0;
          if (data.length > 0) {
            const entryIds = data.map((entry) => entry.id);
            const { data: viewData, error: viewError } = await supabase
              .from('entry_view_stats')
              .select('unique_views')
              .in('entry_id', entryIds);

            if (!viewError && viewData) {
              uniqueViews = viewData.reduce((sum, v) => sum + (v.unique_views ?? 0), 0);
            }
          }

          setStats({
            worksCount,
            artistsCount: uniqueArtists.size,
            uniqueViews,
          });
        }
      } catch (err) {
        console.error('Failed to fetch gallery stats:', err);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  return stats;
}
