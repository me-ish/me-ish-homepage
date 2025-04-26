import React, { useRef, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import * as THREE from 'three'
import { SRGBColorSpace } from 'three'

import { ZoomArtworkProvider } from '../components/shared/ZoomArtworkContext'
import ZoomArtworkDisplay from '../components/shared/ZoomArtworkDisplay'

import ArtworksInGallery from '../components/whiteGallery/ArtworksInGallery'
import { CoreSphere } from '../components/shared/CoreSphere'
import Avatar from '../components/shared/Avatar'
import AvatarController from '../components/shared/AvatarController'
import ThirdPersonCamera from '../components/shared/ThirdPersonCamera'
import JoystickInput from '../components/shared/JoystickInput'
import LightCircle from '../components/shared/LightCircle'
import Lightning from '../components/whiteGallery/Lightning'

export default function GalleryWhite() {
  const avatarRef = useRef()
  const artworkRefs = useRef([]) // ✅ 追加
  const [joystick, setJoystick] = useState({ x: 0, y: 0 })

  return (
    <>
      <JoystickInput onMove={({ x, y }) => setJoystick({ x, y })} />

      <ZoomArtworkProvider>
        <Canvas
          style={{ background: '#fdfdfd' }}
          camera={{ position: [0, 2, 10], fov: 50 }}
          gl={{ physicallyCorrectLights: true }}
          onCreated={({ gl }) => {
            gl.outputColorSpace = SRGBColorSpace
            gl.toneMapping = THREE.NoToneMapping
          }}
        >
          {/* 🌞 照明 */}
          <ambientLight intensity={1} />
          <directionalLight position={[0, 10, 5]} intensity={1} castShadow />

          {/* 🌀 メイン構成 */}
          <CoreSphere avatarRef={avatarRef} />
          <LightCircle />
          <ArtworksInGallery avatarRef={avatarRef} artworkRefs={artworkRefs} />


          {/* 🧍 アバターと移動 */}
          <Avatar ref={avatarRef} />
          <AvatarController avatarRef={avatarRef} joystick={joystick} />
          <ThirdPersonCamera avatarRef={avatarRef} artworkRefs={artworkRefs} />

          {/* 🌀 その他 */}
          <Lightning />
        </Canvas>
        <ZoomArtworkDisplay />
      </ZoomArtworkProvider>

    </>
  )
}
