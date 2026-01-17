'use client';

import React, { useMemo } from 'react';
import * as THREE from 'three';

/**
 * GalleryLighting - 共有ライティング
 *
 * 個別 pointLight (32個) を 4 つの SpotLight に統合し、
 * GPU 負荷を大幅に削減。
 *
 * 配置:
 * - 4 つの SpotLight が各壁方向を照らす
 * - 中央上部からの ambient 補助
 */

// 壁の配置定数（FloatWalls.tsx と同期）
const WALL_Z = 39;
const WALL_X = 39;
const LIGHT_HEIGHT = 12;
const LIGHT_INSET = 20; // 壁から内側への距離

// SpotLight 共通設定
const SPOTLIGHT_CONFIG = {
  angle: Math.PI / 4,      // 照射角度（45度）
  penumbra: 0.5,           // ぼかし
  intensity: 1.5,          // 強度
  distance: 60,            // 到達距離
  decay: 1.5,              // 減衰
  color: '#fff8f0',        // 暖色系白
};

type WallLight = {
  position: [number, number, number];
  target: [number, number, number];
};

export default function GalleryLighting(): React.JSX.Element {
  // 各壁を照らす SpotLight の配置
  const wallLights = useMemo<WallLight[]>(() => [
    // 北壁（-Z方向）を照らす
    {
      position: [0, LIGHT_HEIGHT, -WALL_Z + LIGHT_INSET],
      target: [0, 3.5, -WALL_Z],
    },
    // 南壁（+Z方向）を照らす
    {
      position: [0, LIGHT_HEIGHT, WALL_Z - LIGHT_INSET],
      target: [0, 3.5, WALL_Z],
    },
    // 西壁（-X方向）を照らす
    {
      position: [-WALL_X + LIGHT_INSET, LIGHT_HEIGHT, 0],
      target: [-WALL_X, 3.5, 0],
    },
    // 東壁（+X方向）を照らす
    {
      position: [WALL_X - LIGHT_INSET, LIGHT_HEIGHT, 0],
      target: [WALL_X, 3.5, 0],
    },
  ], []);

  // 中央パネル用の補助光
  const centerLightPosition: [number, number, number] = [0, 15, 0];

  return (
    <group name="gallery-lighting">
      {/* 壁面照射用 SpotLight x4 */}
      {wallLights.map((light, i) => (
        <spotLight
          key={`wall-light-${i}`}
          position={light.position}
          target-position={light.target}
          angle={SPOTLIGHT_CONFIG.angle}
          penumbra={SPOTLIGHT_CONFIG.penumbra}
          intensity={SPOTLIGHT_CONFIG.intensity}
          distance={SPOTLIGHT_CONFIG.distance}
          decay={SPOTLIGHT_CONFIG.decay}
          color={SPOTLIGHT_CONFIG.color}
        />
      ))}

      {/* 中央パネル用の補助 PointLight（1つだけ） */}
      <pointLight
        position={centerLightPosition}
        intensity={0.8}
        distance={40}
        decay={1.5}
        color="#f0f8ff"
      />
    </group>
  );
}
