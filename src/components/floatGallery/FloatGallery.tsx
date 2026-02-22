'use client';

import React, { Suspense, useRef, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import * as THREE from 'three';

import ConcreteBuilding from '@/components/themeGalleries/forest/ForestGround';
import ConcreteEnvironment from '@/components/themeGalleries/forest/ForestEnvironment';
import ConcreteLightSlits from '@/components/themeGalleries/forest/ForestParticles';

import FloatArtworksInGallery from './FloatArtworksInGallery';
import FloatPanelArtworks from './FloatPanelArtworks';

import Avatar from '@/components/shared/Avatar';
import ConcreteAvatarController from '@/components/themeGalleries/forest/ConcreteAvatarController';
import ThirdPersonCamera from '@/components/shared/ThirdPersonCamera';
import ZoomArtworkDisplay from '@/components/shared/ZoomArtworkDisplay';
import CoreSphere from '@/components/shared/CoreSphere';
import LightCircle from '@/components/shared/LightCircle';
import JoystickInput from '@/components/shared/JoystickInput';
import { useIsMobile } from '@/lib/useIsMobile';
import { GalleryIntroModal } from '@/components/shared/GalleryIntroModal';
import { OperationHintButton } from '@/components/shared/OperationHintButton';
import AIGuideChat from '@/components/shared/AIGuideChat';

type Props = {
  /** /float?date=YYYY-MM-DD（未指定なら下流で今日扱いにフォールバック） */
  dateStr?: string;
};

export default function FloatGallery({ dateStr }: Props): React.JSX.Element {
  const avatarRef = useRef<THREE.Group>(null);
  const artworkRefs = useRef<(THREE.Group | null)[]>([]);
  const joystickRef = useRef({ x: 0, y: 0 });
  const isMobile = useIsMobile();
  const coreSpherePos: [number, number, number] = [0, 5, 0];
  const lightBasePos: [number, number, number] = [coreSpherePos[0], 0, coreSpherePos[2]];

  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    const originalTouchAction = document.body.style.touchAction;
    document.body.style.overflow = 'hidden';
    document.body.style.touchAction = 'none';
    return () => {
      document.body.style.overflow = originalOverflow;
      document.body.style.touchAction = originalTouchAction;
    };
  }, []);

  return (
    <div style={{ width: '100vw', height: '100vh' }} onContextMenu={(e) => e.preventDefault()}>
      <GalleryIntroModal />
      <OperationHintButton />
      {isMobile && (
        <JoystickInput
          onMove={({ x, y }) => {
            joystickRef.current = { x, y };
          }}
        />
      )}
      <Canvas
        style={{ width: '100%', height: '100%' }}
        camera={{ position: [0, 5, 15], fov: 60, near: 0.1, far: 300 }}
        gl={{
          antialias: !isMobile,
          powerPreference: 'high-performance',
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.0,
        }}
        dpr={isMobile ? 1 : [1, 2]}
        tabIndex={0}
        onPointerDown={(e) => e.currentTarget.focus()}
      >
        <Suspense fallback={null}>
          <ConcreteEnvironment />
          <ConcreteBuilding />
          <ConcreteLightSlits />
        </Suspense>

        <CoreSphere avatarRef={avatarRef} position={coreSpherePos} />
        <LightCircle position={lightBasePos} />

        {/* 壁面（外壁24枚） */}
        <FloatArtworksInGallery
          avatarRef={avatarRef}
          artworkRefs={artworkRefs}
          dateStr={dateStr}
        />

        {/* Spineパーティション面（8枚） */}
        <FloatPanelArtworks avatarRef={avatarRef} artworkRefs={artworkRefs} dateStr={dateStr} />

        <Avatar ref={avatarRef} />
        <ConcreteAvatarController avatarRef={avatarRef} joystickRef={joystickRef} />
        <ThirdPersonCamera avatarRef={avatarRef} />
      </Canvas>

      <ZoomArtworkDisplay />
      <AIGuideChat />
    </div>
  );
}
