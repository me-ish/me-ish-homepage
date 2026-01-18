'use client';

import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import {
  WALL_HEIGHT,
  WALL_THICKNESS,
  GALLERY_EDGE,
  getWallGeometryH,
  getWallGeometryV,
  getFloorGeometry,
  getFloorAccentGeometry,
  getCeilingGeometry,
  getTrackRailGeometry,
  getPillarGeometry,
  getArchTopGeometry,
  getArchSideGeometry,
  getGlassPanelGeometry,
  getCorniceGeometryH,
  getCorniceGeometryV,
  getBaseboardGeometryH,
  getBaseboardGeometryV,
  getWallMaterial,
  getFloorMaterial,
  getFloorAccentMaterial,
  getCeilingMaterial,
  getTrackRailMaterial,
  getPillarMaterial,
  getArchMaterial,
  getGlassMaterial,
  getCorniceMaterial,
  getBaseboardMaterial,
} from './sharedGeometry';

// ============================================================
// 定数
// ============================================================

const WALL_Y = WALL_HEIGHT / 2;
const EDGE = GALLERY_EDGE - WALL_THICKNESS / 2;
const VISIBLE_DISTANCE = 80;

// コーニス・巾木の高さ位置
const CORNICE_Y = WALL_HEIGHT - 0.2;
const BASEBOARD_Y = 0.125;

// アーチフレームの寸法
const ARCH_FRAME_THICKNESS = 0.8;
const ARCH_SIDE_Y = (WALL_HEIGHT - ARCH_FRAME_THICKNESS) / 2;
const ARCH_TOP_Y = WALL_HEIGHT - ARCH_FRAME_THICKNESS / 2;
const ARCH_SIDE_OFFSET = 5 + ARCH_FRAME_THICKNESS / 2; // 開口幅10の半分 + フレーム厚の半分

// ============================================================
// 壁の位置データ（作品配置に影響しない）
// ============================================================

type WallData = {
  position: [number, number, number];
  type: 'h' | 'v';
};

const WALL_POSITIONS: WallData[] = [
  // 北側（-Z）
  { position: [-22.5, WALL_Y, -EDGE], type: 'h' },
  { position: [22.5, WALL_Y, -EDGE], type: 'h' },
  // 南側（+Z）
  { position: [-22.5, WALL_Y, EDGE], type: 'h' },
  { position: [22.5, WALL_Y, EDGE], type: 'h' },
  // 西側（-X）
  { position: [-EDGE, WALL_Y, -22.5], type: 'v' },
  { position: [-EDGE, WALL_Y, 22.5], type: 'v' },
  // 東側（+X）
  { position: [EDGE, WALL_Y, -22.5], type: 'v' },
  { position: [EDGE, WALL_Y, 22.5], type: 'v' },
];

// ============================================================
// ピラー（角柱）の位置
// ============================================================

const PILLAR_OFFSET = GALLERY_EDGE - 0.75;

const PILLAR_POSITIONS: [number, number, number][] = [
  [-PILLAR_OFFSET, WALL_Y, -PILLAR_OFFSET], // 北西
  [PILLAR_OFFSET, WALL_Y, -PILLAR_OFFSET],  // 北東
  [-PILLAR_OFFSET, WALL_Y, PILLAR_OFFSET],  // 南西
  [PILLAR_OFFSET, WALL_Y, PILLAR_OFFSET],   // 南東
];

// ============================================================
// アーチフレーム（開口部）の位置
// ============================================================

type ArchData = {
  topPosition: [number, number, number];
  leftPosition: [number, number, number];
  rightPosition: [number, number, number];
  rotation: [number, number, number];
};

