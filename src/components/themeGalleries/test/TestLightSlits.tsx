'use client';

import { useMemo } from 'react';
import * as THREE from 'three';

/**
 * TestLightSlits — 光のスリット
 *
 * パーティション上部スリット（壁高6.5m↔天井8mの1.5m空間）
 * + 外壁天井接合部の薄い光帯。
 * 各スリットに PointLight を配置して実際に照らす。
 */

const SLIT_COLOR = '#F2F7FF';
const SLIT_EMISSIVE_INTENSITY = 5.0;

// Blender [x,y,z] → R3F [x, z, -y]
// Blender size [sx,sy,sz] → R3F [sx, sz, sy]
type SlitDef = { name: string; position: [number, number, number]; size: [number, number, number] };

const LIGHT_SLITS: SlitDef[] = [
  // パーティション上部スリット（Spine 30m、中央揃え）
  { name: 'Slit_L_Spine', position: [-10, 7.25, 0],  size: [0.05, 1.3, 30] },
  { name: 'Slit_R_Spine', position: [10, 7.25, 0],   size: [0.05, 1.3, 30] },
  // 外壁上部スリット（60×60正方形に対応）
  { name: 'Slit_Wall_Back',  position: [0, 7.7, 29.6],   size: [59, 0.15, 0.05] },
  { name: 'Slit_Wall_Front', position: [0, 7.7, -29.6],  size: [59, 0.15, 0.05] },
  { name: 'Slit_Wall_Left',  position: [-29.6, 7.7, 0],  size: [0.05, 0.15, 59] },
  { name: 'Slit_Wall_Right', position: [29.6, 7.7, 0],   size: [0.05, 0.15, 59] },
];

export default function TestLightSlits(): React.JSX.Element {
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
      {LIGHT_SLITS.map((slit) => {
        // パーティションスリットは強め、外壁スリットは弱め
        const isWallSlit = slit.name.startsWith('Slit_Wall');
        const lightIntensity = isWallSlit ? 5 : 15;
        const lightDistance = isWallSlit ? 8 : 12;

        return (
          <group key={slit.name}>
            {/* パーティションSpineスリットは板メッシュを非表示（天井穴と重なるため） */}
            {!slit.name.includes('Spine') && (
              <mesh position={slit.position} material={slitMaterial}>
                <boxGeometry args={slit.size} />
              </mesh>
            )}
            <pointLight
              position={[slit.position[0], slit.position[1] - 0.5, slit.position[2]]}
              color={SLIT_COLOR}
              intensity={lightIntensity}
              distance={lightDistance}
              decay={2}
            />
          </group>
        );
      })}
    </group>
  );
}
