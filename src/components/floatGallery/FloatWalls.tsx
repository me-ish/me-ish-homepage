'use client';

import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import {
  WALL_HEIGHT,
  WALL_THICKNESS,
  getWallGeometryH,
  getWallGeometryV,
  getFloorGeometry,
  getBeamGeometry,
  getWallMaterial,
  getFloorMaterial,
  getBeamMaterialLight,
  getBeamMaterialDark,
} from './sharedGeometry';

// 定数
const WALL_Y = WALL_HEIGHT / 2;
const EDGE = 40 - WALL_THICKNESS / 2;
const BEAM_COUNT = 7;
const BEAM_SPACING = 12.2;
const BEAM_START_X = -36.5;
const VISIBLE_DISTANCE_BEAM = 60;
const VISIBLE_DISTANCE_WALL = 70;

// 壁の位置データ
type WallData = {
  position: [number, number, number];
  type: 'h' | 'v'; // horizontal or vertical
};

const WALL_POSITIONS: WallData[] = [
  // 北側
  { position: [-22.5, WALL_Y, -EDGE], type: 'h' },
  { position: [22.5, WALL_Y, -EDGE], type: 'h' },
  // 南側
  { position: [-22.5, WALL_Y, EDGE], type: 'h' },
  { position: [22.5, WALL_Y, EDGE], type: 'h' },
  // 西側
  { position: [-EDGE, WALL_Y, -22.5], type: 'v' },
  { position: [-EDGE, WALL_Y, 22.5], type: 'v' },
  // 東側
  { position: [EDGE, WALL_Y, -22.5], type: 'v' },
  { position: [EDGE, WALL_Y, 22.5], type: 'v' },
];

export default function FloatWalls(): React.JSX.Element {
  const beamRefs = useRef<(THREE.Mesh | null)[]>([]);
  const wallRefs = useRef<(THREE.Mesh | null)[]>([]);

  // 共有ジオメトリ・マテリアル取得
  const wallGeometryH = useMemo(() => getWallGeometryH(), []);
  const wallGeometryV = useMemo(() => getWallGeometryV(), []);
  const floorGeometry = useMemo(() => getFloorGeometry(), []);
  const beamGeometry = useMemo(() => getBeamGeometry(), []);
  const wallMaterial = useMemo(() => getWallMaterial(), []);
  const floorMaterial = useMemo(() => getFloorMaterial(), []);
  const beamMaterialLight = useMemo(() => getBeamMaterialLight(), []);
  const beamMaterialDark = useMemo(() => getBeamMaterialDark(), []);

  // 梁の位置を事前計算
  const beamPositions = useMemo(() =>
    Array.from({ length: BEAM_COUNT }, (_, i) => BEAM_START_X + i * BEAM_SPACING),
    []
  );

  useFrame(({ camera }) => {
    // 梁の可視性制御
    beamRefs.current.forEach((ref) => {
      if (!ref) return;
      const dist = ref.position.distanceTo(camera.position);
      ref.visible = dist < VISIBLE_DISTANCE_BEAM;
    });

    // 壁の可視性制御
    wallRefs.current.forEach((ref) => {
      if (!ref) return;
      const dist = ref.position.distanceTo(camera.position);
      ref.visible = dist < VISIBLE_DISTANCE_WALL;
    });
  });

  return (
    <group>
      {/* 壁（共有ジオメトリ・マテリアル使用） */}
      {WALL_POSITIONS.map((wall, i) => (
        <mesh
          key={`wall-${i}`}
          ref={(el) => { wallRefs.current[i] = el; }}
          position={wall.position}
          geometry={wall.type === 'h' ? wallGeometryH : wallGeometryV}
          material={wallMaterial}
          receiveShadow
          castShadow
        />
      ))}

      {/* 床 */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0, 0]}
        geometry={floorGeometry}
        material={floorMaterial}
        receiveShadow
        castShadow
      />

      {/* 天井梁 */}
      <group>
        {beamPositions.map((offset, i) => (
          <mesh
            key={`beam-${i}`}
            ref={(el) => { beamRefs.current[i] = el; }}
            position={[offset, 20.5, 0]}
            geometry={beamGeometry}
            material={i % 2 === 0 ? beamMaterialLight : beamMaterialDark}
            castShadow
            receiveShadow
          />
        ))}
      </group>
    </group>
  );
}
