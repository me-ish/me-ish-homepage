'use client'

import React from 'react'
import { Plane } from '@react-three/drei'

export default function FloorWhite() {
  return (
    <Plane
      args={[100, 100]} // 床のサイズ（必要なら調整可）
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, 0, 0]} // y=0に設置
      receiveShadow
    >
      {/* 影だけを受け取る専用マテリアル */}
      <shadowMaterial attach="material" opacity={0.2} />
    </Plane>
  )
}
