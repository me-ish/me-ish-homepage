import React, { useRef, useState, forwardRef, useImperativeHandle } from 'react'
import { useFrame, useLoader } from '@react-three/fiber'
import * as THREE from 'three'
import { TextureLoader } from 'three'
import { a, useSpring } from '@react-spring/three'
import { useZoomArtwork } from './ZoomArtworkContext'

const ArtworkFrame = forwardRef(function ArtworkFrame({
  position = [0, 2, 0],
  rotation = [0, 0, 0],
  aspectRatio = 1,
  scale = 1,
  title = 'Untitled',
  author = 'Unknown',
  imageUrl = '',
  avatarRef,
}, ref) {
  const { setZoomedArtwork } = useZoomArtwork()

  const groupRef = useRef()
  useImperativeHandle(ref, () => {
    if (!groupRef.current) return null
    return {
      ...groupRef.current,
      title,
      author,
    }
  })

  const width = 2.5 * scale
  const height = width / aspectRatio

  const adjustedRotation = [
    rotation[0],
    rotation[1] + Math.PI,
    rotation[2],
  ]

  const texture = useLoader(TextureLoader, imageUrl)

  const [springs, api] = useSpring(() => ({
    emissiveIntensity: 0,
    config: { mass: 1, tension: 200, friction: 30 },
  }))

  const [shouldGlow, setShouldGlow] = useState(false)

  useFrame(() => {
    if (!avatarRef?.current) return

    const artworkPos = new THREE.Vector3(...position)
    const avatarPos = avatarRef.current.position
    const distance = artworkPos.distanceTo(avatarPos)

    api.start({
      emissiveIntensity: distance < 7 ? 1.5 : 0,
    })

    if (distance < 7 && !shouldGlow) {
      setShouldGlow(true)
      setTimeout(() => setShouldGlow(false), 1200)
    }
  })

  return (
    <group
      ref={groupRef}
      position={position}
      rotation={adjustedRotation}
      onClick={(e) => {
        e.stopPropagation()
        setZoomedArtwork({ imageUrl, title, author, width, height })
      }}
    >
      {/* 絵の板 */}
      <mesh>
        <planeGeometry args={[width, height]} />
        <meshBasicMaterial map={texture} toneMapped={false} />
      </mesh>

      {/* フレーム（発光） */}
      <a.mesh position={[0, 0, -0.01]}>
        <planeGeometry args={[width + 0.1, height + 0.1]} />
        <a.meshStandardMaterial
          color="#000000"
          emissive="#ffeeaa"
          emissiveIntensity={springs.emissiveIntensity}
          side={THREE.DoubleSide}
        />
      </a.mesh>
    </group>
  )
})

export default ArtworkFrame
