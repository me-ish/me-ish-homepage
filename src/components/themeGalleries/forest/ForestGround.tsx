'use client';

import { useMemo } from 'react';
import * as THREE from 'three';
import { useTexture } from '@react-three/drei';

/**
 * ConcreteBuilding v2 — 打ちっぱなしコンクリート
 *
 * 天井は ExtrudeGeometry（Shape + 7穴）で構築:
 *   - 中庭開口 (8×8m)
 *   - Spine上スリット ×2 (1×21m)
 *   - 外壁回廊スカイライト ×4 (3×4m)
 */

const TILE_SCALE = 3;
const CEILING_THICKNESS = 0.3;

type BoxDef = { position: [number, number, number]; size: [number, number, number] };

// --- 外壁 ---
const EXTERIOR_WALLS: BoxDef[] = [
  { position: [0, 4, 19.8],   size: [60, 8, 0.4] },
  { position: [0, 4, -19.8],  size: [60, 8, 0.4] },
  { position: [-29.8, 4, 0],  size: [0.4, 8, 40] },
  { position: [29.8, 4, 0],   size: [0.4, 8, 40] },
];

// --- パーティション（Spineのみ） ---
const PARTITIONS: BoxDef[] = [
  { position: [-10, 3.25, -1.5], size: [0.35, 6.5, 21] },
  { position: [10, 3.25, -1.5],  size: [0.35, 6.5, 21] },
];

// --- 天井開口定義 ---
// Shape座標系: shape_x = world_x, shape_y = -world_z
// [x1, y1, x2, y2] で矩形の左下→右上
const CEILING_HOLES: [number, number, number, number][] = [
  // 中庭: world x [-4, 4], z [-7, 1] → shape y [-1, 7]
  [-4, -1, 4, 7],
  // 左Spineスリット: world x [-10.5, -9.5], z [-12, 9] → shape y [-9, 12]
  [-10.5, -9, -9.5, 12],
  // 右Spineスリット: world x [9.5, 10.5], z [-12, 9]
  [9.5, -9, 10.5, 12],
  // 左回廊スカイライト A: world x [-21.5, -18.5], z [6, 10] → shape y [-10, -6]
  [-21.5, -10, -18.5, -6],
  // 左回廊スカイライト B: world x [-21.5, -18.5], z [-10, -6] → shape y [6, 10]
  [-21.5, 6, -18.5, 10],
  // 右回廊スカイライト A: world x [18.5, 21.5], z [6, 10]
  [18.5, -10, 21.5, -6],
  // 右回廊スカイライト B: world x [18.5, 21.5], z [-10, -6]
  [18.5, 6, 21.5, 10],
];

// --- テクスチャユーティリティ ---

function makeTiledTextures(
  src: { map: THREE.Texture; normalMap: THREE.Texture; roughnessMap: THREE.Texture },
  rx: number,
  ry: number,
) {
  const cloneAndTile = (t: THREE.Texture) => {
    const c = t.clone();
    c.wrapS = c.wrapT = THREE.RepeatWrapping;
    c.repeat.set(rx, ry);
    c.needsUpdate = true;
    return c;
  };
  return {
    map: cloneAndTile(src.map),
    normalMap: cloneAndTile(src.normalMap),
    roughnessMap: cloneAndTile(src.roughnessMap),
  };
}

function calcRepeat(size: [number, number, number]): [number, number] {
  const sorted = [...size].sort((a, b) => b - a);
  return [
    Math.max(1, Math.round(sorted[0] / TILE_SCALE)),
    Math.max(1, Math.round(sorted[1] / TILE_SCALE)),
  ];
}

export default function ConcreteBuilding(): React.JSX.Element {
  const concreteTex = useTexture({
    map: '/textures/Plaster004_1K-JPG_Color.jpg',
    normalMap: '/textures/Plaster004_1K-JPG_NormalGL.jpg',
    roughnessMap: '/textures/Plaster004_1K-JPG_Roughness.jpg',
  });

  const floorTex = useTexture({
    map: '/textures/floor/color.jpg',
    normalMap: '/textures/floor/normal.jpg',
    roughnessMap: '/textures/floor/roughness.jpg',
  });

  // --- 天井ジオメトリ（ExtrudeGeometry + 7穴） ---
  const ceilingGeo = useMemo(() => {
    // 外枠（CCW）
    const shape = new THREE.Shape();
    shape.moveTo(-30, -20);
    shape.lineTo(30, -20);
    shape.lineTo(30, 20);
    shape.lineTo(-30, 20);
    shape.closePath();

    // 開口（CW）
    CEILING_HOLES.forEach(([x1, y1, x2, y2]) => {
      const hole = new THREE.Path();
      hole.moveTo(x1, y1);
      hole.lineTo(x1, y2);
      hole.lineTo(x2, y2);
      hole.lineTo(x2, y1);
      hole.closePath();
      shape.holes.push(hole);
    });

    return new THREE.ExtrudeGeometry(shape, {
      depth: CEILING_THICKNESS,
      bevelEnabled: false,
    });
  }, []);

  // --- マテリアル ---

  const wallMaterials = useMemo(() => {
    const all = [...EXTERIOR_WALLS, ...PARTITIONS];
    return all.map((box) => {
      const [rx, ry] = calcRepeat(box.size);
      const tex = makeTiledTextures(concreteTex, rx, ry);
      return new THREE.MeshStandardMaterial({
        ...tex,
        color: '#9E9A91',
        roughness: 0.82,
        metalness: 0,
        normalScale: new THREE.Vector2(0.6, 0.6),
      });
    });
  }, [concreteTex]);

  const floorMat = useMemo(() => {
    const tex = makeTiledTextures(floorTex, 20, 14);
    return new THREE.MeshStandardMaterial({
      ...tex,
      color: '#6B6660',
      roughness: 0.3,
      metalness: 0,
      normalScale: new THREE.Vector2(0.4, 0.4),
    });
  }, [floorTex]);

  // 天井マテリアル（ExtrudeGeometry のUVはワールド座標なので repeat = 1/TILE_SCALE）
  const ceilingMat = useMemo(() => {
    const tex = makeTiledTextures(concreteTex, 1 / TILE_SCALE, 1 / TILE_SCALE);
    return new THREE.MeshStandardMaterial({
      ...tex,
      color: '#ADA8A1',
      roughness: 0.9,
      metalness: 0,
      normalScale: new THREE.Vector2(0.5, 0.5),
      side: THREE.DoubleSide,
    });
  }, [concreteTex]);

  const allWalls = [...EXTERIOR_WALLS, ...PARTITIONS];

  return (
    <group name="concrete-building">
      {/* 床 */}
      <mesh position={[0, 0, 0]} rotation={[-Math.PI / 2, 0, 0]} material={floorMat}>
        <planeGeometry args={[60, 40]} />
      </mesh>

      {/* 天井（ExtrudeGeometry、開口付き） */}
      <mesh
        geometry={ceilingGeo}
        material={ceilingMat}
        position={[0, 8, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
      />

      {/* 外壁 + パーティション */}
      {allWalls.map((w, i) => (
        <mesh key={`wall-${i}`} position={w.position} material={wallMaterials[i]}>
          <boxGeometry args={w.size} />
        </mesh>
      ))}
    </group>
  );
}
