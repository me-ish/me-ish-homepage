'use client';

import React from 'react';
import { useLoader } from '@react-three/fiber';
import { TextureLoader, RepeatWrapping } from 'three';

export default function OceanPlane(): JSX.Element {
  const oceanTexture = useLoader(TextureLoader, '/textures/ocean.jpg');
  oceanTexture.wrapS = oceanTexture.wrapT = RepeatWrapping;
  oceanTexture.repeat.set(10, 10);

  return (
    <mesh position={[0, -0.5, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <circleGeometry args={[300, 64]} />
      <meshStandardMaterial map={oceanTexture} />
    </mesh>
  );
}
