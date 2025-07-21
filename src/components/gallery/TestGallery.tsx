'use client';

import React, { useRef, useEffect } from 'react';
import * as THREE from 'three';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, useGLTF } from '@react-three/drei';
import CoreSphere from '@/components/shared/CoreSphere';
import Avatar from '@/components/shared/Avatar';
import ThirdPersonCamera from '@/components/shared/ThirdPersonCamera';
import AvatarController from '@/components/shared/AvatarController';
import { GalleryIntroModal } from '@/components/shared/GalleryIntroModal';
import { OperationHintButton } from '@/components/shared/OperationHintButton';
import { useIsMobile } from '@/lib/useIsMobile';
import JoystickInput from '@/components/shared/JoystickInput';

function TestModel() {
  const { scene } = useGLTF('/models/test-float.glb');
  return <primitive object={scene} />;
}

export default function TestGallery(): JSX.Element {
  const avatarRef = useRef<THREE.Group>(null);
  const joystickRef = useRef({ x: 0, y: 0 });
  const isMobile = useIsMobile();

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
        <ambientLight intensity={0.6} />
        <directionalLight position={[5, 10, 5]} castShadow intensity={1} />
        <CoreSphere avatarRef={avatarRef} />
        <TestModel />
        <Avatar ref={avatarRef} />
        <AvatarController avatarRef={avatarRef} joystickRef={joystickRef} />
        <ThirdPersonCamera avatarRef={avatarRef} />
      </Canvas>
    </div>
  );
}
