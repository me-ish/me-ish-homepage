'use client';

import { useMemo } from 'react';
import * as THREE from 'three';

/**
 * ConcreteLightSlits - 天井・壁のスリット光
 *
 * 安藤忠雄建築の特徴的な光のスリットを再現。
 * Emissiveメッシュ + 近傍PointLightで光の演出。
 */

const SLIT_COLOR = '#F2F7FF';
const SLIT_EMISSIVE_INTENSITY = 3.0;

// JSON light_slits → Three.js座標に変換済み
// Blender [x, y, z] → Three.js [x, z, -y]
// サイズ [sx, sy, sz] → Three.js [sx, sz, sy]
const LIGHT_SLITS: { name: string; position: [number, number, number]; size: [number, number, number] }[] = [
  // Ceiling_CrossSlit_X: [0, 0, 4.45] → [0, 4.45, 0], size [14.5, 0.15, 0.05] → [14.5, 0.05, 0.15]
  { name: 'CrossSlit_X', position: [0, 4.45, 0], size: [14.5, 0.05, 0.15] },
  // Ceiling_CrossSlit_Y: [0, 0, 4.45] → [0, 4.45, 0], size [0.15, 9.5, 0.05] → [0.15, 0.05, 9.5]
  { name: 'CrossSlit_Y', position: [0, 4.45, 0], size: [0.15, 0.05, 9.5] },
  // Ceiling_LightSlit_0: [-7, 0, 4.45] → [-7, 4.45, 0], size [0.3, 9, 0.05] → [0.3, 0.05, 9]
  { name: 'LightSlit_L', position: [-7, 4.45, 0], size: [0.3, 0.05, 9] },
  // Ceiling_LightSlit_1: [7, 0, 4.45] → [7, 4.45, 0], size [0.3, 9, 0.05] → [0.3, 0.05, 9]
  { name: 'LightSlit_R', position: [7, 4.45, 0], size: [0.3, 0.05, 9] },
  // Wall_Slit_0: [0, -9.7, 4.35] → [0, 4.35, 9.7], size [14.7, 0.05, 0.08] → [14.7, 0.08, 0.05]
  { name: 'WallSlit_Back', position: [0, 4.35, 9.7], size: [14.7, 0.08, 0.05] },
  // Wall_Slit_1: [0, 9.7, 4.35] → [0, 4.35, -9.7], size [14.7, 0.05, 0.08] → [14.7, 0.08, 0.05]
  { name: 'WallSlit_Front', position: [0, 4.35, -9.7], size: [14.7, 0.08, 0.05] },
  // Wall_Slit_2: [-14.7, 0, 4.35] → [-14.7, 4.35, 0], size [0.05, 9.7, 0.08] → [0.05, 0.08, 9.7]
  { name: 'WallSlit_Left', position: [-14.7, 4.35, 0], size: [0.05, 0.08, 9.7] },
  // Wall_Slit_3: [14.7, 0, 4.35] → [14.7, 4.35, 0], size [0.05, 9.7, 0.08] → [0.05, 0.08, 9.7]
  { name: 'WallSlit_Right', position: [14.7, 4.35, 0], size: [0.05, 0.08, 9.7] },
];

export default function ConcreteLightSlits(): React.JSX.Element {
  const slitMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: SLIT_COLOR,
        emissive: SLIT_COLOR,
        emissiveIntensity: SLIT_EMISSIVE_INTENSITY,
        roughness: 0.1,
        metalness: 0,
      }),
    []
  );

  return (
    <group name="concrete-light-slits">
      {LIGHT_SLITS.map((slit) => (
        <group key={slit.name}>
          {/* スリット本体（発光メッシュ） */}
          <mesh position={slit.position} material={slitMaterial}>
            <boxGeometry args={slit.size} />
          </mesh>
          {/* スリット近傍のポイントライト（実際に周囲を照らす） */}
          <pointLight
            position={[slit.position[0], slit.position[1] - 0.3, slit.position[2]]}
            color={SLIT_COLOR}
            intensity={8}
            distance={6}
            decay={2}
          />
        </group>
      ))}
    </group>
  );
}
