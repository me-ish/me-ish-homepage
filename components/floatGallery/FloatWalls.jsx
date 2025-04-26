import React, { useRef } from 'react'
import { useFrame } from '@react-three/fiber'

export default function FloatWalls() {
  const wallHeight = 8
  const wallLength = 35
  const wallThickness = 1.0
  const wallY = wallHeight / 2
  const edge = 40 - wallThickness / 2 // ぴったり配置補正

  const materialProps = {
    color: '#eeeeee',
    roughness: 0.9,
    metalness: 0.05,
  }

  // 天井梁の設定
  const beamCount = 7
  const spacing = 12.2
  const startX = -36.5
  const beamRefs = useRef([...Array(beamCount)].map(() => React.createRef()))

  // 壁8枚のrefを生成
  const wallRefs = useRef([...Array(8)].map(() => React.createRef()))

  // 距離カリング処理
  useFrame(({ camera }) => {
    beamRefs.current.forEach((ref) => {
      if (!ref.current) return
      const dist = ref.current.position.distanceTo(camera.position)
      ref.current.visible = dist < 60
    })

    wallRefs.current.forEach((ref) => {
      if (!ref.current) return
      const dist = ref.current.position.distanceTo(camera.position)
      ref.current.visible = dist < 70
    })
  })

  return (
    <group>
      {/* 北側（上辺） */}
      <mesh ref={wallRefs.current[0]} position={[-22.5, wallY, -edge]}>
        <boxGeometry args={[wallLength, wallHeight, wallThickness]} />
        <meshStandardMaterial {...materialProps} />
      </mesh>
      <mesh ref={wallRefs.current[1]} position={[22.5, wallY, -edge]}>
        <boxGeometry args={[wallLength, wallHeight, wallThickness]} />
        <meshStandardMaterial {...materialProps} />
      </mesh>

      {/* 南側（下辺） */}
      <mesh ref={wallRefs.current[2]} position={[-22.5, wallY, edge]}>
        <boxGeometry args={[wallLength, wallHeight, wallThickness]} />
        <meshStandardMaterial {...materialProps} />
      </mesh>
      <mesh ref={wallRefs.current[3]} position={[22.5, wallY, edge]}>
        <boxGeometry args={[wallLength, wallHeight, wallThickness]} />
        <meshStandardMaterial {...materialProps} />
      </mesh>

      {/* 西側（左辺） */}
      <mesh ref={wallRefs.current[4]} position={[-edge, wallY, -22.5]}>
        <boxGeometry args={[wallThickness, wallHeight, wallLength]} />
        <meshStandardMaterial {...materialProps} />
      </mesh>
      <mesh ref={wallRefs.current[5]} position={[-edge, wallY, 22.5]}>
        <boxGeometry args={[wallThickness, wallHeight, wallLength]} />
        <meshStandardMaterial {...materialProps} />
      </mesh>

      {/* 東側（右辺） */}
      <mesh ref={wallRefs.current[6]} position={[edge, wallY, -22.5]}>
        <boxGeometry args={[wallThickness, wallHeight, wallLength]} />
        <meshStandardMaterial {...materialProps} />
      </mesh>
      <mesh ref={wallRefs.current[7]} position={[edge, wallY, 22.5]}>
        <boxGeometry args={[wallThickness, wallHeight, wallLength]} />
        <meshStandardMaterial {...materialProps} />
      </mesh>

      {/* 床 */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[80, 80]} />
        <meshStandardMaterial color="#dddddd" />
      </mesh>

      {/* 天井梁（交互色 + 距離カリング） */}
      <group>
        {Array.from({ length: beamCount }).map((_, i) => {
          const offset = startX + i * spacing
          const beamColor = i % 2 === 0 ? '#cccccc' : '#666666'
          return (
            <mesh
              key={`beam-${i}`}
              ref={beamRefs.current[i]}
              position={[offset, 8.5, 0]}
            >
              <boxGeometry args={[7, 1, 80]} />
              <meshStandardMaterial color={beamColor} />
            </mesh>
          )
        })}
      </group>
    </group>
  )
}
