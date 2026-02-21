'use client';

import { useMemo } from 'react';
import * as THREE from 'three';

/**
 * ConcreteBuilding v2 — 建物構造
 *
 * 60m×40m、天井高8m。中庭（ガラス壁+水盤）、ベンチ4台。
 * 天井は中庭上部に8m×8mの開口。
 * 座標: Blender [x,y,z] → R3F [x, z, -y]
 * サイズ: Blender [sx,sy,sz] → R3F boxGeometry args [sx, sz, sy]
 */

// --- マテリアル定義 ---
const MAT = {
  wall:    { color: '#9E9A91', roughness: 0.82, metalness: 0 },
  floor:   { color: '#6B6660', roughness: 0.3, metalness: 0 },
  ceiling: { color: '#ADA8A1', roughness: 0.9, metalness: 0 },
  water:   { color: '#263841', roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.6 },
  glass:   { color: '#E5F0FF', roughness: 0, metalness: 0.1, transparent: true, opacity: 0.15 },
  bench:   { color: '#8A8580', roughness: 0.7, metalness: 0 },
} as const;

type BoxDef = { position: [number, number, number]; size: [number, number, number] };

// --- 外壁 (R3F座標) ---
const EXTERIOR_WALLS: BoxDef[] = [
  { position: [0, 4, 19.8],     size: [60, 8, 0.4] },   // Back
  { position: [0, 4, -19.8],    size: [60, 8, 0.4] },   // Front
  { position: [-29.8, 4, 0],    size: [0.4, 8, 40] },   // Left
  { position: [29.8, 4, 0],     size: [0.4, 8, 40] },   // Right
];

// --- パーティション (R3F座標) ---
const PARTITIONS: BoxDef[] = [
  // Left U
  { position: [-10, 3.25, -1.5],  size: [0.35, 6.5, 21] },   // Spine
  { position: [-16, 3.25, -12],   size: [12, 6.5, 0.35] },   // Top arm
  { position: [-16, 3.25, 9],     size: [12, 6.5, 0.35] },   // Bottom arm
  // Right U
  { position: [10, 3.25, -1.5],   size: [0.35, 6.5, 21] },   // Spine
  { position: [16, 3.25, -12],    size: [12, 6.5, 0.35] },   // Top arm
  { position: [16, 3.25, 9],      size: [12, 6.5, 0.35] },   // Bottom arm
];

// --- 中庭要素 (R3F座標) ---
const COURTYARD: { name: string; position: [number, number, number]; size: [number, number, number]; mat: keyof typeof MAT }[] = [
  // ガラス壁4面
  { name: 'Glass_N', position: [0, 4, -7],    size: [8, 8, 0.05],   mat: 'glass' },
  { name: 'Glass_S', position: [0, 4, 1],     size: [8, 8, 0.05],   mat: 'glass' },
  { name: 'Glass_E', position: [4, 4, -3],    size: [0.05, 8, 8],   mat: 'glass' },
  { name: 'Glass_W', position: [-4, 4, -3],   size: [0.05, 8, 8],   mat: 'glass' },
  // 水盤
  { name: 'Water',   position: [0, 0.05, -3], size: [7.8, 0.1, 7.8], mat: 'water' },
  // 中庭床
  { name: 'Floor',   position: [0, -0.05, -3], size: [8, 0.1, 8],    mat: 'floor' },
];

// --- ベンチ (R3F座標) ---
const BENCHES: BoxDef[] = [
  { position: [0, 0.22, 4],     size: [1.5, 0.22, 0.3] },
  { position: [0, 0.22, -2],    size: [1.5, 0.22, 0.3] },
  { position: [-18, 0.25, 0],   size: [3, 0.5, 0.5] },
  { position: [18, 0.25, 0],    size: [3, 0.5, 0.5] },
];

// --- 天井パネル（中庭部分に開口） ---
// 中庭開口: R3F x [-4, 4], z [-7, 1]
// 天井全体: x [-30, 30], z [-20, 20], y = 8
const CEILING_PANELS: { position: [number, number, number]; size: [number, number] }[] = [
  // z: 1 → 20 (back section, full width)
  { position: [0, 8, 10.5],    size: [60, 19] },
  // z: -20 → -7 (front section, full width)
  { position: [0, 8, -13.5],   size: [60, 13] },
  // z: -7 → 1, x: -30 → -4 (left fill)
  { position: [-17, 8, -3],    size: [26, 8] },
  // z: -7 → 1, x: 4 → 30 (right fill)
  { position: [17, 8, -3],     size: [26, 8] },
];

export default function ConcreteBuilding(): React.JSX.Element {
  const wallMat = useMemo(() => new THREE.MeshStandardMaterial(MAT.wall), []);
  const floorMat = useMemo(() => new THREE.MeshStandardMaterial(MAT.floor), []);
  const ceilingMat = useMemo(() => new THREE.MeshStandardMaterial({ ...MAT.ceiling, side: THREE.DoubleSide }), []);
  const waterMat = useMemo(() => new THREE.MeshStandardMaterial(MAT.water), []);
  const glassMat = useMemo(() => new THREE.MeshStandardMaterial({ ...MAT.glass, side: THREE.DoubleSide }), []);
  const benchMat = useMemo(() => new THREE.MeshStandardMaterial(MAT.bench), []);

  const matMap: Record<string, THREE.MeshStandardMaterial> = {
    wall: wallMat, floor: floorMat, ceiling: ceilingMat,
    water: waterMat, glass: glassMat, bench: benchMat,
  };

  return (
    <group name="concrete-building">
      {/* 床 (60m × 40m) */}
      <mesh position={[0, 0, 0]} rotation={[-Math.PI / 2, 0, 0]} material={floorMat}>
        <planeGeometry args={[60, 40]} />
      </mesh>

      {/* 天井（中庭開口あり、4分割パネル） */}
      {CEILING_PANELS.map((panel, i) => (
        <mesh key={`ceil-${i}`} position={panel.position} rotation={[Math.PI / 2, 0, 0]} material={ceilingMat}>
          <planeGeometry args={panel.size} />
        </mesh>
      ))}

      {/* 外壁 */}
      {EXTERIOR_WALLS.map((w, i) => (
        <mesh key={`wall-${i}`} position={w.position} material={wallMat}>
          <boxGeometry args={w.size} />
        </mesh>
      ))}

      {/* パーティション */}
      {PARTITIONS.map((p, i) => (
        <mesh key={`part-${i}`} position={p.position} material={wallMat}>
          <boxGeometry args={p.size} />
        </mesh>
      ))}

      {/* 中庭要素 */}
      {COURTYARD.map((c) => (
        <mesh key={c.name} position={c.position} material={matMap[c.mat]}>
          <boxGeometry args={c.size} />
        </mesh>
      ))}

      {/* ベンチ */}
      {BENCHES.map((b, i) => (
        <mesh key={`bench-${i}`} position={b.position} material={benchMat}>
          <boxGeometry args={b.size} />
        </mesh>
      ))}
    </group>
  );
}
