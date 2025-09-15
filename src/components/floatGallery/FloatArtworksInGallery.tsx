'use client';

import React, { useEffect, useState, useMemo } from 'react';
import * as THREE from 'three';
import { useTexture } from '@react-three/drei';
import ArtworkFrame from '../shared/ArtworkFrame';
import { supabase } from '@/lib/supabaseClient';

type Props = {
  avatarRef: React.RefObject<THREE.Group>;
  artworkRefs: React.MutableRefObject<(THREE.Group | null)[]>;
};

type Entry = {
  id: number;
  title: string;
  artist_name: string;
  image_url: string;
};

function ComingSoonPanel({
  position,
  rotation,
  // 追加: ArtworkFrame と同じ指定で使えるように
  scale =4,        // 例: 4
  aspect = 1.2,     // 例: 1.2
  width,            // width/height を直接渡したい場合はこれら優先
  height,
}: {
  position: [number, number, number];
  rotation: [number, number, number];
  scale?: number;        // ★ 追加
  aspect?: number;       // ★ 追加
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

  // ---- サイズ計算（width/height が来ていればそれを優先）----
  // ArtworkFrame の基準高さを 1.8 として、枠やオーラの太さも追従
  const BASE_H = 1.8;
  const H = height ?? (scale ?? BASE_H);
  const W = width ?? H * (aspect ?? 1.2);
  const k = H / BASE_H;           // スケール係数
  const FRAME_PAD = 0.08 * k;     // 枠の太さ
  const HALO_PAD  = 0.22 * k;     // オーラの広がり

  return (
    <group position={position} rotation={rotation}>
      {/* 内側（-Z）を正面にするために y=π で反転 */}
      <group rotation={[0, Math.PI, 0]}>
        {/* 下地（額っぽい縁取り） */}
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

        {/* 画像面（正面=内側） */}
        <mesh position={[0, 0, 0.002]}>
          <planeGeometry args={[W, H]} />
          <meshBasicMaterial map={map} toneMapped={false} />
        </mesh>

        {/* ほんのりオーラ */}
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
}: Props): React.JSX.Element {
  const wallY = 3.5;
  const wallZ = 39;
  const wallX = 39;
  const offset = 10;
  const centerGap = 30;
  const start = -30;

  const [entries, setEntries] = useState<Entry[]>([]);

  useEffect(() => {
    const fetchApproved = async () => {
      const { data, error } = await supabase
        .from('entries')
        .select('*')
        .eq('confirmed', true)
        .eq('display_ready', true) // ★ 方法Bに合わせる
        .eq('gallery_type', 'float')
        .order('created_at', { ascending: false });

      if (!error && data) setEntries(data as Entry[]);
    };
    fetchApproved();
  }, []);

  const generatePositions = (start: number): number[] => {
    const left = Array.from({ length: 3 }, (_, i) => start + i * offset);
    const right = Array.from({ length: 3 }, (_, i) => start + offset + centerGap + i * offset);
    return [...left, ...right];
  };

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

  const positions = [
    ...generatePositions(start).map((x) => makeArtwork(x, wallY, -wallZ, Math.PI)),
    ...generatePositions(start).map((x) => makeArtwork(x, wallY,  wallZ, 0)),
    ...generatePositions(start).map((z) => makeArtwork(-wallX, wallY, z, -Math.PI / 2)),
    ...generatePositions(start).map((z) => makeArtwork( wallX, wallY, z,  Math.PI / 2)),
  ];

  return (
    <>
{positions.map((pos, i) => {
  const entry = entries[i];
  const lightHeight = 2.2;

  return (
    // ★ ここを「不変キー」にする（entry.id や soon-* は使わない）
    <group key={`slot-${i}`} position={pos.position} rotation={pos.rotation}>
      {/* 中身だけを条件で切替 */}
      {entry ? (
        <ArtworkFrame
          id={entry.id.toString()}
          // position/rotation は親groupに持たせたので不要なら外してOK
          position={[0,0,0]}
          rotation={[0,0,0]}
          aspectRatio={1.2}
          scale={1.8}
          title={entry.title}
          author={entry.artist_name}
          imageUrl={entry.image_url}
          avatarRef={avatarRef}
          ref={(el: THREE.Group | null) => {
            artworkRefs.current[i] = el;
          }}
        />
      ) : (
        <ComingSoonPanel
          // 同じく親groupが持つので[0,0,0]でOK
          position={[0,0,0]}
          rotation={[0,0,0]}
        />
      )}

      {/* ライトは常に同じ場所に置く */}
      <pointLight
        position={[0, lightHeight, 0]}
        intensity={entry ? 1.2 : 0.7}
        distance={entry ? 8 : 7}
        decay={2}
        color={entry ? '#ffffff' : '#e8f6ff'}
      />
    </group>
  );
})}

    </>
  );
}
