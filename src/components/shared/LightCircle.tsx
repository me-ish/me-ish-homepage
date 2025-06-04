'use client';

import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { Mesh } from 'three';

type LightCircleProps = {
  radius?: number;
  height?: number;
  color?: string;
};

export default function LightCircle({
  radius = 1.8,
  height = 0.8,
  color = '#aefaff',
}: LightCircleProps) {
  const pillarRef = useRef<Mesh>(null);
  const blurRef = useRef<Mesh>(null);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    const flicker = 0.4 + Math.sin(t * 1.5) * 0.1;

    if (pillarRef.current?.material instanceof THREE.Material) {
      pillarRef.current.material.opacity = flicker;
    }

    if (blurRef.current?.material instanceof THREE.Material) {
      blurRef.current.material.opacity = flicker * 0.5;
      blurRef.current.scale.setScalar(1 + Math.sin(t) * 0.05);
    }
  });

  return (
    <>
      {/* 円柱本体 */}
      <mesh ref={pillarRef} position={[0, height / 2, 0]}>
        <cylinderGeometry args={[radius, radius, height, 32, 1, true]} />
        <meshBasicMaterial
          color={color}
          side={THREE.DoubleSide}
          transparent
          opacity={0.5}
        />
      </mesh>
    </>
  );
}
