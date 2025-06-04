'use client';

import React from 'react';
import FloatWalls from './FloatWalls';
import FloatPanels from './FloatPanels';

export default function FloatPanelsCenter(): JSX.Element {
  return (
    <group>
      {/* 床 */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[80, 80]} />
        <meshStandardMaterial color="#dcdcdc" />
      </mesh>

      {/* 壁と中央パネル */}
      <FloatWalls />
      <FloatPanels />
    </group>
  );
}

