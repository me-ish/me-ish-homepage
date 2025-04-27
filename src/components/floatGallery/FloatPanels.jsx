import React from 'react'

export default function FloatPanels() {
  const panelWidth = 18           // 横幅そのまま
  const panelHeight = 8           // ← 高さアップ
  const panelThickness = 1.0      // ← 厚みも増量
  const panelY = panelHeight / 2
  const radius = 16               // ← より外側へ

  const materialProps = {
    color: '#cccccc',
    roughness: 0.85,
    metalness: 0.05,
  }

  const angles = [45, 135, 225, 315]
  const panels = angles.map((deg) => {
    const rad = (deg * Math.PI) / 180
    return {
      position: [
        Math.cos(rad) * radius,
        panelY,
        Math.sin(rad) * radius,
      ],
      rotation: [0, rad, 0],
    }
  })

  return (
    <group>
      {panels.map((p, i) => (
        <mesh key={i} position={p.position} rotation={p.rotation}>
          <boxGeometry args={[panelWidth, panelHeight, panelThickness]} />
          <meshStandardMaterial {...materialProps} />
        </mesh>
      ))}
    </group>
  )
}
