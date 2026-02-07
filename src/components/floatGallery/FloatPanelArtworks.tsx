'use client';

import React, { useEffect, useMemo, useState } from 'react';
import * as THREE from 'three';
import { useTexture } from '@react-three/drei';
import { supabase } from '@/lib/supabaseClient';
import LazyArtworkFrame from '../shared/LazyArtworkFrame';
import {
  pickDailyExhibits,
  getTodayDateString,
  isValidDateString,
  FLOAT_DAILY_SLOT_COUNT,
} from '@/lib/gallery';

type Props = {
  avatarRef: React.RefObject<THREE.Group>;
  artworkRefs: React.MutableRefObject<(THREE.Group | null)[]>;
  /** /float?date=YYYY-MM-DD 用（未指定なら今日） */
  dateStr?: string;
};

/* ArtworkFrame(scale=1.8, aspect=1.2) と同じ見た目サイズ */
const SCALE = 4;
const ASPECT = 1.2;
const LIGHT_HEIGHT = 2.2;

const SELECT_COLUMNS = `
  id, title, artist_name, image_url, description,
  is_for_sale, price, sns_links, created_at,
  is_sold, edition_mode, edition_total, edition_sold,
  confirmed, display_ready, display_end_at
`.replace(/\s+/g, '');

const QUERY_LIMIT = 200;

type Entry = {
  id: number;
  title: string;
  artist_name: string;
  image_url: string;
  description: string | null;
  is_for_sale: boolean;
  price: number | null;
  sns_links: string | null;
  created_at: string | null;
  is_sold: boolean;
  edition_mode: 'limited' | 'unlimited' | null;
  edition_total: number | null;
  edition_sold: number | null;
  display_end_at: string | null;
};

function ComingSoonPanel({
  position,
  rotation,
  width = SCALE * ASPECT,
  height = SCALE,
}: {
  position: [number, number, number];
  rotation: [number, number, number];
  width?: number;
  height?: number;
}) {
  const map = useTexture('/coming-soon.png'); // public/coming-soon.png
  useMemo(() => {
    map.anisotropy = 8;
    map.minFilter = THREE.LinearMipmapLinearFilter;
    map.magFilter = THREE.LinearFilter;
    map.colorSpace = THREE.SRGBColorSpace;
  }, [map]);

  return (
    <group position={position} rotation={rotation}>
      {/* 内側（ギャラリー中心）を正面にするためにY軸で反転 */}
      <group rotation={[0, Math.PI, 0]}>
        {/* 下地（額っぽい縁取り） */}
        <mesh>
          <planeGeometry args={[width + 0.08, height + 0.08]} />
          <meshStandardMaterial
            color="#eef2f7"
            emissive="#111111"
            emissiveIntensity={0.06}
            roughness={0.9}
            metalness={0.0}
          />
        </mesh>

        {/* 画像面 */}
        <mesh position={[0, 0, 0.002]}>
          <planeGeometry args={[width, height]} />
          <meshBasicMaterial map={map} toneMapped={false} />
        </mesh>

        {/* ほんのりオーラ */}
        <mesh position={[0, 0, -0.001]}>
          <planeGeometry args={[width + 0.22, height + 0.22]} />
          <meshBasicMaterial
            color="#00ffff"
            transparent
            opacity={0.08}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </mesh>
      </group>
    </group>
  );
}

export default function FloatPanelArtworks({
  avatarRef,
  artworkRefs,
  dateStr,
}: Props): JSX.Element {
  const panelRadius = 16;
  const panelY = 3.5;
  const artworkGap = 4.5;
  const distanceFromPanel = 0.4;

  const [allEntries, setAllEntries] = useState<Entry[]>([]);

  const resolvedDate = useMemo(() => {
    const raw = String(dateStr ?? '');
    return isValidDateString(raw) ? raw : getTodayDateString();
  }, [dateStr]);

  useEffect(() => {
    const fetchApproved = async () => {
      const { data, error } = await supabase
        .from('entries')
        .select(SELECT_COLUMNS)
        .eq('confirmed', true)
        .eq('display_ready', true)
        .eq('gallery_type', 'float')
        .order('created_at', { ascending: false })
        .limit(QUERY_LIMIT);

      if (!error && data) setAllEntries(data as unknown as Entry[]);
    };
    fetchApproved();
  }, []);

  const entries = useMemo(() => {
    const now = Date.now();
    const displayable = allEntries.filter((e) => {
      if (!e.display_end_at) return true;
      return new Date(e.display_end_at).getTime() > now;
    });
    const stable = [...displayable].sort((a, b) => a.id - b.id);
    return pickDailyExhibits(stable, resolvedDate, FLOAT_DAILY_SLOT_COUNT) as Entry[];
  }, [allEntries, resolvedDate]);

  const sides = [
    { deg: 45, rotationY: Math.PI / 4 + Math.PI, frontScale: -2 },
    { deg: 135, rotationY: (3 * Math.PI) / 4, frontScale: -2 },
    { deg: 225, rotationY: (5 * Math.PI) / 4 + Math.PI, frontScale: -2 },
    { deg: 315, rotationY: -Math.PI / 4, frontScale: -2 },
  ];

  const artworks = sides.flatMap(({ deg, rotationY, frontScale }) => {
    const rad = (deg * Math.PI) / 180;
    const center = new THREE.Vector3(
      Math.cos(rad) * panelRadius,
      panelY,
      Math.sin(rad) * panelRadius
    );

    const xAxis = new THREE.Vector3(1, 0, 0).applyAxisAngle(
      new THREE.Vector3(0, 1, 0),
      rotationY
    );
    const front = new THREE.Vector3(0, 0, 1)
      .applyAxisAngle(new THREE.Vector3(0, 1, 0), rotationY)
      .multiplyScalar(distanceFromPanel * frontScale);

    return [-1, 1].map((i) => {
      const pos = center.clone().addScaledVector(xAxis, i * artworkGap).add(front);
      return {
        position: pos.toArray() as [number, number, number],
        rotation: [0, rotationY, 0] as [number, number, number],
      };
    });
  });

  // artworkRefs のオフセット：外壁が 0-23 を使用するため、パネルは 24 から開始
  const PANEL_REFS_OFFSET = 24;
  const panelEntries = entries.slice(PANEL_REFS_OFFSET, PANEL_REFS_OFFSET + artworks.length);

  return (
    <>
      {artworks.map((art, i) => {
        const id = `slot-panel-${i}`;
        const entry = panelEntries[i];
        return (
          <group
            key={id}
            ref={(el) => {
              artworkRefs.current[PANEL_REFS_OFFSET + i] = el;
            }}
          >
            {entry ? (
              <LazyArtworkFrame
                id={entry.id.toString()}
                position={art.position}
                rotation={art.rotation}
                aspectRatio={ASPECT}
                scale={1.8}
                title={entry.title}
                author={entry.artist_name}
                imageUrl={entry.image_url}
                avatarRef={avatarRef}
                description={entry.description ?? ''}
                is_for_sale={entry.is_for_sale}
                price={entry.price}
                sns_links={entry.sns_links ?? '{}'}
                created_at={entry.created_at}
                is_sold={entry.is_sold}
                edition_mode={entry.edition_mode}
                edition_total={entry.edition_total}
                edition_sold={entry.edition_sold ?? 0}
              />
            ) : (
              <ComingSoonPanel position={art.position} rotation={art.rotation} />
            )}
            {/* pointLight 削除: 共有 SpotLight に統合（FloatGallery.tsx） */}
          </group>
        );
      })}
    </>
  );
}