const ARCH_POSITIONS: ArchData[] = [
  // 北側開口
  {
    topPosition: [0, ARCH_TOP_Y, -EDGE],
    leftPosition: [-ARCH_SIDE_OFFSET, ARCH_SIDE_Y, -EDGE],
    rightPosition: [ARCH_SIDE_OFFSET, ARCH_SIDE_Y, -EDGE],
    rotation: [0, 0, 0],
  },
  // 南側開口
  {
    topPosition: [0, ARCH_TOP_Y, EDGE],
    leftPosition: [-ARCH_SIDE_OFFSET, ARCH_SIDE_Y, EDGE],
    rightPosition: [ARCH_SIDE_OFFSET, ARCH_SIDE_Y, EDGE],
    rotation: [0, 0, 0],
  },
  // 西側開口
  {
    topPosition: [-EDGE, ARCH_TOP_Y, 0],
    leftPosition: [-EDGE, ARCH_SIDE_Y, -ARCH_SIDE_OFFSET],
    rightPosition: [-EDGE, ARCH_SIDE_Y, ARCH_SIDE_OFFSET],
    rotation: [0, Math.PI / 2, 0],
  },
  // 東側開口
  {
    topPosition: [EDGE, ARCH_TOP_Y, 0],
    leftPosition: [EDGE, ARCH_SIDE_Y, -ARCH_SIDE_OFFSET],
    rightPosition: [EDGE, ARCH_SIDE_Y, ARCH_SIDE_OFFSET],
    rotation: [0, Math.PI / 2, 0],
  },
];

// ============================================================
// ガラスパネル（開口部を塞ぐ）の位置
// ============================================================

const GLASS_Y = WALL_HEIGHT / 2;

type GlassData = {
  position: [number, number, number];
  rotation: [number, number, number];
};

const GLASS_POSITIONS: GlassData[] = [
  // 北側ガラス
  { position: [0, GLASS_Y, -EDGE], rotation: [0, 0, 0] },
  // 南側ガラス
  { position: [0, GLASS_Y, EDGE], rotation: [0, 0, 0] },
  // 西側ガラス
  { position: [-EDGE, GLASS_Y, 0], rotation: [0, Math.PI / 2, 0] },
  // 東側ガラス
  { position: [EDGE, GLASS_Y, 0], rotation: [0, Math.PI / 2, 0] },
];

// ============================================================
// トラックレールの位置（壁に平行、天井付近）
// ============================================================

const TRACK_Y = WALL_HEIGHT - 0.5;
const TRACK_OFFSET = GALLERY_EDGE - 8; // 壁から8m内側

type TrackData = {
  position: [number, number, number];
  rotation: [number, number, number];
};

const TRACK_POSITIONS: TrackData[] = [
  // 北側レール
  { position: [0, TRACK_Y, -TRACK_OFFSET], rotation: [0, 0, 0] },
  // 南側レール
  { position: [0, TRACK_Y, TRACK_OFFSET], rotation: [0, 0, 0] },
  // 西側レール
  { position: [-TRACK_OFFSET, TRACK_Y, 0], rotation: [0, Math.PI / 2, 0] },
  // 東側レール
  { position: [TRACK_OFFSET, TRACK_Y, 0], rotation: [0, Math.PI / 2, 0] },
];

// ============================================================
// コンポーネント
// ============================================================

