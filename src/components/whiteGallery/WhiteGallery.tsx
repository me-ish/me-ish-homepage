'use client';

import React, { useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import Lightning from './Lightning';
import ArtworksInGallery from './ArtworksInGallery';
import CoreSphere from '@/components/shared/CoreSphere';
import Avatar from '@/components/shared/Avatar';
import AvatarController from '@/components/shared/AvatarController';
import ThirdPersonCamera from '@/components/shared/ThirdPersonCamera';
import LightCircle from '@/components/shared/LightCircle';
import FloorWhite from './FloorWhite';

export default function WhiteGallery(): JSX.Element {
  const avatarRef = useRef<THREE.Group>(null);

  return (
    <div style={{ width: '100vw', height: '100vh' }}>
      <Canvas
        shadows // ← 影を有効化
        style={{ width: '100%', height: '100%' }}
        camera={{ position: [0, 5, 15], fov: 60 }}
      >
        <Lightning />
        <LightCircle />
        <CoreSphere avatarRef={avatarRef} />
        <ArtworksInGallery avatarRef={avatarRef} />
        <Avatar ref={avatarRef} />
        <AvatarController avatarRef={avatarRef} />
        <ThirdPersonCamera avatarRef={avatarRef} />
        <FloorWhite />
      </Canvas>
    </div>
  );
}
