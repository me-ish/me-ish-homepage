'use client';

import { useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import { Sky } from '@react-three/drei';
import * as THREE from 'three';

/**
 * ConcreteEnvironment v2 — ライティング + Sky
 *
 * 天井開口から見える空を drei の Sky で描画。
 * 安藤忠雄建築の「切り取られた空」を再現。
 */

const SUN_COLOR = '#FFF9F0';

// 太陽位置（Sky コンポーネント用）
// やや西寄りの午後の光をイメージ
const SUN_POSITION: [number, number, number] = [100, 60, -80];

// 天井開口ライト — 各開口の直下に配置
type OpeningLight = { position: [number, number, number]; intensity: number; distance: number };

const OPENING_LIGHTS: OpeningLight[] = [
  // 中庭開口 (8×8m)
  { position: [0, 7.5, -3], intensity: 200, distance: 30 },
  // 左Spineスリット (1×21m) — 3点分散
  { position: [-10, 7.5, -8], intensity: 40, distance: 15 },
  { position: [-10, 7.5, 0],  intensity: 40, distance: 15 },
  { position: [-10, 7.5, 8],  intensity: 40, distance: 15 },
  // 右Spineスリット (1×21m) — 3点分散
  { position: [10, 7.5, -8], intensity: 40, distance: 15 },
  { position: [10, 7.5, 0],  intensity: 40, distance: 15 },
  { position: [10, 7.5, 8],  intensity: 40, distance: 15 },
  // 左回廊スカイライト A (world z [6,10])
  { position: [-20, 7.5, -8], intensity: 60, distance: 18 },
  // 左回廊スカイライト B (world z [-10,-6])
  { position: [-20, 7.5, 8],  intensity: 60, distance: 18 },
  // 右回廊スカイライト A
  { position: [20, 7.5, -8], intensity: 60, distance: 18 },
  // 右回廊スカイライト B
  { position: [20, 7.5, 8],  intensity: 60, distance: 18 },
];

export default function ConcreteEnvironment(): React.JSX.Element {
  const { scene } = useThree();

  useEffect(() => {
    // 背景はSkyが担当するのでnullに
    scene.background = null;
    scene.fog = null;
    return () => {
      scene.background = null;
    };
  }, [scene]);

  return (
    <group name="concrete-environment">
      {/* 手続き的な空（天井開口から見える） */}
      <Sky
        distance={450000}
        sunPosition={SUN_POSITION}
        turbidity={6}
        rayleigh={0.5}
        mieCoefficient={0.005}
        mieDirectionalG={0.8}
      />

      <ambientLight color={SUN_COLOR} intensity={0.5} />

      {/* メイン太陽光 */}
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

      {/* 中庭開口から差し込む光 */}
      <directionalLight
        color="#FFFFFF"
        intensity={1.5}
        position={[0, 20, -3]}
        castShadow={false}
      />

      {/* 天井開口ライト — 各開口の直下 */}
      {OPENING_LIGHTS.map((light, i) => (
        <pointLight
          key={`opening-${i}`}
          color={SUN_COLOR}
          intensity={light.intensity}
          position={light.position}
          distance={light.distance}
          decay={2}
        />
      ))}
    </group>
  );
}
