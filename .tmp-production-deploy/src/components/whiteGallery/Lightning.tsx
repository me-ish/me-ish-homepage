'use client'

import React from 'react'

export default function Lighting() {
  return (
    <>
      {/* やわらかい全体光 */}
      <ambientLight intensity={0.3} />

      {/* 🎯 中央のコア位置から全方向に照らす光源 */}
      <pointLight
        position={[0, 10, 0]} 
        intensity={2.5}
        distance={50}
        decay={2}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
      />
    </>
  )
}
