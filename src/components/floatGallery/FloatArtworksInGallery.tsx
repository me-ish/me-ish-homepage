'use client';

import React, { useEffect, useState, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { useTexture } from '@react-three/drei';
import LazyArtworkFrame from '../shared/LazyArtworkFrame';
import ArtworkLabel from './ArtworkLabelFloat';
import { supabase } from '@/lib/supabaseClient';

import {
  pickDailyExhibits,
  getTodayDateString,
  isValidDateString,
  FLOAT_DAILY_SLOT_COUNT,
} from '@/lib/gallery';

// 定数
const ARTWORK_SCALE = 1.8;

/** 3Dギャラリー用クエリカラム */
const SELECT_COLUMNS = `
  id, title, artist_name, image_url, description,
  is_for_sale, price, sns_links, created_at,
  is_sold, edition_mode, edition_total, edition_sold,
  confirmed, display_ready, display_end_at
`.replace(/\s+/g, '');

/** クエリ上限 */
const QUERY_LIMIT = 200;
const ARTWORK_ASPECT = 1.2;
const LABEL_NEAR_DISTANCE = 9; // 外壁は少し遠めで反応

type Props = {
  avatarRef: React.RefObject<THREE.Group>;
  artworkRefs: React.MutableRefObject<(THREE.Group | null)[]>;
  /** /float?date=YYYY-MM-DD 用（未指定なら今日） */
  dateStr?: string;
};

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
  scale = 4,
  aspect = 1.2,
  width,
  height,
}: {
  position: [number, number, number];
  rotation: [number, number, number];
  scale?: number;
  aspect?: number;
  width?: number;
  height?: number;
}) {
  const map = useTexture('/coming-soon.png');
  useMemo(() => {
    map.anisotropy = 8;
    map.minFilter = THREE.LinearMipmapLinearFilter;
    map.magFilter = THREE.LinearFilter;
    map.colorSpace = THREE.SRGBColorSpace;
  }, [map]);

  const BASE_H = 1.8;
  const H = height ?? (scale ?? BASE_H);
  const W = width ?? H * (aspect ?? 1.2);
  const k = H / BASE_H;
  const FRAME_PAD = 0.08 * k;
  const HALO_PAD = 0.22 * k;

  return (
    <group position={position} rotation={rotation}>
      <group rotation={[0, Math.PI, 0]}>
        <mesh>
          <planeGeometry args={[W + FRAME_PAD, H + FRAME_PAD]} />
          <meshStandardMaterial
            color="#eef2f7"
            emissive="#111111"
            emissiveIntensity={0.06}
            roughness={0.9}
            metalness={0.0}
          />
        </mesh>
        <mesh position={[0, 0, 0.002]}>
          <planeGeometry args={[W, H]} />
          <meshBasicMaterial map={map} toneMapped={false} />
        </mesh>
        <mesh position={[0, 0, -0.001]}>
          <planeGeometry args={[W + HALO_PAD, H + HALO_PAD]} />
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

export default function FloatArtworksInGallery({
  avatarRef,
  artworkRefs,
  dateStr,
}: Props): React.JSX.Element {
  const wallY = 3.5;
  // forest建物: 正方形60×60m（壁内面 x=±29.2, z=±29.2）
  const wallZ = 29.2;
  const wallX = 29.2;
  // 全4面共通: 5枚均等 = -22, -11, 0, 11, 22（11m間隔）
  const WALL_POSITIONS = [-22, -11, 0, 11, 22];

  const [allEntries, setAllEntries] = useState<Entry[]>([]);
  const [dailyEntries, setDailyEntries] = useState<Entry[]>([]);

  const resolvedDate = useMemo(() => {
    const raw = String(dateStr ?? '');
    return isValidDateString(raw) ? raw : getTodayDateString();
  }, [dateStr]);

  // 壁の実装と同様：カメラ距離で可視・不可視を切替
  const VISIBLE_DISTANCE = 70;
  const tmp = useRef(new THREE.Vector3());
  useFrame(({ camera }) => {
    for (const ref of artworkRefs.current) {
      if (!ref) continue;
      ref.getWorldPosition(tmp.current);
      const dist = tmp.current.distanceTo(camera.position);
      ref.visible = dist < VISIBLE_DISTANCE;
    }
  });

  useEffect(() => {
    const fetchDaily = async () => {
      const { data, error } = await supabase
        .from('entry_daily_slots')
        .select(
          `
          slot_index,
          entry:entries (
            id, title, artist_name, image_url, description,
            is_for_sale, price, sns_links, created_at,
            is_sold, edition_mode, edition_total, edition_sold,
            confirmed, display_ready, display_end_at
          )
        `
        )
        .eq('display_date', resolvedDate)
        .order('slot_index', { ascending: true });

      if (!error && data && data.length > 0) {
        const entries = data.map((d: any) => d.entry).filter(Boolean) as Entry[];
        setDailyEntries(entries);
      } else {
        setDailyEntries([]);
      }
    };
    fetchDaily();
  }, [resolvedDate]);

  useEffect(() => {
    if (dailyEntries.length > 0) return;

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
  }, [dailyEntries.length]);

  const entries = useMemo(() => {
    if (dailyEntries.length > 0) return dailyEntries;

    const now = Date.now();
    const displayable = allEntries.filter((e) => {
      if (!e.display_end_at) return true;
      return new Date(e.display_end_at).getTime() > now;
    });
    const stable = [...displayable].sort((a, b) => a.id - b.id);
    return pickDailyExhibits(stable, resolvedDate, FLOAT_DAILY_SLOT_COUNT) as Entry[];
  }, [dailyEntries, allEntries, resolvedDate]);

  const makeArtwork = (
    x: number,
    y: number,
    z: number,
    rotationY: number
  ): { position: [number, number, number]; rotation: [number, number, number] } => {
    const distanceFromWall = -0.4;
    const dir = new THREE.Vector3(0, 0, 1);
    dir.applyAxisAngle(new THREE.Vector3(0, 1, 0), rotationY);
    dir.multiplyScalar(distanceFromWall);
    return {
      position: [x + dir.x, y + dir.y, z + dir.z],
      rotation: [0, rotationY, 0],
    };
  };

  // 外壁: 5枚×4面 = 20スロット（PANEL_REFS_OFFSET = 20）、全面同一間隔
  const positions = [
    ...WALL_POSITIONS.map((x) => makeArtwork(x, wallY, -wallZ, Math.PI)),
    ...WALL_POSITIONS.map((x) => makeArtwork(x, wallY, wallZ, 0)),
    ...WALL_POSITIONS.map((z) => makeArtwork(-wallX, wallY, z, -Math.PI / 2)),
    ...WALL_POSITIONS.map((z) => makeArtwork(wallX, wallY, z, Math.PI / 2)),
  ];

  const labelWidth = 2.5 * ARTWORK_SCALE * ARTWORK_ASPECT;
  const labelHeight = 2.5 * ARTWORK_SCALE / ARTWORK_ASPECT;

  return (
    <>
      {positions.map((pos, i) => {
        const entry = entries[i];
        return (
          <group
            key={`slot-${i}`}
            position={pos.position}
            rotation={pos.rotation}
            ref={(el) => {
              artworkRefs.current[i] = el;
            }}
          >
            {entry ? (
              <>
                <LazyArtworkFrame
                  id={entry.id.toString()}
                  position={[0, 0, 0]}
                  rotation={[0, 0, 0]}
                  aspectRatio={ARTWORK_ASPECT}
                  scale={ARTWORK_SCALE}
                  title={entry.title}
                  author={entry.artist_name}
                  imageUrl={entry.image_url}
                  avatarRef={avatarRef}
                  // 購入関連データ
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
                <ArtworkLabel
                  position={[0, 0, 0]}
                  rotation={[0, 0, 0]}
                  width={labelWidth}
                  height={labelHeight}
                  nearDistance={LABEL_NEAR_DISTANCE}
                  avatarRef={avatarRef}
                  title={entry.title}
                  author={entry.artist_name}
                />
              </>
            ) : (
              <ComingSoonPanel position={[0, 0, 0]} rotation={[0, 0, 0]} />
            )}
          </group>
        );
      })}
    </>
  );
}
