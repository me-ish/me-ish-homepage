'use client';

import { useMemo } from 'react';
import * as THREE from 'three';

/**
 * ForestGround - 森の地面
 *
 * シンプルな円形の地面。質感は後で調整可能。
 * 中心から外側に向かって少しフェードアウトする。
 */

// 定数
const GROUND_RADIUS = 100;
const GROUND_SEGMENTS = 64;
const GROUND_COLOR = '#1a2a1a';

export default function ForestGround(): React.JSX.Element {
  const material = useMemo(() => {
    return new THREE.MeshStandardMaterial({
      color: GROUND_COLOR,
      roughness: 0.9,
      metalness: 0.0,
      transparent: true,
      opacity: 0.95,
    });
  }, []);

  return (
    <group name="forest-ground">
      {/* メイン地面 */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0, 0]}
        receiveShadow={false}
        material={material}
      >
        <circleGeometry args={[GROUND_RADIUS, GROUND_SEGMENTS]} />
      </mesh>

      {/* 地面の下のダークレイヤー（端の切れ目を隠す） */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, -0.5, 0]}
      >
        <circleGeometry args={[GROUND_RADIUS * 1.5, 32]} />
        <meshBasicMaterial color="#0a0f0a" />
      </mesh>
    </group>
  );
}
