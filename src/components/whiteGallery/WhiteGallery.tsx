'use client';

import React, { useRef, useEffect } from 'react';
import * as THREE from 'three';
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

  useEffect(() => {
    // ギャラリー表示時にスクロール・スワイプを無効化
    const originalOverflow = document.body.style.overflow;
    const originalTouchAction = document.body.style.touchAction;

    document.body.style.overflow = 'hidden';
    document.body.style.touchAction = 'none';

    return () => {
      // ギャラリー離脱時に元に戻す
      document.body.style.overflow = originalOverflow;
      document.body.style.touchAction = originalTouchAction;
    };
  }, []);

  return (
    <div style={{ width: '100vw', height: '100vh' }}>
      <Canvas
        shadows
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
