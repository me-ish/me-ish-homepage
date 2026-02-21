'use client';

import { useMemo } from 'react';
import * as THREE from 'three';

/**
 * ConcreteArtworks - 36点のアートワーク展示
 *
 * JSON gallery_structure.json のアートワーク配置を再現。
 * フレーム付きキャンバスを壁面・パーティションに配置。
 */

// マテリアル定義
const FRAME_MAT = { color: '#262626', roughness: 0.3, metalness: 0.8 };
const CANVAS_MAT = { color: '#DAD1C7', roughness: 0.7, metalness: 0 };

// facing → Y軸回転角度
// PlaneGeometryのデフォルト法線は+z方向
// Blender "+y" → Three.js -z → π回転
// Blender "-y" → Three.js +z → 回転なし
// Blender "+x" → Three.js +x → -π/2回転
// Blender "-x" → Three.js -x → π/2回転
const FACING_ROT: Record<string, number> = {
  '+y': Math.PI,
  '-y': 0,
  '+x': -Math.PI / 2,
  '-x': Math.PI / 2,
};

type ArtworkDef = {
  id: string;
  position: [number, number, number]; // Three.js座標
  rotY: number;
  width: number;
  height: number;
  frameDepth: number;
  frameBorder: number;
};

// Blender→Three.js変換: [bx, by, bz] → [bx, bz, -by]
function b2r(p: [number, number, number]): [number, number, number] {
  return [p[0], p[2], -p[1]];
}

