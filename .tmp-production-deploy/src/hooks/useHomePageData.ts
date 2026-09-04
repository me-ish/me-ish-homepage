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
 * Uses a single RPC call instead of N+1 queries.
 */
export function useGalleryStats() {
  const [stats, setStats] = useState<GalleryStats | null>(null);

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        // RPC defined in 20260209_gallery_stats_rpc.sql — not yet in generated types
        const { data, error } = await (supabase.rpc as Function)('get_gallery_stats') as {
          data: { works_count: number; artists_count: number; unique_views: number }[] | null;
          error: { message: string } | null;
        };

        if (error) throw error;

        if (mounted && data && data.length > 0) {
          const row = data[0];
          setStats({
            worksCount: Number(row.works_count) || 0,
            artistsCount: Number(row.artists_count) || 0,
            uniqueViews: Number(row.unique_views) || 0,
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
