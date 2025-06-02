'use client';

import React from 'react';
import * as THREE from 'three';

export default function FloatPanels(): JSX.Element {
  const panelWidth = 18;
  const panelHeight = 8;
  const panelThickness = 1.0;
  const panelY = panelHeight / 2;
  const radius = 16;

  const materialProps = {
    color: '#cccccc',
    roughness: 0.85,
    metalness: 0.05,
  };

  const angles = [45, 135, 225, 315];
  const panels = angles.map((deg) => {
    const rad = (deg * Math.PI) / 180;
    const x = Math.cos(rad) * radius;
    const z = Math.sin(rad) * radius;
    return {
      position: [x, panelY, z] as [number, number, number],
      rotation: [0, rad, 0] as [number, number, number],
    };
  });

  return (
    <group>
      {panels.map((p, i) => (
        <mesh key={i} position={p.position} rotation={p.rotation}>
          <boxGeometry args={[panelWidth, panelHeight, panelThickness]} />
          <meshStandardMaterial {...materialProps} />
        </mesh>
      ))}
    </group>
  );
}