// JSONから変換済みアートワークデータ
const ARTWORKS: ArtworkDef[] = [
  // 背面壁（facing +y）
  { id: 'Art_01', position: b2r([-11.0, -9.55, 1.5]), rotY: FACING_ROT['+y'], width: 1.2, height: 0.9, frameDepth: 0.05, frameBorder: 0.04 },
  { id: 'Art_02', position: b2r([-5.5, -9.55, 1.5]), rotY: FACING_ROT['+y'], width: 1.2, height: 0.9, frameDepth: 0.05, frameBorder: 0.04 },
  { id: 'Art_03', position: b2r([0.0, -9.55, 1.5]), rotY: FACING_ROT['+y'], width: 1.2, height: 0.9, frameDepth: 0.05, frameBorder: 0.04 },
  { id: 'Art_04', position: b2r([5.5, -9.55, 1.5]), rotY: FACING_ROT['+y'], width: 1.2, height: 0.9, frameDepth: 0.05, frameBorder: 0.04 },
  { id: 'Art_05', position: b2r([11.0, -9.55, 1.5]), rotY: FACING_ROT['+y'], width: 1.2, height: 0.9, frameDepth: 0.05, frameBorder: 0.04 },
  // 正面壁（facing -y）
  { id: 'Art_06', position: b2r([-11.0, 9.55, 1.5]), rotY: FACING_ROT['-y'], width: 1.2, height: 0.9, frameDepth: 0.05, frameBorder: 0.04 },
  { id: 'Art_07', position: b2r([-5.5, 9.55, 1.5]), rotY: FACING_ROT['-y'], width: 1.2, height: 0.9, frameDepth: 0.05, frameBorder: 0.04 },
  { id: 'Art_08', position: b2r([0.0, 9.55, 1.5]), rotY: FACING_ROT['-y'], width: 1.2, height: 0.9, frameDepth: 0.05, frameBorder: 0.04 },
  { id: 'Art_09', position: b2r([5.5, 9.55, 1.5]), rotY: FACING_ROT['-y'], width: 1.2, height: 0.9, frameDepth: 0.05, frameBorder: 0.04 },
  { id: 'Art_10', position: b2r([11.0, 9.55, 1.5]), rotY: FACING_ROT['-y'], width: 1.2, height: 0.9, frameDepth: 0.05, frameBorder: 0.04 },
  // 左壁（facing +x）
  { id: 'Art_11', position: b2r([-14.55, -5.0, 1.5]), rotY: FACING_ROT['+x'], width: 1.2, height: 0.9, frameDepth: 0.05, frameBorder: 0.04 },
  { id: 'Art_12', position: b2r([-14.55, 0.0, 1.5]), rotY: FACING_ROT['+x'], width: 1.2, height: 0.9, frameDepth: 0.05, frameBorder: 0.04 },
  { id: 'Art_13', position: b2r([-14.55, 5.0, 1.5]), rotY: FACING_ROT['+x'], width: 1.2, height: 0.9, frameDepth: 0.05, frameBorder: 0.04 },
  // 右壁（facing -x）
  { id: 'Art_14', position: b2r([14.55, -5.0, 1.5]), rotY: FACING_ROT['-x'], width: 1.2, height: 0.9, frameDepth: 0.05, frameBorder: 0.04 },
  { id: 'Art_15', position: b2r([14.55, 0.0, 1.5]), rotY: FACING_ROT['-x'], width: 1.2, height: 0.9, frameDepth: 0.05, frameBorder: 0.04 },
  { id: 'Art_16', position: b2r([14.55, 5.0, 1.5]), rotY: FACING_ROT['-x'], width: 1.2, height: 0.9, frameDepth: 0.05, frameBorder: 0.04 },
  // 左Uパーティション内側（spine facing +x）
  { id: 'Art_17', position: b2r([-4.75, -3.0, 1.5]), rotY: FACING_ROT['+x'], width: 1.2, height: 0.9, frameDepth: 0.05, frameBorder: 0.04 },
  { id: 'Art_18', position: b2r([-4.75, 0.5, 1.5]), rotY: FACING_ROT['+x'], width: 1.2, height: 0.9, frameDepth: 0.05, frameBorder: 0.04 },
  { id: 'Art_19', position: b2r([-4.75, 4.0, 1.5]), rotY: FACING_ROT['+x'], width: 1.2, height: 0.9, frameDepth: 0.05, frameBorder: 0.04 },
  // 左U上腕内側（facing -y）
  { id: 'Art_20', position: b2r([-8.0, 5.25, 1.5]), rotY: FACING_ROT['-y'], width: 1.2, height: 0.9, frameDepth: 0.05, frameBorder: 0.04 },
  // 左U下腕内側（facing +y）
  { id: 'Art_21', position: b2r([-8.0, -4.75, 1.5]), rotY: FACING_ROT['+y'], width: 1.2, height: 0.9, frameDepth: 0.05, frameBorder: 0.04 },
  // 左Uパーティション外側（spine facing -x）
  { id: 'Art_22', position: b2r([-5.25, -3.0, 1.5]), rotY: FACING_ROT['-x'], width: 1.2, height: 0.9, frameDepth: 0.05, frameBorder: 0.04 },
  { id: 'Art_23', position: b2r([-5.25, 0.5, 1.5]), rotY: FACING_ROT['-x'], width: 1.2, height: 0.9, frameDepth: 0.05, frameBorder: 0.04 },
  { id: 'Art_24', position: b2r([-5.25, 4.0, 1.5]), rotY: FACING_ROT['-x'], width: 1.2, height: 0.9, frameDepth: 0.05, frameBorder: 0.04 },
  // 左U上腕外側（facing +y）
  { id: 'Art_25', position: b2r([-8.0, 5.75, 1.5]), rotY: FACING_ROT['+y'], width: 1.2, height: 0.9, frameDepth: 0.05, frameBorder: 0.04 },
  // 左U下腕外側（facing -y）
  { id: 'Art_26', position: b2r([-8.0, -5.25, 1.5]), rotY: FACING_ROT['-y'], width: 1.2, height: 0.9, frameDepth: 0.05, frameBorder: 0.04 },
  // 右Uパーティション内側（spine facing -x）
  { id: 'Art_27', position: b2r([4.75, -3.0, 1.5]), rotY: FACING_ROT['-x'], width: 1.2, height: 0.9, frameDepth: 0.05, frameBorder: 0.04 },
  { id: 'Art_28', position: b2r([4.75, 0.5, 1.5]), rotY: FACING_ROT['-x'], width: 1.2, height: 0.9, frameDepth: 0.05, frameBorder: 0.04 },
  { id: 'Art_29', position: b2r([4.75, 4.0, 1.5]), rotY: FACING_ROT['-x'], width: 1.2, height: 0.9, frameDepth: 0.05, frameBorder: 0.04 },
  // 右U上腕内側（facing -y）
  { id: 'Art_30', position: b2r([8.0, 5.25, 1.5]), rotY: FACING_ROT['-y'], width: 1.2, height: 0.9, frameDepth: 0.05, frameBorder: 0.04 },
  // 右U下腕内側（facing +y）
  { id: 'Art_31', position: b2r([8.0, -4.75, 1.5]), rotY: FACING_ROT['+y'], width: 1.2, height: 0.9, frameDepth: 0.05, frameBorder: 0.04 },
  // 右Uパーティション外側（spine facing +x）
  { id: 'Art_32', position: b2r([5.25, -3.0, 1.5]), rotY: FACING_ROT['+x'], width: 1.2, height: 0.9, frameDepth: 0.05, frameBorder: 0.04 },
  { id: 'Art_33', position: b2r([5.25, 0.5, 1.5]), rotY: FACING_ROT['+x'], width: 1.2, height: 0.9, frameDepth: 0.05, frameBorder: 0.04 },
  { id: 'Art_34', position: b2r([5.25, 4.0, 1.5]), rotY: FACING_ROT['+x'], width: 1.2, height: 0.9, frameDepth: 0.05, frameBorder: 0.04 },
  // 右U上腕外側（facing +y）
  { id: 'Art_35', position: b2r([8.0, 5.75, 1.5]), rotY: FACING_ROT['+y'], width: 1.2, height: 0.9, frameDepth: 0.05, frameBorder: 0.04 },
  // 右U下腕外側（facing -y）
  { id: 'Art_36', position: b2r([8.0, -5.25, 1.5]), rotY: FACING_ROT['-y'], width: 1.2, height: 0.9, frameDepth: 0.05, frameBorder: 0.04 },
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
      {ARTWORKS.map((art, index) => {
        const fw = art.width + art.frameBorder * 2;
        const fh = art.height + art.frameBorder * 2;

        return (
          <group key={art.id} position={art.position} rotation={[0, art.rotY, 0]}>
            {/* フレーム（額縁） */}
            <mesh material={frameMaterial}>
              <boxGeometry args={[fw, fh, art.frameDepth]} />
            </mesh>

            {/* キャンバス（ダミーカラー） */}
            <mesh position={[0, 0, art.frameDepth / 2 + 0.001]}>
              <planeGeometry args={[art.width, art.height]} />
              <meshStandardMaterial
                color={`hsl(${(index * 47) % 360}, 30%, 45%)`}
                roughness={0.6}
                metalness={0}
              />
            </mesh>

            {/* キャンバス背面 */}
            <mesh position={[0, 0, -art.frameDepth / 2 - 0.001]} material={canvasMaterial}>
              <planeGeometry args={[art.width, art.height]} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}
