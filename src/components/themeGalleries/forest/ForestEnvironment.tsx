'use client';

import { useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';

/**
 * ForestEnvironment - 森の雰囲気を演出するフォグ・ライティング
 *
 * - FogExp2で奥行き感のある霧
 * - 木漏れ日を意識した暖色系directional light
 * - 柔らかいambient lightで全体を包む
 */

// 定数
const FOG_COLOR = '#1a2f1a';
const FOG_DENSITY = 0.015;
const BACKGROUND_COLOR = '#0d1a0d';

// ライト設定
const AMBIENT_COLOR = '#4a6b4a';
const AMBIENT_INTENSITY = 0.4;

const SUNLIGHT_COLOR = '#fff5e0';
const SUNLIGHT_INTENSITY = 1.2;
const SUNLIGHT_POSITION: [number, number, number] = [30, 50, 20];

const FILL_COLOR = '#a0c0a0';
const FILL_INTENSITY = 0.3;
const FILL_POSITION: [number, number, number] = [-20, 30, -10];

export default function ForestEnvironment(): React.JSX.Element {
  const { scene } = useThree();

  // シーン設定（背景色・フォグ）
  useEffect(() => {
    scene.background = new THREE.Color(BACKGROUND_COLOR);
    scene.fog = new THREE.FogExp2(FOG_COLOR, FOG_DENSITY);

    return () => {
      scene.fog = null;
    };
  }, [scene]);

  return (
    <group name="forest-environment">
      {/* アンビエントライト - 森全体の基調 */}
      <ambientLight color={AMBIENT_COLOR} intensity={AMBIENT_INTENSITY} />

      {/* メイン太陽光 - 木漏れ日のイメージ */}
      <directionalLight
        color={SUNLIGHT_COLOR}
        intensity={SUNLIGHT_INTENSITY}
        position={SUNLIGHT_POSITION}
        castShadow={false}
      />

      {/* フィルライト - 影を柔らかくする補助光 */}
      <directionalLight
        color={FILL_COLOR}
        intensity={FILL_INTENSITY}
        position={FILL_POSITION}
        castShadow={false}
      />

      {/* ヘミスフィアライト - 空と地面の色差 */}
      <hemisphereLight
        color="#87ceeb"
        groundColor="#2d4a2d"
        intensity={0.3}
      />
    </group>
  );
}
