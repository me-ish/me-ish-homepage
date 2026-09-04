'use client';

import { useMemo } from 'react';
import * as THREE from 'three';

/**
 * TestExhibitPanels — テスト用ダミーアートワーク
 *
 * サイズ 4m × 3m。余裕のある間隔で配置。
 * 外壁16点 + コの字Spine両面8点。
 */

const FRAME_MAT = { color: '#1F1F1F', roughness: 0.25, metalness: 0.85 };
const CANVAS_MAT = { color: '#E0D9CC', roughness: 0.65, metalness: 0 };

const ART_W = 4.0;
const ART_H = 3.0;
const FRAME_DEPTH = 0.08;
const FRAME_BORDER = 0.06;

const FACING_ROT: Record<string, number> = {
  '+y': Math.PI,
  '-y': 0,
  '+x': -Math.PI / 2,
  '-x': Math.PI / 2,
};

type ArtworkDef = {
  id: string;
  position: [number, number, number];
  rotY: number;
};

function b2r(p: [number, number, number]): [number, number, number] {
  return [p[0], p[2], -p[1]];
}

function art(id: string, pos: [number, number, number], facing: string): ArtworkDef {
  return { id, position: b2r(pos), rotY: FACING_ROT[facing] };
}

// 掛け高さ: Blender z=2.5 → 作品下端 y=1.0, 上端 y=4.0
const H = 2.5;

const ARTWORKS: ArtworkDef[] = [
  // === 外壁 (20点) ===

  // Back wall — 6点, 間隔9m, facing +y
  art('Art_01', [-23, -19.4, H], '+y'),
  art('Art_02', [-14, -19.4, H], '+y'),
  art('Art_03', [-5, -19.4, H],  '+y'),
  art('Art_04', [5, -19.4, H],   '+y'),
  art('Art_05', [14, -19.4, H],  '+y'),
  art('Art_06', [23, -19.4, H],  '+y'),

  // Front wall — 6点, 間隔9m, facing -y
  art('Art_07', [-23, 19.4, H], '-y'),
  art('Art_08', [-14, 19.4, H], '-y'),
  art('Art_09', [-5, 19.4, H],  '-y'),
  art('Art_10', [5, 19.4, H],   '-y'),
  art('Art_11', [14, 19.4, H],  '-y'),
  art('Art_12', [23, 19.4, H],  '-y'),

  // Left wall — 4点, 間隔8m, facing +x
  art('Art_13', [-29.4, -12, H], '+x'),
  art('Art_14', [-29.4, -4, H],  '+x'),
  art('Art_15', [-29.4, 4, H],   '+x'),
  art('Art_16', [-29.4, 12, H],  '+x'),

  // Right wall — 4点, 間隔8m, facing -x
  art('Art_17', [29.4, -12, H], '-x'),
  art('Art_18', [29.4, -4, H],  '-x'),
  art('Art_19', [29.4, 4, H],   '-x'),
  art('Art_20', [29.4, 12, H],  '-x'),

  // === Spine (12点) ===

  // Left spine inner — 3点, facing +x
  art('Art_21', [-9.65, -5, H],  '+x'),
  art('Art_22', [-9.65, 1.5, H], '+x'),
  art('Art_23', [-9.65, 8, H],   '+x'),

  // Left spine outer — 3点, facing -x
  art('Art_24', [-10.35, -5, H],  '-x'),
  art('Art_25', [-10.35, 1.5, H], '-x'),
  art('Art_26', [-10.35, 8, H],   '-x'),

  // Right spine inner — 3点, facing -x
  art('Art_27', [9.65, -5, H],  '-x'),
  art('Art_28', [9.65, 1.5, H], '-x'),
  art('Art_29', [9.65, 8, H],   '-x'),

  // Right spine outer — 3点, facing +x
  art('Art_30', [10.35, -5, H],  '+x'),
  art('Art_31', [10.35, 1.5, H], '+x'),
  art('Art_32', [10.35, 8, H],   '+x'),
];

export default function TestExhibitPanels(): React.JSX.Element {
  const frameMaterial = useMemo(
    () => new THREE.MeshStandardMaterial(FRAME_MAT),
    []
  );
  const canvasMaterial = useMemo(
    () => new THREE.MeshStandardMaterial(CANVAS_MAT),
    []
  );

  const fw = ART_W + FRAME_BORDER * 2;
  const fh = ART_H + FRAME_BORDER * 2;

  return (
    <group name="concrete-artworks">
      {ARTWORKS.map((a, index) => (
        <group key={a.id} position={a.position} rotation={[0, a.rotY, 0]}>
          {/* フレーム */}
          <mesh material={frameMaterial}>
            <boxGeometry args={[fw, fh, FRAME_DEPTH]} />
          </mesh>
          {/* キャンバス表面 */}
          <mesh position={[0, 0, FRAME_DEPTH / 2 + 0.001]}>
            <planeGeometry args={[ART_W, ART_H]} />
            <meshStandardMaterial
              color={`hsl(${(index * 47) % 360}, 25%, 50%)`}
              roughness={0.6}
              metalness={0}
            />
          </mesh>
          {/* キャンバス背面 */}
          <mesh position={[0, 0, -FRAME_DEPTH / 2 - 0.001]} material={canvasMaterial}>
            <planeGeometry args={[ART_W, ART_H]} />
          </mesh>
        </group>
      ))}
    </group>
  );
}
