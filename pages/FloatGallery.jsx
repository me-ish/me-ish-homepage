import React, { useRef, useState, useEffect } from 'react'
import { Canvas } from '@react-three/fiber'
import * as THREE from 'three'
import { SRGBColorSpace } from 'three'
import FloatGallery from '../components/floatGallery/FloatGallery'

import { ZoomArtworkProvider } from '../components/shared/ZoomArtworkContext'
import ZoomArtworkDisplay from '../components/shared/ZoomArtworkDisplay'

import FloatArtworksInGallery from '../components/floatGallery/FloatArtworksInGallery'
import FloatPanelArtworks from '../components/floatGallery/FloatPanelArtworks'
import { CoreSphere } from '../components/shared/CoreSphere'
import Avatar from '../components/shared/Avatar'
import AvatarController from '../components/shared/AvatarController'
import ThirdPersonCamera from '../components/shared/ThirdPersonCamera'
import JoystickInput from '../components/shared/JoystickInput'
import LightCircle from '../components/shared/LightCircle'
import SkyDome from '../components/floatGallery/SkyDome'
import OceanPlane from '../components/floatGallery/OceanPlane'
import ArtworkLabel from '../components/floatGallery/ArtworkLabelFloat'

export default function GalleryFloat() {
  const avatarRef = useRef()
  const artworkRefs = useRef([])
  const [joystick, setJoystick] = useState({ x: 0, y: 0 })
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setReady(true), 100)
    return () => clearTimeout(timer)
  }, [])

  return (
    <>
      <JoystickInput onMove={({ x, y }) => setJoystick({ x, y })} />

      <ZoomArtworkProvider>
        <Canvas
          style={{ background: '#00ffff' }}
          camera={{ position: [0, 2, 10], fov: 50 }}
          gl={{ physicallyCorrectLights: true }}
          onCreated={({ gl }) => {
            gl.outputColorSpace = SRGBColorSpace
            gl.toneMapping = THREE.NoToneMapping
          }}
        >
          {/* 🌞 照明 */}
          <SkyDome />
          <OceanPlane />
          <ambientLight intensity={1} />
          <directionalLight position={[0, 10, 5]} intensity={1} castShadow />

          {/* 🌀 メイン構成 */}
          <FloatGallery />
          <CoreSphere avatarRef={avatarRef} />
          <LightCircle />
          <FloatArtworksInGallery avatarRef={avatarRef} artworkRefs={artworkRefs} />
          <FloatPanelArtworks avatarRef={avatarRef} artworkRefs={artworkRefs} />

          {/* 🧍 アバターと移動 */}
          <Avatar ref={avatarRef} />
          <AvatarController avatarRef={avatarRef} joystick={joystick} />
          <ThirdPersonCamera avatarRef={avatarRef} artworkRefs={artworkRefs} />

          {/* 🏷 ラベル表示（rotationに応じた正面位置） */}
          {ready &&
            artworkRefs.current.map((ref, i) => {
              if (!ref?.position || !ref?.rotation) return null

              const pos = ref.position
              const rot = ref.rotation
              const title = ref.title
              const author = ref.author

              // 正面方向ベクトル（Z+）を作品の向きに適用
              const forward = new THREE.Vector3(0, 0, 1).applyEuler(rot).multiplyScalar(1.2)
              const labelPos = [
                pos.x + forward.x,
                pos.y + 0.6,
                pos.z + forward.z
              ]

              return (
                <ArtworkLabel
                  key={`label-${i}`}
                  position={labelPos}
                  rotation={[rot.x, rot.y, rot.z]}
                  width={2.5}
                  height={2}
                  avatarRef={avatarRef}
                  title={title}
                  author={author}
                />
              )
            })}
        </Canvas>

        <ZoomArtworkDisplay />
      </ZoomArtworkProvider>
    </>
  )
}