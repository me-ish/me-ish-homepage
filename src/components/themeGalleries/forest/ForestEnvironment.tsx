'use client';

import { useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';

/**
 * ConcreteEnvironment - コンクリートギャラリーのライティング
 *
 * - 暖色系アンビエントライト（自然光イメージ）
 * - メインの太陽光
 * - 天井付近の2つのポイントライト（エリアライト代替）
 */

const BACKGROUND_COLOR = '#3a3632';

// JSON: ambient sun intensity 2.0, color #FFF9F0
const AMBIENT_COLOR = '#FFF9F0';
const AMBIENT_INTENSITY = 0.6;

const SUN_COLOR = '#FFF9F0';
const SUN_INTENSITY = 1.5;
const SUN_POSITION: [number, number, number] = [10, 20, -5];

// JSON area_lights → PointLight近似
// position [-7, 0, 4.4] → Three.js [-7, 4.4, 0]
// position [7, 0, 4.4] → Three.js [7, 4.4, 0]
const AREA_LIGHTS: { position: [number, number, number]; intensity: number }[] = [
  { position: [-7, 4.4, 0], intensity: 80 },
  { position: [7, 4.4, 0], intensity: 80 },
];

export default function ConcreteEnvironment(): React.JSX.Element {
  const { scene } = useThree();

  useEffect(() => {
    scene.background = new THREE.Color(BACKGROUND_COLOR);
    scene.fog = null;
    return () => {
      scene.background = null;
    };
  }, [scene]);

  return (
    <group name="concrete-environment">
      <ambientLight color={AMBIENT_COLOR} intensity={AMBIENT_INTENSITY} />

      <directionalLight
        color={SUN_COLOR}
        intensity={SUN_INTENSITY}
        position={SUN_POSITION}
        castShadow={false}
      />

      <hemisphereLight
        color="#FFF9F0"
        groundColor="#736E66"
        intensity={0.4}
      />

      {AREA_LIGHTS.map((light, i) => (
        <pointLight
          key={i}
          color="#FFF9F0"
          intensity={light.intensity}
          position={light.position}
          distance={15}
          decay={2}
        />
      ))}
    </group>
  );
}
