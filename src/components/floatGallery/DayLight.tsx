'use client';

import React from 'react';

export default function DayLight(): React.JSX.Element {
  return (
    <>
      <ambientLight intensity={0.7} />
      <directionalLight
        position={[30, 100, 20]}
        intensity={1}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
      />
    </>
  );
}
