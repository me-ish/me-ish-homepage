'use client';

import React, { Suspense } from 'react';
import * as THREE from 'three';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';

import ConcreteEnvironment from './ForestEnvironment';
import ConcreteBuilding from './ForestGround';
import ConcreteLightSlits from './ForestParticles';
import ConcreteArtworks from './ForestExhibitPanels';

/**
 * ConcreteGalleryScene - 安藤忠雄スタイルのコンクリートギャラリー
 *
 * 30m × 20m の建物に36点のアートワークを展示。
 * U字型パーティションと天井スリット光が特徴。
 */

const CAMERA_INITIAL_POSITION: [number, number, number] = [0, 1.6, -8];
const CAMERA_FOV = 60;

const CONTROLS_CONFIG = {
  enableDamping: true,
  dampingFactor: 0.08,
  minDistance: 1,
  maxDistance: 25,
  maxPolarAngle: Math.PI * 0.85,
  minPolarAngle: Math.PI * 0.15,
};

type Props = {
  className?: string;
};

function SceneContent(): React.JSX.Element {
  return (
    <>
      <ConcreteEnvironment />
      <ConcreteBuilding />
      <ConcreteLightSlits />
      <ConcreteArtworks />
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

export default function ForestGalleryScene({ className }: Props): React.JSX.Element {
  return (
    <div className={className} style={{ width: '100%', height: '100%' }} onContextMenu={(e) => e.preventDefault()}>
      <Canvas
        camera={{
          position: CAMERA_INITIAL_POSITION,
          fov: CAMERA_FOV,
          near: 0.1,
          far: 200,
        }}
        gl={{
          antialias: true,
          alpha: false,
          powerPreference: 'high-performance',
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.0,
        }}
        dpr={[1, 2]}
      >
        <Suspense fallback={null}>
          <SceneContent />
        </Suspense>
      </Canvas>
    </div>
  );
}
