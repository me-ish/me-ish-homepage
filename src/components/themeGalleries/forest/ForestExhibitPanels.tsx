'use client';

import { useMemo } from 'react';
import * as THREE from 'three';

/**
 * ConcreteArtworks v2 — 40点のアートワーク
 *
 * サイズ 2m×1.5m（大型絵画）。フレーム深さ0.06m、枠幅0.05m。
 * 外壁24点 + コの字Spine両面16点。
 */

const FRAME_MAT = { color: '#1F1F1F', roughness: 0.25, metalness: 0.85 };
const CANVAS_MAT = { color: '#E0D9CC', roughness: 0.65, metalness: 0 };

// facing → Y軸回転
// PlaneGeometry default normal = +Z
const FACING_ROT: Record<string, number> = {
  '+y': Math.PI,
  '-y': 0,
  '+x': -Math.PI / 2,
  '-x': Math.PI / 2,
};

type ArtworkDef = {
  id: string;
  position: [number, number, number]; // R3F
  rotY: number;
  width: number;
  height: number;
  frameDepth: number;
  frameBorder: number;
};

function b2r(p: [number, number, number]): [number, number, number] {
  return [p[0], p[2], -p[1]];
}

function art(id: string, pos: [number, number, number], facing: string): ArtworkDef {
  return {
    id,
    position: b2r(pos),
    rotY: FACING_ROT[facing],
    width: 2.0,
    height: 1.5,
    frameDepth: 0.06,
    frameBorder: 0.05,
  };
}

const ARTWORKS: ArtworkDef[] = [
  // Back wall (7) — facing +y
  art('Art_01', [-22.5, -19.4, 2.2], '+y'),
  art('Art_02', [-15.0, -19.4, 2.2], '+y'),
  art('Art_03', [-7.5, -19.4, 2.2], '+y'),
  art('Art_04', [0.0, -19.4, 2.2], '+y'),
  art('Art_05', [7.5, -19.4, 2.2], '+y'),
  art('Art_06', [15.0, -19.4, 2.2], '+y'),
  art('Art_07', [22.5, -19.4, 2.2], '+y'),
  // Front wall (7) — facing -y
  art('Art_08', [-22.5, 19.4, 2.2], '-y'),
  art('Art_09', [-15.0, 19.4, 2.2], '-y'),
  art('Art_10', [-7.5, 19.4, 2.2], '-y'),
  art('Art_11', [0.0, 19.4, 2.2], '-y'),
  art('Art_12', [7.5, 19.4, 2.2], '-y'),
  art('Art_13', [15.0, 19.4, 2.2], '-y'),
  art('Art_14', [22.5, 19.4, 2.2], '-y'),
  // Left wall (5) — facing +x
  art('Art_15', [-29.4, -14.0, 2.2], '+x'),
  art('Art_16', [-29.4, -7.0, 2.2], '+x'),
  art('Art_17', [-29.4, 0.0, 2.2], '+x'),
  art('Art_18', [-29.4, 7.0, 2.2], '+x'),
  art('Art_19', [-29.4, 14.0, 2.2], '+x'),
  // Right wall (5) — facing -x
  art('Art_20', [29.4, -14.0, 2.2], '-x'),
  art('Art_21', [29.4, -7.0, 2.2], '-x'),
  art('Art_22', [29.4, 0.0, 2.2], '-x'),
  art('Art_23', [29.4, 7.0, 2.2], '-x'),
  art('Art_24', [29.4, 14.0, 2.2], '-x'),
  // Left Spine inner (4) — facing +x
  art('Art_25', [-9.65, -6.0, 2.2], '+x'),
  art('Art_26', [-9.65, -0.5, 2.2], '+x'),
  art('Art_27', [-9.65, 5.0, 2.2], '+x'),
  art('Art_28', [-9.65, 10.5, 2.2], '+x'),
  // Left Spine outer (4) — facing -x
  art('Art_29', [-10.35, -6.0, 2.2], '-x'),
  art('Art_30', [-10.35, -0.5, 2.2], '-x'),
  art('Art_31', [-10.35, 5.0, 2.2], '-x'),
  art('Art_32', [-10.35, 10.5, 2.2], '-x'),
  // Right Spine inner (4) — facing -x
  art('Art_33', [9.65, -6.0, 2.2], '-x'),
  art('Art_34', [9.65, -0.5, 2.2], '-x'),
  art('Art_35', [9.65, 5.0, 2.2], '-x'),
  art('Art_36', [9.65, 10.5, 2.2], '-x'),
  // Right Spine outer (4) — facing +x
  art('Art_37', [10.35, -6.0, 2.2], '+x'),
  art('Art_38', [10.35, -0.5, 2.2], '+x'),
  art('Art_39', [10.35, 5.0, 2.2], '+x'),
  art('Art_40', [10.35, 10.5, 2.2], '+x'),
];

export default function ConcreteArtworks(): React.JSX.Element {
  const frameMaterial = useMemo(
    () => new THREE.MeshStandardMaterial(FRAME_MAT),
    []
  );
  const canvasMaterial = useMemo(
    () => new THREE.MeshStandardMaterial(CANVAS_MAT),
    []
  );

  return (
    <group name="concrete-artworks">
      {ARTWORKS.map((a, index) => {
        const fw = a.width + a.frameBorder * 2;
        const fh = a.height + a.frameBorder * 2;

        return (
          <group key={a.id} position={a.position} rotation={[0, a.rotY, 0]}>
            {/* フレーム */}
            <mesh material={frameMaterial}>
              <boxGeometry args={[fw, fh, a.frameDepth]} />
            </mesh>
            {/* キャンバス表面 */}
            <mesh position={[0, 0, a.frameDepth / 2 + 0.001]}>
              <planeGeometry args={[a.width, a.height]} />
              <meshStandardMaterial
                color={`hsl(${(index * 47) % 360}, 25%, 50%)`}
                roughness={0.6}
                metalness={0}
              />
            </mesh>
            {/* キャンバス背面 */}
            <mesh position={[0, 0, -a.frameDepth / 2 - 0.001]} material={canvasMaterial}>
              <planeGeometry args={[a.width, a.height]} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}
