'use client'

import { useRef, forwardRef, useImperativeHandle } from 'react'
import { useFrame, extend } from '@react-three/fiber'
import * as THREE from 'three'
import { a, useSpring } from '@react-spring/three'
import { Text } from '@react-three/drei'
import { HologramMaterial } from './HologramMaterial'

extend({ HologramMaterial })

interface ArtworkLabelWhiteProps {
  avatarRef: React.RefObject<THREE.Object3D>
  title?: string
  author?: string
  labelOffset?: [number, number, number]
}

const ArtworkLabelWhite = forwardRef<THREE.Group, ArtworkLabelWhiteProps>(
  ({ avatarRef, title = 'Untitled', author = 'Unknown', labelOffset = [1.0, 0.5, 0] }, ref) => {
    const groupRef = useRef<THREE.Group>(null)
    const materialRef = useRef<any>(null)

    useImperativeHandle(ref, () => groupRef.current as THREE.Group)

    const [{ scale }, api] = useSpring(() => ({
      scale: 0,
      config: { mass: 1, tension: 200, friction: 30 },
    }))

    useFrame(({ clock }) => {
      if (groupRef.current) {
        groupRef.current.lookAt(new THREE.Vector3(0, groupRef.current.position.y, 0))
      }
      if (materialRef.current?.uniforms?.time) {
        materialRef.current.uniforms.time.value = clock.getElapsedTime()
      }

      if (avatarRef?.current && groupRef.current) {
        const worldPos = new THREE.Vector3()
        groupRef.current.getWorldPosition(worldPos)
        const dist = avatarRef.current.position.distanceTo(worldPos)
        api.start({ scale: dist < 7 ? 1 : 0 })
      }
    })

    return (
      <a.group
        ref={groupRef}
        position={scale.to((s) => [
          labelOffset[0],
          labelOffset[1],
          labelOffset[2] + (1 - s) * 2 + 0.5,
        ])}
        scale={scale.to((s) => [s, s, s])}
      >
        {/* 背景パネル */}
        <mesh position={[0, 0, -0.015]}>
          <planeGeometry args={[1.5, 1]} />
          {/* @ts-ignore */}
          <hologramMaterial
            ref={materialRef}
            transparent
            depthWrite={false}
            blending={THREE.AdditiveBlending}
            toneMapped={false}
          />
        </mesh>

        {/* テキスト */}
        <Text
          font="/fonts/subset-ZenMaruGothic-Regular.woff"
          fontSize={0.22}
          color="#000000"
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.015}
          outlineColor="#ffffff"
          position={[0, 0, 0.01]}
          maxWidth={1.4}
          textAlign="center"
        >
          {title + '\nby ' + author}
        </Text>
      </a.group>
    )
  }
)

ArtworkLabelWhite.displayName = 'ArtworkLabelWhite'
export default ArtworkLabelWhite
