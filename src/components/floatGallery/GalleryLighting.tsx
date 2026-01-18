'use client';

import React, { useMemo } from 'react';

/**
 * GalleryLighting - 美術館トラックライト照明システム
 *
 * トラックレール（天井高11.5m付近）に設置されたスポットライトが
 * 壁面の作品を照らす美術館スタイルの照明設計。
 *
 * 構成:
 * - 各壁に向けた SpotLight x4（トラック位置から壁面を照射）
 * - 中央パネル用の SpotLight x4（上から下へ照射）
 * - 全体のフィルライト x1（中央上部）
 */

import { WALL_HEIGHT, GALLERY_EDGE } from './sharedGeometry';

// トラックレールの位置（FloatWalls.tsx と同期）
const TRACK_Y = WALL_HEIGHT - 0.5; // 11.5
const TRACK_OFFSET = GALLERY_EDGE - 8; // 32

// 壁の位置
const WALL_OFFSET = GALLERY_EDGE - 0.2; // 39.8

// 作品の高さ（FloatArtworksInGallery.tsx と同期）
const ARTWORK_Y = 3.5;

// ============================================================
// 壁面照射用スポットライト設定
// ============================================================

const WALL_SPOTLIGHT_CONFIG = {
  angle: Math.PI / 5,        // 36度 - やや広め
  penumbra: 0.5,             // ソフトなエッジ
  intensity: 4.5,            // より明るく
  distance: 30,              // 壁まで届く距離
  decay: 1.2,
  color: '#fff8f0',          // 暖かみのある白（3200K風）
};

type WallLight = {
  position: [number, number, number];
  target: [number, number, number];
};

// 壁面照射ライトの配置
const WALL_LIGHTS: WallLight[] = [
  // 北壁（-Z）を照らす
  { position: [0, TRACK_Y, -TRACK_OFFSET], target: [0, ARTWORK_Y, -WALL_OFFSET] },
  // 南壁（+Z）を照らす
  { position: [0, TRACK_Y, TRACK_OFFSET], target: [0, ARTWORK_Y, WALL_OFFSET] },
  // 西壁（-X）を照らす
  { position: [-TRACK_OFFSET, TRACK_Y, 0], target: [-WALL_OFFSET, ARTWORK_Y, 0] },
  // 東壁（+X）を照らす
  { position: [TRACK_OFFSET, TRACK_Y, 0], target: [WALL_OFFSET, ARTWORK_Y, 0] },
];

// ============================================================
// 中央パネル照射用スポットライト設定
// ============================================================

const CENTER_SPOTLIGHT_CONFIG = {
  angle: Math.PI / 4,        // 45度 - 広め
  penumbra: 0.5,
  intensity: 3.5,            // より明るく
  distance: 25,
  decay: 1.2,
  color: '#fff8f0',
};

// 中央パネルの位置（FloatPanels.tsx と同期）
const PANEL_RADIUS = 16;
const PANEL_Y = 4; // パネル高さ8の中心

// 中央パネル照射ライトの配置（各パネルの上から）
const CENTER_LIGHTS: WallLight[] = [
  {
    position: [Math.cos(Math.PI / 4) * PANEL_RADIUS, TRACK_Y, Math.sin(Math.PI / 4) * PANEL_RADIUS],
    target: [Math.cos(Math.PI / 4) * PANEL_RADIUS, PANEL_Y, Math.sin(Math.PI / 4) * PANEL_RADIUS],
  },
  {
    position: [Math.cos(3 * Math.PI / 4) * PANEL_RADIUS, TRACK_Y, Math.sin(3 * Math.PI / 4) * PANEL_RADIUS],
    target: [Math.cos(3 * Math.PI / 4) * PANEL_RADIUS, PANEL_Y, Math.sin(3 * Math.PI / 4) * PANEL_RADIUS],
  },
  {
    position: [Math.cos(5 * Math.PI / 4) * PANEL_RADIUS, TRACK_Y, Math.sin(5 * Math.PI / 4) * PANEL_RADIUS],
    target: [Math.cos(5 * Math.PI / 4) * PANEL_RADIUS, PANEL_Y, Math.sin(5 * Math.PI / 4) * PANEL_RADIUS],
  },
  {
    position: [Math.cos(7 * Math.PI / 4) * PANEL_RADIUS, TRACK_Y, Math.sin(7 * Math.PI / 4) * PANEL_RADIUS],
    target: [Math.cos(7 * Math.PI / 4) * PANEL_RADIUS, PANEL_Y, Math.sin(7 * Math.PI / 4) * PANEL_RADIUS],
  },
];

// ============================================================
// コンポーネント
// ============================================================

export default function GalleryLighting(): React.JSX.Element {
  // メモ化したライト配置
  const wallLights = useMemo(() => WALL_LIGHTS, []);
  const centerLights = useMemo(() => CENTER_LIGHTS, []);

  return (
    <group name="gallery-lighting">
      {/* ============================================================ */}
      {/* 壁面照射用 SpotLight x4 */}
      {/* ============================================================ */}
      {wallLights.map((light, i) => (
        <spotLight
          key={`wall-light-${i}`}
          position={light.position}
          target-position={light.target}
          angle={WALL_SPOTLIGHT_CONFIG.angle}
          penumbra={WALL_SPOTLIGHT_CONFIG.penumbra}
          intensity={WALL_SPOTLIGHT_CONFIG.intensity}
          distance={WALL_SPOTLIGHT_CONFIG.distance}
          decay={WALL_SPOTLIGHT_CONFIG.decay}
          color={WALL_SPOTLIGHT_CONFIG.color}
        />
      ))}

      {/* ============================================================ */}
      {/* 中央パネル照射用 SpotLight x4 */}
      {/* ============================================================ */}
      {centerLights.map((light, i) => (
        <spotLight
          key={`center-light-${i}`}
          position={light.position}
          target-position={light.target}
          angle={CENTER_SPOTLIGHT_CONFIG.angle}
          penumbra={CENTER_SPOTLIGHT_CONFIG.penumbra}
          intensity={CENTER_SPOTLIGHT_CONFIG.intensity}
          distance={CENTER_SPOTLIGHT_CONFIG.distance}
          decay={CENTER_SPOTLIGHT_CONFIG.decay}
          color={CENTER_SPOTLIGHT_CONFIG.color}
        />
      ))}

      {/* ============================================================ */}
      {/* フィルライト（空間全体の雰囲気補助） */}
      {/* ============================================================ */}
      <pointLight
        position={[0, TRACK_Y - 2, 0]}
        intensity={1.0}
        distance={60}
        decay={1.5}
        color="#f5f5ff"
      />
    </group>
  );
}
