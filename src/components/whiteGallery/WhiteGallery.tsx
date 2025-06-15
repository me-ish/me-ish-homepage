'use client';

import React, { useRef, useEffect, useState } from 'react';
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
import JoystickInput from '@/components/shared/JoystickInput';
import { useIsMobile } from '@/lib/useIsMobile';
import { GalleryIntroModal } from '@/components/shared/GalleryIntroModal';
import { OperationHintButton } from '@/components/shared/OperationHintButton';
import AIGuideChat from '@/components/shared/AIGuideChat';

export default function WhiteGallery(): JSX.Element {
  const avatarRef = useRef<THREE.Group>(null);
  const isMobile = useIsMobile();
  const joystickRef = useRef({ x: 0, y: 0 });
  const [chatOpen, setChatOpen] = useState(false);

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
    <div style={{ width: '100vw', height: '100vh' }}>
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
        shadows
        style={{ width: '100%', height: '100%' }}
        camera={{ position: [0, 5, 15], fov: 60 }}
      >
        <Lightning />
        <LightCircle />
        <CoreSphere avatarRef={avatarRef} />
        <ArtworksInGallery avatarRef={avatarRef} />
        <Avatar ref={avatarRef} />
        <AvatarController avatarRef={avatarRef} joystickRef={joystickRef} />
        <ThirdPersonCamera avatarRef={avatarRef} />
        <FloorWhite />
      </Canvas>

      <AIGuideChat
        initialMessage={chatOpen ? 'ギャラリーの使い方を教えて' : undefined}
        open={chatOpen}
        onClose={() => setChatOpen(false)}
      />
    </div>
  );
}
