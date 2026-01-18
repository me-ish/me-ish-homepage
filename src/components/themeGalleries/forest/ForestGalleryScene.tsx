'use client';

import React, { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';

import ForestEnvironment from './ForestEnvironment';
import ForestGround from './ForestGround';
import ForestParticles from './ForestParticles';
import ForestExhibitPanels from './ForestExhibitPanels';

/**
 * ForestGalleryScene - 森テーマギャラリーのメインシーン
 *
 * Canvas内のシーン構築を担当。
 * コントローラーは分離されており、将来的にアバター制御に差し替え可能。
 */

// カメラ設定
const CAMERA_INITIAL_POSITION: [number, number, number] = [0, 3, 12];
const CAMERA_FOV = 60;

// OrbitControls設定
const CONTROLS_CONFIG = {
  enableDamping: true,
  dampingFactor: 0.05,
  minDistance: 3,
  maxDistance: 60,
  maxPolarAngle: Math.PI * 0.85, // 地面より下を見ないように
  minPolarAngle: Math.PI * 0.1,  // 真上を見ないように
};

type ForestGallerySceneProps = {
  className?: string;
};

// シーン内部コンポーネント（Canvas内で使用）
function ForestSceneContent(): React.JSX.Element {
  return (
    <>
      {/* 環境（フォグ・ライティング） */}
      <ForestEnvironment />

      {/* 地面 */}
      <ForestGround />

      {/* 浮遊パーティクル */}
      <ForestParticles />

      {/* 展示パネル */}
      <ForestExhibitPanels />

      {/* カメラコントロール（暫定：OrbitControls） */}
      {/* 将来的にアバター制御に差し替える場合はここを変更 */}
      <OrbitControls
        enableDamping={CONTROLS_CONFIG.enableDamping}
        dampingFactor={CONTROLS_CONFIG.dampingFactor}
        minDistance={CONTROLS_CONFIG.minDistance}
        maxDistance={CONTROLS_CONFIG.maxDistance}
        maxPolarAngle={CONTROLS_CONFIG.maxPolarAngle}
        minPolarAngle={CONTROLS_CONFIG.minPolarAngle}
        target={[0, 1.5, 0]}
      />
    </>
  );
}

export default function ForestGalleryScene({
  className,
}: ForestGallerySceneProps): React.JSX.Element {
  return (
    <div className={className} style={{ width: '100%', height: '100%' }}>
      <Canvas
        camera={{
          position: CAMERA_INITIAL_POSITION,
          fov: CAMERA_FOV,
          near: 0.1,
          far: 500,
        }}
        gl={{
          antialias: true,
          alpha: false,
          powerPreference: 'high-performance',
        }}
        dpr={[1, 2]}
      >
        <Suspense fallback={null}>
          <ForestSceneContent />
        </Suspense>
      </Canvas>
    </div>
  );
}
