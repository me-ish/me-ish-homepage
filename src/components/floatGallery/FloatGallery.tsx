'use client';

import React, { useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import * as THREE from 'three';

import DayLight from './DayLight';
import FloatArtworksInGallery from './FloatArtworksInGallery';
import FloatPanelArtworks from './FloatPanelArtworks';
import FloatPanelsCenter from './FloatPanelsCenter';
import FloatWalls from './FloatWalls';
import OceanPlane from './OceanPlane';
import SkyDome from './SkyDome';

import Avatar from '@/components/shared/Avatar';
import AvatarController from '@/components/shared/AvatarController';
import ThirdPersonCamera from '@/components/shared/ThirdPersonCamera';
import ZoomArtworkDisplay from '@/components/shared/ZoomArtworkDisplay';
import CoreSphere from '@/components/shared/CoreSphere';
import LightCircle from '@/components/shared/LightCircle';

export default function FloatGallery(): React.JSX.Element {
  const avatarRef = useRef<THREE.Group>(null);
  const artworkRefs = useRef<(THREE.Group | null)[]>([]); // ← ラベルなどとの連携用

  return (
    <div style={{ width: '100vw', height: '100vh' }}>
      <Canvas
        style={{ width: '100%', height: '100%' }}
        camera={{ position: [0, 5, 15], fov: 60 }}
        shadows
      >
        {/* コア */}
        <CoreSphere avatarRef={avatarRef} />
        <LightCircle />

        {/* 光・背景 */}
        <DayLight />
        <OceanPlane />
        <SkyDome />

        {/* 壁・中央パネル */}
        <FloatWalls />
        <FloatPanelsCenter />

        {/* アートワーク配置 */}
        <FloatArtworksInGallery avatarRef={avatarRef} artworkRefs={artworkRefs} />
        <FloatPanelArtworks avatarRef={avatarRef} artworkRefs={artworkRefs} />

        {/* アバター操作 */}
        <Avatar ref={avatarRef} />
        <AvatarController avatarRef={avatarRef} />
        <ThirdPersonCamera avatarRef={avatarRef} />
      </Canvas>

      {/* 拡大表示 */}
      <ZoomArtworkDisplay />
    </div>
  );
}
