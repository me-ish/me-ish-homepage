'use client';

import React, { useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import * as THREE from 'three';

import DayLight from './DayLight';
import GalleryLighting from './GalleryLighting';
import FloatArtworksInGallery from './FloatArtworksInGallery';
import FloatPanelArtworks from './FloatPanelArtworks';
import FloatPanelsCenter from './FloatPanelsCenter';
import FloatWalls from './FloatWalls';
import FloatOutsideWorld from './FloatOutsideWorld';

import Avatar from '@/components/shared/Avatar';
import FloatAvatarController from '@/components/floatGallery/FloatAvatarController';
import ThirdPersonCamera from '@/components/shared/ThirdPersonCamera';
import ZoomArtworkDisplay from '@/components/shared/ZoomArtworkDisplay';
import CoreSphere from '@/components/shared/CoreSphere';
import LightCircle from '@/components/shared/LightCircle';

type Props = {
  /** /float?date=YYYY-MM-DD（未指定なら下流で今日扱いにフォールバック） */
  dateStr?: string;
};

export default function FloatGallery({ dateStr }: Props): React.JSX.Element {
  const avatarRef = useRef<THREE.Group>(null);
  const artworkRefs = useRef<(THREE.Group | null)[]>([]);
  const joystickRef = useRef({ x: 0, y: 0 });

  return (
    <div style={{ width: '100vw', height: '100vh' }}>
      <Canvas
        style={{ width: '100%', height: '100%' }}
        camera={{ position: [0, 5, 15], fov: 60 }}
        shadows
      >
        <FloatOutsideWorld />

        <CoreSphere avatarRef={avatarRef} />
        <LightCircle />

        <DayLight />
        <GalleryLighting />

        <FloatWalls />
        <FloatPanelsCenter />

        {/* 壁面（外壁24枚） */}
        <FloatArtworksInGallery
          avatarRef={avatarRef}
          artworkRefs={artworkRefs}
          dateStr={dateStr}
        />

        {/* 中央パネル（別ロジックならそのまま） */}
        <FloatPanelArtworks avatarRef={avatarRef} artworkRefs={artworkRefs} />

        <Avatar ref={avatarRef} />
        <FloatAvatarController avatarRef={avatarRef} joystickRef={joystickRef} />
        <ThirdPersonCamera avatarRef={avatarRef} />
      </Canvas>

      <ZoomArtworkDisplay />
    </div>
  );
}