export default function FloatWalls(): React.JSX.Element {
  const groupRef = useRef<THREE.Group>(null);

  // 共有ジオメトリ取得
  const wallGeometryH = useMemo(() => getWallGeometryH(), []);
  const wallGeometryV = useMemo(() => getWallGeometryV(), []);
  const floorGeometry = useMemo(() => getFloorGeometry(), []);
  const floorAccentGeometry = useMemo(() => getFloorAccentGeometry(), []);
  const ceilingGeometry = useMemo(() => getCeilingGeometry(), []);
  const trackRailGeometry = useMemo(() => getTrackRailGeometry(), []);
  const pillarGeometry = useMemo(() => getPillarGeometry(), []);
  const archTopGeometry = useMemo(() => getArchTopGeometry(), []);
  const archSideGeometry = useMemo(() => getArchSideGeometry(), []);
  const glassPanelGeometry = useMemo(() => getGlassPanelGeometry(), []);
  const corniceGeometryH = useMemo(() => getCorniceGeometryH(), []);
  const corniceGeometryV = useMemo(() => getCorniceGeometryV(), []);
  const baseboardGeometryH = useMemo(() => getBaseboardGeometryH(), []);
  const baseboardGeometryV = useMemo(() => getBaseboardGeometryV(), []);

  // 共有マテリアル取得
  const wallMaterial = useMemo(() => getWallMaterial(), []);
  const floorMaterial = useMemo(() => getFloorMaterial(), []);
  const floorAccentMaterial = useMemo(() => getFloorAccentMaterial(), []);
  const ceilingMaterial = useMemo(() => getCeilingMaterial(), []);
  const trackRailMaterial = useMemo(() => getTrackRailMaterial(), []);
  const pillarMaterial = useMemo(() => getPillarMaterial(), []);
  const archMaterial = useMemo(() => getArchMaterial(), []);
  const glassMaterial = useMemo(() => getGlassMaterial(), []);
  const corniceMaterial = useMemo(() => getCorniceMaterial(), []);
  const baseboardMaterial = useMemo(() => getBaseboardMaterial(), []);

  // 可視性制御
  useFrame(({ camera }) => {
    if (!groupRef.current) return;
    const dist = camera.position.length();
    groupRef.current.visible = dist < VISIBLE_DISTANCE;
  });

  return (
    <group ref={groupRef}>
      {/* ============================================================ */}
      {/* 床 */}
      {/* ============================================================ */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0, 0]}
        geometry={floorGeometry}
        material={floorMaterial}
        receiveShadow
      />

      {/* 床中央のリングアクセント */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0.01, 0]}
        geometry={floorAccentGeometry}
        material={floorAccentMaterial}
        receiveShadow
      />

      {/* ============================================================ */}
      {/* 天井 */}
      {/* ============================================================ */}
      <mesh
        rotation={[Math.PI / 2, 0, 0]}
        position={[0, WALL_HEIGHT, 0]}
        geometry={ceilingGeometry}
        material={ceilingMaterial}
      />

      {/* ============================================================ */}
      {/* トラックレール */}
      {/* ============================================================ */}
      {TRACK_POSITIONS.map((track, i) => (
        <mesh
          key={`track-${i}`}
          position={track.position}
          rotation={track.rotation}
          geometry={trackRailGeometry}
          material={trackRailMaterial}
        />
      ))}

      {/* ============================================================ */}
      {/* 壁 */}
      {/* ============================================================ */}
      {WALL_POSITIONS.map((wall, i) => (
        <mesh
          key={`wall-${i}`}
          position={wall.position}
          geometry={wall.type === 'h' ? wallGeometryH : wallGeometryV}
          material={wallMaterial}
          receiveShadow
          castShadow
        />
      ))}

      {/* ============================================================ */}
      {/* コーニス（廻り縁） */}
      {/* ============================================================ */}
      {WALL_POSITIONS.map((wall, i) => (
        <mesh
          key={`cornice-${i}`}
          position={[wall.position[0], CORNICE_Y, wall.position[2]]}
          geometry={wall.type === 'h' ? corniceGeometryH : corniceGeometryV}
          material={corniceMaterial}
        />
      ))}

      {/* ============================================================ */}
      {/* 巾木 */}
      {/* ============================================================ */}
      {WALL_POSITIONS.map((wall, i) => (
        <mesh
          key={`baseboard-${i}`}
          position={[wall.position[0], BASEBOARD_Y, wall.position[2]]}
          geometry={wall.type === 'h' ? baseboardGeometryH : baseboardGeometryV}
          material={baseboardMaterial}
        />
      ))}

      {/* ============================================================ */}
      {/* ピラー（角柱） */}
      {/* ============================================================ */}
      {PILLAR_POSITIONS.map((pos, i) => (
        <mesh
          key={`pillar-${i}`}
          position={pos}
          geometry={pillarGeometry}
          material={pillarMaterial}
          receiveShadow
          castShadow
        />
      ))}

      {/* ============================================================ */}
      {/* アーチフレーム（開口部の枠） */}
      {/* ============================================================ */}
      {ARCH_POSITIONS.map((arch, i) => (
        <group key={`arch-${i}`}>
          {/* 上部横梁 */}
          <mesh
            position={arch.topPosition}
            rotation={arch.rotation}
            geometry={archTopGeometry}
            material={archMaterial}
          />
          {/* 左側縦枠 */}
          <mesh
            position={arch.leftPosition}
            rotation={arch.rotation}
            geometry={archSideGeometry}
            material={archMaterial}
          />
          {/* 右側縦枠 */}
          <mesh
            position={arch.rightPosition}
            rotation={arch.rotation}
            geometry={archSideGeometry}
            material={archMaterial}
          />
        </group>
      ))}

      {/* ============================================================ */}
      {/* ガラスパネル（開口部を塞ぐフロストガラス） */}
      {/* ============================================================ */}
      {GLASS_POSITIONS.map((glass, i) => (
        <mesh
          key={`glass-${i}`}
          position={glass.position}
          rotation={glass.rotation}
          geometry={glassPanelGeometry}
          material={glassMaterial}
        />
      ))}
    </group>
  );
}
