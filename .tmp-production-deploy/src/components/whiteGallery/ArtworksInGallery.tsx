'use client';

import React, { useEffect, useState } from 'react';
import * as THREE from 'three';
import ArtworkFrameWhite from '../whiteGallery/ArtworkFrameWhite';
import ArtworkLabelWhite from '../whiteGallery/ArtworkLabelWhite';
import { useZoomArtwork } from '../shared/ZoomArtworkContext';
import { supabase } from '@/lib/supabaseClient';

type EntryRow = {
  id: number;
  artist_name: string;
  title: string;
  file_name: string | null;
  image_url: string | null;
  description: string | null;
  is_for_sale: boolean;
  price: number | null;
  sns_links: string | null;
  created_at: string | null;
  edition_mode: 'limited' | 'unlimited' | null;
  edition_total: number | null;
  edition_sold: number | null;
};

interface ArtworkEntry {
  title: string;
  author: string;
  imageUrl: string;
  description: string;
  is_for_sale: boolean;
  price: number | null;
  sns_links: string;
  id: number | null;
  created_at: string | null;
  ratio: number;
  scale: number;
  position: [number, number, number];
  rotation: [number, number, number];
  key: string;
  edition_mode?: 'limited' | 'unlimited' | null;
  edition_total?: number | null;
  edition_sold?: number | null;
}

interface ArtworksInGalleryProps {
  avatarRef: React.RefObject<THREE.Object3D>;
}

// image_url優先。無ければ /final/{png名}
function resolveImageUrl(row: EntryRow): string {
  const direct = row.image_url?.trim();
  if (direct) return direct;

  const raw = (row.file_name ?? '').trim();
  if (!raw) return '';

  const pngName = raw.replace(/\.(?:jpe?g|png|webp|gif|avif|tiff)$/i, '.png');
  const { data } = supabase.storage.from('artworks').getPublicUrl(`final/${pngName}`);
  return data.publicUrl;
}

export default function ArtworksInGallery({ avatarRef }: ArtworksInGalleryProps) {
  const { zoomedArtwork } = useZoomArtwork();
  const [artworks, setArtworks] = useState<ArtworkEntry[]>([]);

  useEffect(() => {
    const fetchArtworks = async () => {
      const { data, error } = await supabase
        .from('entries')
        .select(
          'id, artist_name, title, file_name, image_url, description, is_for_sale, price, sns_links, created_at, edition_mode, edition_total, edition_sold'
        )
        .eq('confirmed', true)
        .eq('display_ready', true)
        .eq('gallery_type', 'white')
        .order('created_at', { ascending: true })
        .limit(100);

      if (error) {
        console.error('エントリー取得エラー:', error);
        return;
      }

      const resolved = ((data ?? []) as EntryRow[])
        .map((item) => {
          const finalUrl = resolveImageUrl(item);
          if (!finalUrl) return null;

          return {
            title: item.title,
            author: item.artist_name,
            imageUrl: finalUrl,
            description: item.description ?? '',
            is_for_sale: item.is_for_sale,
            price: item.price,
            sns_links: item.sns_links ?? '{}',
            id: item.id,
            created_at: item.created_at,
            ratio: 1,
            scale: 2,

            // edition系は null を尊重（勝手に 1 を入れない）
            edition_mode: item.edition_mode ?? null,
            edition_total: item.edition_total ?? null,
            edition_sold: item.edition_sold ?? 0,
          } as Omit<ArtworkEntry, 'key' | 'position' | 'rotation'>;
        })
        .filter(Boolean) as Omit<ArtworkEntry, 'key' | 'position' | 'rotation'>[];

      // ダミー（空きスペース用）
      const dummyEntries = Array.from({ length: 7 }, (_, i) => ({
        title: 'Coming Soon',
        author: 'me-ish',
        imageUrl: `/images/comingsoon-${i + 1}.jpg`,
        description: '',
        is_for_sale: false,
        price: null,
        sns_links: '{}',
        id: null,
        created_at: null,
        ratio: 1,
        scale: 2.0,
      }));

      const combined = [...resolved, ...dummyEntries].slice(0, 10);

      // 円形に配置
      const prepared = combined.map((art, i, all) => {
        const angle = (i / all.length) * Math.PI * 2 + Math.PI / 10;
        const radius = 20;
        const x = Math.cos(angle) * radius;
        const z = Math.sin(angle) * radius;
        const y = 3;

        const position = new THREE.Vector3(x, y, z);
        const target = new THREE.Vector3(0, y, 0);
        const dummy = new THREE.Object3D();
        dummy.position.copy(position);
        dummy.lookAt(target);
        dummy.rotateY(Math.PI);

        return {
          key: `art-${i}`,
          position: position.toArray() as [number, number, number],
          rotation: new THREE.Euler().copy(dummy.rotation).toArray() as [number, number, number],
          ...art,
        };
      });

      setArtworks(prepared);
    };

    fetchArtworks();
  }, []);

  return (
    <>
      {!zoomedArtwork &&
        artworks.map((art) => (
          <ArtworkFrameWhite key={art.key} data={art} avatarRef={avatarRef}>
            <ArtworkLabelWhite avatarRef={avatarRef} title={art.title} author={art.author} />
          </ArtworkFrameWhite>
        ))}
    </>
  );
}
