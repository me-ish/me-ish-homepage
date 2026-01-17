'use client';

import React from 'react';
import FloatPanels from './FloatPanels';

export default function FloatPanelsCenter(): JSX.Element {
  // 床は FloatWalls.tsx で描画済み（重複回避）
  return (
    <group>
      <FloatPanels />
    </group>
  );
}
