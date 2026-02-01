'use client';

import React, {
  useRef,
  useState,
  useMemo,
  forwardRef,
  useImperativeHandle,
} from 'react';
import { useFrame, ThreeElements } from '@react-three/fiber';
import * as THREE from 'three';
import { useSpring } from '@react-spring/three';
import { useTexture } from '@react-three/drei';
import { useZoomArtwork } from './ZoomArtworkContext';

// 定数
const GLOW_DISTANCE = 7;
const GLOW_INTENSITY = 1.5;
const GLOW_TIMEOUT = 1200;

type ArtworkFrameProps = {
  id: string;
  aspectRatio?: number;
  scale?: number;
  title?: string;
  author?: string;
  imageUrl?: string;
  avatarRef: React.RefObject<THREE.Group>;
  position?: readonly [number, number, number];
  rotation?: readonly [number, number, number];
  // 購入関連データ
  description?: string;
  is_for_sale?: boolean;
  price?: number | null;
  sns_links?: string;
  created_at?: string | null;
  is_sold?: boolean;
  edition_mode?: 'limited' | 'unlimited' | null;
  edition_total?: number | null;
  edition_sold?: number | null;
} & Omit<ThreeElements['group'], 'id'>;

type ArtworkFrameHandle = THREE.Group & {
  title: string;
  author: string;
};

const ArtworkFrame = forwardRef<ArtworkFrameHandle, ArtworkFrameProps>(
  (
    {
      id,
      position = [0, 2, 0],
      rotation = [0, 0, 0],
      aspectRatio = 1,
      scale = 1,
      title = 'Untitled',
      author = 'Unknown',
      imageUrl = '',
      avatarRef,
      // 購入関連データ
      description = '',
      is_for_sale = false,
      price = null,
      sns_links = '{}',
      created_at = null,
      is_sold = false,
      edition_mode = null,
      edition_total = null,
      edition_sold = 0,
      ...rest
    },
    ref
  ) => {
    const { setZoomedArtwork } = useZoomArtwork();
    const groupRef = useRef<THREE.Group>(null);
    const glowMatRef = useRef<THREE.MeshStandardMaterial>(null);

    // 再利用用ベクトル（GC回避）
    const artworkPos = useMemo(() => new THREE.Vector3(...position), [position]);

    useImperativeHandle(ref, () => {
      if (!groupRef.current) {
        throw new Error('groupRef is not available');
      }
      const group = groupRef.current as ArtworkFrameHandle;
      group.title = title;
      group.author = author;
      return group;
    }, [title, author]);

    const width = 2.5 * scale;
    const height = width / aspectRatio;
    const adjustedRotation: [number, number, number] = [
      rotation[0],
      rotation[1] + Math.PI,
      rotation[2],
    ];

    // フォールバック画像対応（public/textures/fallback.jpg を用意推奨）
    const texture = useTexture(imageUrl || '/textures/fallback.jpg');

    const [springs, api] = useSpring(() => ({
      emissiveIntensity: 0,
      config: { mass: 1, tension: 200, friction: 30 },
    }));

    const [shouldGlow, setShouldGlow] = useState(false);

    useFrame(() => {
      if (!avatarRef?.current) return;

      const avatarPosition = avatarRef.current.position;
      const distance = artworkPos.distanceTo(avatarPosition);

      api.start({
        emissiveIntensity: distance < GLOW_DISTANCE ? GLOW_INTENSITY : 0,
      });
      const mat = glowMatRef.current;
      if (mat) mat.emissiveIntensity = springs.emissiveIntensity.get();

      if (distance < GLOW_DISTANCE && !shouldGlow) {
        setShouldGlow(true);
        setTimeout(() => setShouldGlow(false), GLOW_TIMEOUT);
      }
    });

    return (
      <group
        ref={groupRef}
        position={position}
        rotation={adjustedRotation}
        onClick={(e) => {
          e.stopPropagation();

          // 版情報をそのまま渡す
          const total =
            typeof edition_total === 'number' && Number.isFinite(edition_total)
              ? edition_total
              : null;
          const sold =
            typeof edition_sold === 'number' && Number.isFinite(edition_sold)
              ? edition_sold
              : 0;

          setZoomedArtwork({
            id,
            imageUrl,
            title,
            author,
            width,
            height,
            description,
            price: price ?? 0,
            is_for_sale: !!is_for_sale,
            sns_links: sns_links ?? '{}',
            created_at: created_at ?? '',
            is_sold: !!is_sold,
            edition_mode: edition_mode ?? null,
            edition_total: total,
            edition_sold: sold,
          } as any);
        }}
        {...rest}
      >
        <mesh>
          <planeGeometry args={[width, height]} />
          <meshBasicMaterial map={texture} toneMapped={false} />
        </mesh>

        <mesh position={[0, 0, -0.01]}>
          <planeGeometry args={[width + 0.1, height + 0.1]} />
          <meshStandardMaterial
            ref={glowMatRef}
            color="#000000"
            emissive="#ffeeaa"
            side={THREE.DoubleSide}
          />
        </mesh>
      </group>
    );
  }
);

ArtworkFrame.displayName = 'ArtworkFrame';
export default ArtworkFrame;
