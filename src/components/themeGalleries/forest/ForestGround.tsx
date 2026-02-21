'use client';

import { useMemo } from 'react';
import * as THREE from 'three';

/**
 * ConcreteBuilding - 建物構造（床・天井・外壁・パーティション）
 *
 * JSON gallery_structure.json の座標をBlender→Three.jsに変換済み。
 * Blender [x, y, z] → Three.js [x, z, -y]
 * サイズ [sx, sy, sz] → Three.js [sx, sz, sy]
 */

// マテリアル定義（JSON materials より）
const MATERIALS = {
  wall: { color: '#9E9A91', roughness: 0.85, metalness: 0 },
  floor: { color: '#736E66', roughness: 0.35, metalness: 0 },
  ceiling: { color: '#ACA8A0', roughness: 0.9, metalness: 0 },
} as const;

// 外壁データ（Three.js座標に変換済み）
const EXTERIOR_WALLS: { position: [number, number, number]; size: [number, number, number] }[] = [
  // Wall_Back: [0, -9.85, 2.25] → [0, 2.25, 9.85]
  { position: [0, 2.25, 9.85], size: [30, 4.5, 0.3] },
  // Wall_Front: [0, 9.85, 2.25] → [0, 2.25, -9.85]
  { position: [0, 2.25, -9.85], size: [30, 4.5, 0.3] },
  // Wall_Left: [-14.85, 0, 2.25] → [-14.85, 2.25, 0]
  { position: [-14.85, 2.25, 0], size: [0.3, 4.5, 20] },
  // Wall_Right: [14.85, 0, 2.25] → [14.85, 2.25, 0]
  { position: [14.85, 2.25, 0], size: [0.3, 4.5, 20] },
];

// パーティションデータ（Three.js座標に変換済み）
const PARTITIONS: { position: [number, number, number]; size: [number, number, number] }[] = [
  // U_L_Spine: [-5, 0.25, 2] → [-5, 2, -0.25]
  { position: [-5, 2, -0.25], size: [0.25, 4, 10.5] },
  // U_L_Top: [-8, 5.5, 2] → [-8, 2, -5.5]
  { position: [-8, 2, -5.5], size: [6, 4, 0.25] },
  // U_L_Bottom: [-8, -5, 2] → [-8, 2, 5]
  { position: [-8, 2, 5], size: [6, 4, 0.25] },
  // U_R_Spine: [5, 0.25, 2] → [5, 2, -0.25]
  { position: [5, 2, -0.25], size: [0.25, 4, 10.5] },
  // U_R_Top: [8, 5.5, 2] → [8, 2, -5.5]
  { position: [8, 2, -5.5], size: [6, 4, 0.25] },
  // U_R_Bottom: [8, -5, 2] → [8, 2, 5]
  { position: [8, 2, 5], size: [6, 4, 0.25] },
];

export default function ConcreteBuilding(): React.JSX.Element {
  const wallMaterial = useMemo(
    () => new THREE.MeshStandardMaterial(MATERIALS.wall),
    []
  );
  const floorMaterial = useMemo(
    () => new THREE.MeshStandardMaterial(MATERIALS.floor),
    []
  );
  const ceilingMaterial = useMemo(
    () => new THREE.MeshStandardMaterial(MATERIALS.ceiling),
    []
  );

  return (
    <group name="concrete-building">
      {/* 床: y=0, 30m x 20m */}
      <mesh position={[0, 0, 0]} rotation={[-Math.PI / 2, 0, 0]} material={floorMaterial}>
        <planeGeometry args={[30, 20]} />
      </mesh>

      {/* 天井: y=4.5, 30m x 20m */}
      <mesh position={[0, 4.5, 0]} rotation={[Math.PI / 2, 0, 0]} material={ceilingMaterial}>
        <planeGeometry args={[30, 20]} />
      </mesh>

      {/* 外壁 */}
      {EXTERIOR_WALLS.map((wall, i) => (
        <mesh key={`wall-${i}`} position={wall.position} material={wallMaterial}>
          <boxGeometry args={wall.size} />
        </mesh>
      ))}

      {/* パーティション（U字型 x2） */}
      {PARTITIONS.map((part, i) => (
        <mesh key={`partition-${i}`} position={part.position} material={wallMaterial}>
          <boxGeometry args={part.size} />
        </mesh>
      ))}
    </group>
  );
}
