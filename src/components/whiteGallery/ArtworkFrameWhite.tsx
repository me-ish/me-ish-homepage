'use client'

import React, {
  useRef,
  useState,
  forwardRef,
  useImperativeHandle,
  PropsWithChildren,
} from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useSpring } from '@react-spring/three'
import { useZoomArtwork } from '../shared/ZoomArtworkContext'
import { useTexture } from '@react-three/drei'

interface ArtworkData {
  position?: [number, number, number]
  rotation?: [number, number, number]
  aspectRatio?: number
  scale?: number
  title?: string
  author?: string
  imageUrl?: string
  description?: string
  is_for_sale?: boolean
  price?: number | null
  sns_links?: string
  id?: number | null
  created_at?: string | null
  // ▼ 版情報
  edition_mode?: 'limited' | 'unlimited' | null
  edition_total?: number | null
  edition_sold?: number | null
}

interface ArtworkFrameWhiteProps extends PropsWithChildren {
  data: ArtworkData
  avatarRef: React.RefObject<THREE.Object3D>
}

const ArtworkFrameWhite = forwardRef<THREE.Group, ArtworkFrameWhiteProps>(
  ({ data, avatarRef, children }, ref) => {
    const { setZoomedArtwork } = useZoomArtwork()

    const {
      position = [0, 2, 0],
      rotation = [0, 0, 0],
      aspectRatio = 1,
      scale = 1,
      title = 'Untitled',
      author = 'Unknown',
      imageUrl = '',
      description = '',
      is_for_sale = false,
      price = null,
      sns_links = '{}',
      id = null,
      created_at = null,

      // ▼ デフォルトはnullのまま保持
      edition_mode = null,
      edition_total = null,
      edition_sold = 0,
    } = data

    const groupRef = useRef<THREE.Group>(null)

    useImperativeHandle(ref, () => {
      if (!groupRef.current) return null as any
      return { ...groupRef.current, title, author }
    })

    const width = 2.5 * scale
    const height = width / aspectRatio
    const frameDepth = 0.12

    const adjustedRotation: [number, number, number] = [
      rotation[0],
      rotation[1] + Math.PI,
      rotation[2],
    ]

    const texture = useTexture(imageUrl || '/textures/fallback.jpg')
    const frameMatRef = useRef<THREE.MeshStandardMaterial>(null)

    const [springs, api] = useSpring(() => ({
      emissiveIntensity: 0,
      config: { mass: 1, tension: 200, friction: 30 },
    }))

    const [shouldGlow, setShouldGlow] = useState(false)

    useFrame(() => {
      if (!avatarRef.current || !avatarRef.current.position) return
      const artworkPos = new THREE.Vector3(...position)
      const avatarPos = avatarRef.current.position
      const distance = artworkPos.distanceTo(avatarPos)
      api.start({ emissiveIntensity: distance < 7 ? 1.5 : 0 })
      if (frameMatRef.current) {
        frameMatRef.current.emissiveIntensity = springs.emissiveIntensity.get()
      }
    })

    return (
      <group
        ref={groupRef}
        position={position}
        rotation={adjustedRotation}
        onClick={(e) => {
          e.stopPropagation()

          // ▼ Zoom に渡すpayload。版情報を“そのまま”渡し、フォールバック1は絶対入れない
          const total =
            typeof edition_total === 'number' && Number.isFinite(edition_total)
              ? edition_total
              : null
          const sold =
            typeof edition_sold === 'number' && Number.isFinite(edition_sold)
              ? edition_sold
              : 0

          setZoomedArtwork({
            id: String(id ?? ''),
            imageUrl,
            // 必要なら image_url も併せて渡しておくと互換性◎
            image_url: imageUrl as any,

            title,
            author,
            description,
            price: price ?? 0,
            is_for_sale: !!is_for_sale,
            sns_links: sns_links ?? '{}',
            created_at: created_at ?? '',
            is_sold: false,

            // ▼ 版情報
            edition_mode: edition_mode ?? null,
            edition_total: total,
            edition_sold: sold,
          } as any)
        }}
      >
        {/* 絵のパネル */}
        <mesh position={[0, 0, frameDepth / 2 + 0.001]} castShadow>
          <planeGeometry args={[width, height]} />
          <meshBasicMaterial map={texture} toneMapped={false} />
        </mesh>

        {/* 厚みのある白フレーム */}
        <mesh position={[0, 0, -0.02]} castShadow>
          <boxGeometry args={[width + 0.2, height + 0.2, frameDepth]} />
          <meshStandardMaterial
            ref={frameMatRef}
            color="#888888"
            metalness={0.8}
            roughness={0.15}
            emissive="#FFEE88"
          />
        </mesh>

        {/* ラベル（右下） */}
        {children && (
          <group position={[width / 2 + 0.1, -height / 2 - 0.1, 0]}>
            {children}
          </group>
        )}
      </group>
    )
  }
)

export default ArtworkFrameWhite
