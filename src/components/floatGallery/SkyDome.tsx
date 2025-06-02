'use client';

import React from 'react';
import { useLoader } from '@react-three/fiber';
import { TextureLoader, BackSide } from 'three';

export default function SkyDome(): JSX.Element {
  const skyTexture = useLoader(TextureLoader, '/textures/sky_day.jpg');

  return (
    <mesh rotation={[0, 0, 0]} position={[0, 0, 0]}>
      <sphereGeometry args={[300, 64, 64, 0, Math.PI * 2, 0, Math.PI / 2]} />
      <meshBasicMaterial map={skyTexture} side={BackSide} />
    </mesh>
  );
}
