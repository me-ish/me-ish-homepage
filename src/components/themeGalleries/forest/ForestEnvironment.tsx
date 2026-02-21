'use client';

import { useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';

/**
 * ConcreteEnvironment v2 — ライティング
 *
 * Sun + PointLight×3（天井エリアライト代替）+ ヘミスフィア
 * 中庭開口から差し込む自然光をイメージ。
 */

// 背景（中庭から見える空の色）
const BACKGROUND_COLOR = '#87ACBF';

// JSON: sun intensity 3.0, color #FFF9F0
const SUN_COLOR = '#FFF9F0';

// Area lights → PointLight近似（3灯）
// Blender [x, y, z] → R3F [x, z, -y]
// [-20, 0, 7.8] → [-20, 7.8, 0]
// [0, 0, 7.8] → [0, 7.8, 0]
// [20, 0, 7.8] → [20, 7.8, 0]
const AREA_LIGHTS: [number, number, number][] = [
  [-20, 7.8, 0],
  [0, 7.8, 0],
  [20, 7.8, 0],
];

export default function ConcreteEnvironment(): React.JSX.Element {
  const { scene } = useThree();

  useEffect(() => {
    scene.background = new THREE.Color(BACKGROUND_COLOR);
    scene.fog = null;
    return () => {
      scene.background = null;
    };
  }, [scene]);

  return (
    <group name="concrete-environment">
      <ambientLight color={SUN_COLOR} intensity={0.5} />

      <directionalLight
        color={SUN_COLOR}
        intensity={2.0}
        position={[15, 30, -10]}
        castShadow={false}
      />

      <hemisphereLight
        color="#B0C4DE"
        groundColor="#6B6660"
        intensity={0.5}
      />

      {/* 中庭直上からの光 */}
      <directionalLight
        color="#FFFFFF"
        intensity={1.5}
        position={[0, 20, -3]}
        castShadow={false}
      />

      {/* 天井エリアライト代替 */}
      {AREA_LIGHTS.map((pos, i) => (
        <pointLight
          key={i}
          color={SUN_COLOR}
          intensity={120}
          position={pos}
          distance={25}
          decay={2}
        />
      ))}
    </group>
  );
}
