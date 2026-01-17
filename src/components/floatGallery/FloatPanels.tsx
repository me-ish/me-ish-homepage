'use client';

import React, { useMemo } from 'react';
import { getPanelGeometry, getPanelMaterial } from './sharedGeometry';

// 定数
const PANEL_HEIGHT = 8;
const PANEL_Y = PANEL_HEIGHT / 2;
const RADIUS = 16;

// パネル角度（45°刻み）
const PANEL_ANGLES = [45, 135, 225, 315];

type PanelData = {
  position: [number, number, number];
  rotation: [number, number, number];
};

export default function FloatPanels(): React.JSX.Element {
  // 共有ジオメトリ・マテリアル
  const panelGeometry = useMemo(() => getPanelGeometry(), []);
  const panelMaterial = useMemo(() => getPanelMaterial(), []);

  // パネル配置データ（メモ化）
  const panels = useMemo<PanelData[]>(() =>
    PANEL_ANGLES.map((deg) => {
      const rad = (deg * Math.PI) / 180;
      return {
        position: [
          Math.cos(rad) * RADIUS,
          PANEL_Y,
          Math.sin(rad) * RADIUS,
        ] as [number, number, number],
        rotation: [0, rad, 0] as [number, number, number],
      };
    }),
    []
  );

  return (
    <group>
      {panels.map((p, i) => (
        <mesh
          key={`panel-${i}`}
          position={p.position}
          rotation={p.rotation}
          geometry={panelGeometry}
          material={panelMaterial}
          receiveShadow
        />
      ))}
    </group>
  );
}
