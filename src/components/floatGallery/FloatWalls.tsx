'use client';

import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { JSX } from 'react';

export default function FloatWalls(): JSX.Element {
  const wallHeight = 8;
  const wallLength = 35;
  const wallThickness = 1.0;
  const wallY = wallHeight / 2;
  const edge = 40 - wallThickness / 2;

  const materialProps = {
    color: '#eeeeee',
    roughness: 0.9,
    metalness: 0.05,
  };

  const beamCount = 7;
  const spacing = 12.2;
  const startX = -36.5;

  const beamRefs = useRef<(THREE.Mesh | null)[]>(
    Array.from({ length: beamCount }, () => null)
  );

  const wallRefs = useRef<(THREE.Mesh | null)[]>(
    Array.from({ length: 8 }, () => null)
  );

  useFrame(({ camera }) => {
    beamRefs.current.forEach((ref) => {
      if (!ref) return;
      const dist = ref.position.distanceTo(camera.position);
      ref.visible = dist < 60;
    });

    wallRefs.current.forEach((ref) => {
      if (!ref) return;
      const dist = ref.position.distanceTo(camera.position);
      ref.visible = dist < 70;
    });
  });

  return (
    <group>
      {/* 北側 */}
      <mesh ref={(el) => { wallRefs.current[0] = el; }} position={[-22.5, wallY, -edge]}>
        <boxGeometry args={[wallLength, wallHeight, wallThickness]} />
        <meshStandardMaterial {...materialProps} />
      </mesh>
      <mesh ref={(el) => { wallRefs.current[1] = el; }} position={[22.5, wallY, -edge]}>
        <boxGeometry args={[wallLength, wallHeight, wallThickness]} />
        <meshStandardMaterial {...materialProps} />
      </mesh>

      {/* 南側 */}
      <mesh ref={(el) => { wallRefs.current[2] = el; }} position={[-22.5, wallY, edge]}>
        <boxGeometry args={[wallLength, wallHeight, wallThickness]} />
        <meshStandardMaterial {...materialProps} />
      </mesh>
      <mesh ref={(el) => { wallRefs.current[3] = el; }} position={[22.5, wallY, edge]}>
        <boxGeometry args={[wallLength, wallHeight, wallThickness]} />
        <meshStandardMaterial {...materialProps} />
      </mesh>

      {/* 西側 */}
      <mesh ref={(el) => { wallRefs.current[4] = el; }} position={[-edge, wallY, -22.5]}>
        <boxGeometry args={[wallThickness, wallHeight, wallLength]} />
        <meshStandardMaterial {...materialProps} />
      </mesh>
      <mesh ref={(el) => { wallRefs.current[5] = el; }} position={[-edge, wallY, 22.5]}>
        <boxGeometry args={[wallThickness, wallHeight, wallLength]} />
        <meshStandardMaterial {...materialProps} />
      </mesh>

      {/* 東側 */}
      <mesh ref={(el) => { wallRefs.current[6] = el; }} position={[edge, wallY, -22.5]}>
        <boxGeometry args={[wallThickness, wallHeight, wallLength]} />
        <meshStandardMaterial {...materialProps} />
      </mesh>
      <mesh ref={(el) => { wallRefs.current[7] = el; }} position={[edge, wallY, 22.5]}>
        <boxGeometry args={[wallThickness, wallHeight, wallLength]} />
        <meshStandardMaterial {...materialProps} />
      </mesh>

      {/* 床 */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[80, 80]} />
        <meshStandardMaterial color="#dddddd" />
      </mesh>

      {/* 天井梁 */}
      <group>
        {Array.from({ length: beamCount }).map((_, i) => {
          const offset = startX + i * spacing;
          const beamColor = i % 2 === 0 ? '#cccccc' : '#666666';
          return (
            <mesh
              key={`beam-${i}`}
              ref={(el) => { beamRefs.current[i] = el; }}
              position={[offset, 8.5, 0]}
            >
              <boxGeometry args={[7, 1, 80]} />
              <meshStandardMaterial color={beamColor} />
            </mesh>
          );
        })}
      </group>
    </group>
  );
}
