'use client';

import React, { useState, useRef, useMemo, Suspense } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import ArtworkFrame from './ArtworkFrame';

// 定数
const LOAD_DISTANCE = 40;      // この距離に入ったらテクスチャロード開始
const PLACEHOLDER_COLOR = '#dde4ec';

type LazyArtworkFrameProps = {
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
};

/**
 * PlaceholderFrame - テクスチャロード前のプレースホルダー
 */
function PlaceholderFrame({
  position,
  rotation,
  width,
  height,
}: {
  position: readonly [number, number, number];
  rotation: [number, number, number];
  width: number;
  height: number;
}) {
  return (
    <group position={position} rotation={rotation}>
      <mesh>
        <planeGeometry args={[width, height]} />
        <meshBasicMaterial color={PLACEHOLDER_COLOR} />
      </mesh>
      {/* フレーム縁 */}
      <mesh position={[0, 0, -0.01]}>
        <planeGeometry args={[width + 0.1, height + 0.1]} />
        <meshStandardMaterial color="#cccccc" />
      </mesh>
    </group>
  );
}

/**
 * LazyArtworkFrame - 距離ベースの遅延ロードを行う ArtworkFrame ラッパー
 *
 * - LOAD_DISTANCE より遠い: プレースホルダー表示
 * - LOAD_DISTANCE 以内: 実際の ArtworkFrame をロード
 * - 一度ロードしたら解除しない（メモリ効率 vs UX のトレードオフ）
 */
export default function LazyArtworkFrame({
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
}: LazyArtworkFrameProps): React.JSX.Element {
  const [shouldLoad, setShouldLoad] = useState(false);

  // 位置ベクトル（GC回避）
  const posVec = useMemo(() => new THREE.Vector3(...position), [position]);

  // 距離チェック用 ref
  const checkIntervalRef = useRef(0);

  const width = 2.5 * scale;
  const height = width / aspectRatio;

  const adjustedRotation: [number, number, number] = [
    rotation[0],
    rotation[1] + Math.PI,
    rotation[2],
  ];

    // ✅ R3F/three の Euler タプルは mutable 前提の型が来ることがあるため
  // readonly を mutable に変換して渡す
  const rotationMutable: [number, number, number] = [
    rotation[0],
    rotation[1],
    rotation[2],
  ];

  useFrame(() => {
    // すでにロード済みなら何もしない
    if (shouldLoad) return;

    // 毎フレームチェックは重いので、数フレームに1回
    checkIntervalRef.current++;
    if (checkIntervalRef.current % 10 !== 0) return;

    if (!avatarRef?.current) return;

    const dist = posVec.distanceTo(avatarRef.current.position);
    if (dist < LOAD_DISTANCE) {
      setShouldLoad(true);
    }
  });

  // ロード前はプレースホルダー
  if (!shouldLoad) {
    return (
      <PlaceholderFrame
        position={position}
        rotation={adjustedRotation}
        width={width}
        height={height}
      />
    );
  }

  // ロード後は実際の ArtworkFrame（Suspense でローディング中もフォールバック）
  return (
    <Suspense
      fallback={
        <PlaceholderFrame
          position={position}
          rotation={adjustedRotation}
          width={width}
          height={height}
        />
      }
    >
      <ArtworkFrame
        id={id}
        position={position}
        rotation={rotationMutable}
        aspectRatio={aspectRatio}
        scale={scale}
        title={title}
        author={author}
        imageUrl={imageUrl}
        avatarRef={avatarRef}
        // 購入関連データ
        description={description}
        is_for_sale={is_for_sale}
        price={price}
        sns_links={sns_links}
        created_at={created_at}
        is_sold={is_sold}
        edition_mode={edition_mode}
        edition_total={edition_total}
        edition_sold={edition_sold}
      />
    </Suspense>
  );
}
