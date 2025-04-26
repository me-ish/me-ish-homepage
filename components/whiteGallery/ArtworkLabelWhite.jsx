// src/components/whiteGallery/ArtworkLabelWhite.jsx
import { useRef, forwardRef, useImperativeHandle } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { a } from '@react-spring/three'
import { useSpring } from '@react-spring/three'
import { Text } from '@react-three/drei'
import './HologramMaterial' // ★自作シェーダー

const ArtworkLabelWhite = forwardRef(function ArtworkLabelWhite(
  { position = [0, 2, 0], rotation = [0, 0, 0], width = 2.5, height = 2, avatarRef, title = 'Untitled', author = 'Unknown' },
  ref
) {
  const groupRef = useRef()
  const materialRef = useRef()

  useImperativeHandle(ref, () => groupRef.current ?? null)

  const offset = new THREE.Vector3(width / 3 - 3.5, -height / 3 - 0.2, 0)
  offset.applyEuler(new THREE.Euler(...rotation))
  const labelPos = [position[0] + offset.x, position[1] + offset.y, position[2] + offset.z]

  const [{ opacity, scale }, api] = useSpring(() => ({
    opacity: 0,
    scale: 0,
    config: { mass: 1, tension: 220, friction: 22 },
  }))

  useFrame(({ clock }) => {
    if (groupRef.current) {
      const center = new THREE.Vector3(0, labelPos[1], 0)
      groupRef.current.lookAt(center)
    }

    if (materialRef.current) {
      materialRef.current.time = clock.getElapsedTime()
    }

    if (avatarRef?.current) {
      const dist = avatarRef.current.position.distanceTo(new THREE.Vector3(...labelPos))
      const near = dist < 7

      api.start({
        opacity: near ? 1 : 0,
        scale: near ? 1 : 0,
      })
    }
  })

  return (
    <a.group
      ref={groupRef}
      position={scale.to((s) => [
        labelPos[0],
        labelPos[1],
        (1 - s) * 2 + labelPos[2] + 0.5 // ★中心から飛び出す演出に統一
      ])}
      rotation={[0, Math.PI, 0]}
      scale={scale.to((s) => [s, s, s])}
    >

      {/* --- 液晶ホログラムパネル（後ろ） --- */}
      <mesh position={[0, 0, -0.015]}>
        <planeGeometry args={[1.3, 1]} />
        <hologramMaterial
          ref={materialRef}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </mesh>

      {/* --- テキスト --- */}
      <Text
        font="/fonts/subset-ZenMaruGothic-Regular.woff"
        fontSize={0.2}
        color="#003344"
        anchorX="center"
        anchorY="middle"
        maxWidth={2}
        textAlign="center"
        outlineWidth={0.03}
        outlineColor="#ffffff"
        position={[0, 0, 0.01]}
      >
        {title + '\nby ' + author}
      </Text>

    </a.group>
  )
})

export default ArtworkLabelWhite
